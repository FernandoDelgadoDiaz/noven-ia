CREATE OR REPLACE FUNCTION public.recalcular_niveles_vencimientos()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  filas integer;
BEGIN
  WITH op AS (
    SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy
  ),
  calc AS (
    SELECT
      ve.id,
      (ve.fecha_vencimiento - op.hoy) AS dias,
      s.dias_donacion,
      CASE
        WHEN ps.venta_media_diaria <= 0 THEN 'Infinity'::float8
        ELSE ve.cantidad::float8 / ps.venta_media_diaria::float8
      END AS dias_stock
    FROM public.vencimientos ve
    JOIN public.productos p ON p.id = ve.producto_id
    JOIN public.producto_sucursal ps
      ON ps.producto_id = ve.producto_id
     AND ps.sucursal_id = ve.sucursal_id
     AND ps.organizacion_id = p.organizacion_id
    LEFT JOIN public.familias f
      ON f.id = p.familia_id
     AND f.organizacion_id = p.organizacion_id
    LEFT JOIN public.sectores s
      ON s.id = f.sector_id
     AND s.organizacion_id = p.organizacion_id
    CROSS JOIN op
    WHERE ve.activo = true
      AND s.dias_donacion IS NOT NULL
  ),
  nivel AS (
    SELECT
      id,
      CASE
        WHEN dias <= 0 THEN 'decomiso'
        WHEN dias <= dias_donacion THEN 'donacion'
        WHEN dias <= 20 AND dias_stock > GREATEST(dias - dias_donacion, 0) THEN 'urgente'
        WHEN dias <= 45 AND dias_stock > GREATEST(dias - dias_donacion, 0) THEN 'radar'
        ELSE 'seguro'
      END AS nivel_calc
    FROM calc
  )
  UPDATE public.vencimientos v
  SET nivel_actual = n.nivel_calc
  FROM nivel n
  WHERE v.id = n.id
    AND v.nivel_actual IS DISTINCT FROM n.nivel_calc;

  GET DIAGNOSTICS filas = ROW_COUNT;
  RETURN filas;
END;
$function$

CREATE OR REPLACE FUNCTION public.registrar_control_vencimiento(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_nota text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT noven_private.registrar_control_vencimiento_impl(p_vencimiento_id,p_cantidad_comprometida,p_nota); $function$

CREATE OR REPLACE FUNCTION public.registrar_control_vencimiento_dashboard(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_fecha_vencimiento date, p_stock_actual integer, p_porcentaje_rag numeric DEFAULT NULL::numeric, p_nota text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT noven_private.registrar_control_vencimiento_dashboard_impl(p_vencimiento_id,p_cantidad_comprometida,p_fecha_vencimiento,p_stock_actual,p_porcentaje_rag,p_nota); $function$

CREATE OR REPLACE FUNCTION public.registrar_control_vencimiento_dashboard_invoker_v1(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_fecha_vencimiento date, p_stock_actual integer, p_porcentaje_rag numeric DEFAULT NULL::numeric, p_nota text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_sucursal uuid;
  v_producto uuid;
  v_dias_donacion integer;
  v_obs_id bigint;
  v_rag_id uuid;
  v_finalizar_rag boolean := false;
  v_partes text[];
  v_motivo_finalizacion text;
  v_nota_finalizacion text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_cantidad_comprometida IS NULL OR p_cantidad_comprometida <= 0 THEN
    RAISE EXCEPTION 'La cantidad comprometida debe ser mayor a cero; use cierre vendido para cantidad cero' USING ERRCODE = '22023';
  END IF;

  IF p_fecha_vencimiento IS NULL THEN
    RAISE EXCEPTION 'La fecha de vencimiento es obligatoria' USING ERRCODE = '22023';
  END IF;

  IF p_stock_actual IS NULL OR p_stock_actual < 0 THEN
    RAISE EXCEPTION 'El stock total debe ser mayor o igual a cero' USING ERRCODE = '22023';
  END IF;

  IF p_porcentaje_rag IS NOT NULL AND (p_porcentaje_rag < 0 OR p_porcentaje_rag > 100) THEN
    RAISE EXCEPTION 'El porcentaje RAG debe estar entre 0 y 100' USING ERRCODE = '22023';
  END IF;

  IF p_porcentaje_rag = 0 THEN
    IF p_nota IS NULL OR p_nota NOT LIKE 'FINALIZAR_RAG|%' THEN
      RAISE EXCEPTION 'Para finalizar un RAG se requiere un motivo válido' USING ERRCODE = '22023';
    END IF;

    v_partes := string_to_array(p_nota, '|');
    v_motivo_finalizacion := NULLIF(btrim(v_partes[2]), '');
    IF array_length(v_partes, 1) >= 3 THEN
      v_nota_finalizacion := NULLIF(btrim(array_to_string(v_partes[3:array_length(v_partes, 1)], '|')), '');
    END IF;

    IF v_motivo_finalizacion IS NULL OR v_motivo_finalizacion NOT IN ('oferta_centralizada', 'decision_comercial', 'otro') THEN
      RAISE EXCEPTION 'Motivo de finalización RAG no válido' USING ERRCODE = '22023';
    END IF;

    v_finalizar_rag := true;
  END IF;

  SELECT v.sucursal_id, v.producto_id, sec.dias_donacion
    INTO v_sucursal, v_producto, v_dias_donacion
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  LEFT JOIN public.familias f ON f.id = p.familia_id AND f.organizacion_id = p.organizacion_id
  LEFT JOIN public.sectores sec ON sec.id = f.sector_id AND sec.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true
  FOR UPDATE OF v;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para controlar este vencimiento' USING ERRCODE = '42501';
  END IF;

  IF v_dias_donacion IS NULL THEN
    RAISE EXCEPTION 'Este producto pertenece a un sector fuera del circuito de vencimientos configurado' USING ERRCODE = '22023';
  END IF;

  UPDATE public.vencimientos
  SET fecha_vencimiento = p_fecha_vencimiento,
      updated_at = now()
  WHERE id = p_vencimiento_id;

  SELECT public.registrar_control_vencimiento(
    p_vencimiento_id,
    p_cantidad_comprometida,
    CASE WHEN v_finalizar_rag THEN NULL ELSE p_nota END
  ) INTO v_obs_id;

  IF v_finalizar_rag THEN
    UPDATE public.intervenciones_rag
    SET
      finalizado_at = now(),
      finalizado_por = v_uid,
      motivo_finalizacion = v_motivo_finalizacion,
      nota_finalizacion = v_nota_finalizacion
    WHERE id = (
      SELECT r.id
      FROM public.intervenciones_rag r
      WHERE r.vencimiento_id = p_vencimiento_id
        AND r.finalizado_at IS NULL
      ORDER BY r.aplicado_at DESC, r.created_at DESC, r.id DESC
      LIMIT 1
      FOR UPDATE
    )
    RETURNING id INTO v_rag_id;

    IF v_rag_id IS NULL THEN
      RAISE EXCEPTION 'No hay un RAG vigente para finalizar' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_porcentaje_rag IS NOT NULL THEN
    IF p_porcentaje_rag <= 0 THEN
      RAISE EXCEPTION 'El porcentaje RAG debe ser mayor a 0 y menor o igual a 100' USING ERRCODE = '22023';
    END IF;
    SELECT public.registrar_intervencion_rag(p_vencimiento_id, p_porcentaje_rag, p_nota)
      INTO v_rag_id;
  END IF;

  PERFORM public.actualizar_stock_producto_sucursal_scanner(v_sucursal, v_producto, p_stock_actual);

  RETURN jsonb_build_object(
    'observacion_id', v_obs_id,
    'intervencion_rag_id', v_rag_id,
    'rag_finalizado', v_finalizar_rag,
    'sucursal_id', v_sucursal,
    'producto_id', v_producto
  );
END;
$function$

CREATE OR REPLACE FUNCTION public.registrar_control_vencimiento_invoker_v1(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_nota text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$ DECLARE v_uid uuid := (SELECT auth.uid()); v_org uuid; v_sucursal uuid; v_producto uuid; v_obs_id bigint; BEGIN IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF; IF p_cantidad_comprometida IS NULL OR p_cantidad_comprometida<0 THEN RAISE EXCEPTION 'La cantidad comprometida debe ser mayor o igual a cero' USING ERRCODE='22023'; END IF; SELECT p.organizacion_id,v.sucursal_id,v.producto_id INTO v_org,v_sucursal,v_producto FROM public.vencimientos v JOIN public.productos p ON p.id=v.producto_id WHERE v.id=p_vencimiento_id AND v.activo=true; IF NOT FOUND THEN RAISE EXCEPTION 'Vencimiento activo no encontrado' USING ERRCODE='P0002'; END IF; IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal,v_producto) THEN RAISE EXCEPTION 'Sin permiso para registrar este control' USING ERRCODE='42501'; END IF; INSERT INTO public.vencimiento_observaciones(organizacion_id,sucursal_id,producto_id,vencimiento_id,usuario_id,cantidad_comprometida,nota) VALUES(v_org,v_sucursal,v_producto,p_vencimiento_id,v_uid,p_cantidad_comprometida,NULLIF(btrim(p_nota),'')) RETURNING id INTO v_obs_id; UPDATE public.vencimientos SET cantidad=p_cantidad_comprometida WHERE id=p_vencimiento_id; RETURN v_obs_id; END; $function$

CREATE OR REPLACE FUNCTION public.registrar_intervencion_rag(p_vencimiento_id uuid, p_porcentaje_descuento numeric, p_nota text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT noven_private.registrar_intervencion_rag_impl(p_vencimiento_id,p_porcentaje_descuento,p_nota); $function$

CREATE OR REPLACE FUNCTION public.registrar_intervencion_rag_invoker_v1(p_vencimiento_id uuid, p_porcentaje_descuento numeric, p_nota text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_sucursal uuid;
  v_producto uuid;
  v_cantidad numeric;
  v_vmd numeric;
  v_rag_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000';
  END IF;

  IF p_porcentaje_descuento IS NULL OR p_porcentaje_descuento <= 0 OR p_porcentaje_descuento > 100 THEN
    RAISE EXCEPTION 'El porcentaje RAG debe ser mayor a 0 y menor o igual a 100' USING ERRCODE='22023';
  END IF;

  SELECT p.organizacion_id, v.sucursal_id, v.producto_id, v.cantidad, ps.venta_media_diaria
    INTO v_org, v_sucursal, v_producto, v_cantidad, v_vmd
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  JOIN public.producto_sucursal ps
    ON ps.producto_id = v.producto_id
   AND ps.sucursal_id = v.sucursal_id
   AND ps.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo/estado de sucursal no encontrado' USING ERRCODE='P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para registrar RAG sobre este producto' USING ERRCODE='42501';
  END IF;

  UPDATE public.intervenciones_rag
  SET
    finalizado_at = now(),
    finalizado_por = v_uid,
    motivo_finalizacion = 'reemplazado',
    nota_finalizacion = NULL
  WHERE vencimiento_id = p_vencimiento_id
    AND finalizado_at IS NULL;

  INSERT INTO public.intervenciones_rag(
    organizacion_id,
    sucursal_id,
    producto_id,
    vencimiento_id,
    usuario_id,
    porcentaje_descuento,
    cantidad_comprometida_al_aplicar,
    vmd_glaciar_al_aplicar,
    nota
  )
  VALUES(
    v_org,
    v_sucursal,
    v_producto,
    p_vencimiento_id,
    v_uid,
    p_porcentaje_descuento,
    v_cantidad,
    v_vmd,
    NULLIF(btrim(p_nota), '')
  )
  RETURNING id INTO v_rag_id;

  RETURN v_rag_id;
END;
$function$
