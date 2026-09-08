-- =============================================================================
-- NOVEN · C2A · OPERACIONES EXPLICITAS POR TIPO DE INTERVENCION
--
-- C1 permite que RAG y oferta central convivan. Este bloque abre y cierra cada
-- tipo mediante una RPC propia y corrige el camino legacy de Finalizar RAG para
-- que tampoco pueda cerrar una oferta central durante el despliegue gradual.
--
-- No infiere ni retrotrae fechas: aplicado_at/finalizado_at nacen en el click.
-- No modifica intervenciones existentes ni crea datos de negocio.
-- =============================================================================

-- --- 1. Informar una oferta central observable ------------------------------

CREATE OR REPLACE FUNCTION noven_private.informar_oferta_central_impl(
  p_vencimiento_id uuid,
  p_nota text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_sucursal uuid;
  v_producto uuid;
  v_cantidad numeric;
  v_vmd numeric;
  v_intervencion_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT p.organizacion_id, v.sucursal_id, v.producto_id, v.cantidad,
         ps.venta_media_diaria
    INTO v_org, v_sucursal, v_producto, v_cantidad, v_vmd
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  JOIN public.producto_sucursal ps
    ON ps.producto_id = v.producto_id
   AND ps.sucursal_id = v.sucursal_id
   AND ps.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true
  FOR UPDATE OF v;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo/estado de sucursal no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para informar oferta central sobre este producto'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotencia ante doble click o dos pantallas abiertas. No se mueve la
  -- fecha de inicio ni se sobrescribe la nota de la observacion original.
  SELECT r.id INTO v_intervencion_id
  FROM public.intervenciones_rag r
  WHERE r.vencimiento_id = p_vencimiento_id
    AND r.tipo = 'oferta_central'
    AND r.finalizado_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    RETURN v_intervencion_id;
  END IF;

  INSERT INTO public.intervenciones_rag(
    organizacion_id, sucursal_id, producto_id, vencimiento_id, usuario_id,
    tipo, porcentaje_descuento, cantidad_comprometida_al_aplicar,
    vmd_glaciar_al_aplicar, nota
  )
  VALUES(
    v_org, v_sucursal, v_producto, p_vencimiento_id, v_uid,
    'oferta_central', NULL, v_cantidad, v_vmd, NULLIF(btrim(p_nota), '')
  )
  RETURNING id INTO v_intervencion_id;

  RETURN v_intervencion_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.informar_oferta_central(
  p_vencimiento_id uuid,
  p_nota text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.informar_oferta_central_impl(p_vencimiento_id, p_nota);
$$;

-- --- 2. Finalizar exactamente el tipo pedido --------------------------------

CREATE OR REPLACE FUNCTION noven_private.finalizar_intervencion_por_tipo_impl(
  p_vencimiento_id uuid,
  p_tipo text,
  p_motivo text,
  p_nota text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_sucursal uuid;
  v_producto uuid;
  v_intervencion_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_tipo IS NULL OR p_tipo NOT IN ('rag', 'oferta_central') THEN
    RAISE EXCEPTION 'Tipo de intervencion no valido' USING ERRCODE = '22023';
  END IF;

  IF p_motivo IS NULL OR p_motivo NOT IN ('decision_comercial', 'otro') THEN
    RAISE EXCEPTION 'Motivo de finalizacion no valido' USING ERRCODE = '22023';
  END IF;

  SELECT v.sucursal_id, v.producto_id
    INTO v_sucursal, v_producto
  FROM public.vencimientos v
  WHERE v.id = p_vencimiento_id
    AND v.activo = true
  FOR UPDATE OF v;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para finalizar esta intervencion'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.intervenciones_rag r
  SET finalizado_at = now(),
      finalizado_por = v_uid,
      motivo_finalizacion = p_motivo,
      nota_finalizacion = NULLIF(btrim(p_nota), '')
  WHERE r.id = (
    SELECT actual.id
    FROM public.intervenciones_rag actual
    WHERE actual.vencimiento_id = p_vencimiento_id
      AND actual.tipo = p_tipo
      AND actual.finalizado_at IS NULL
    FOR UPDATE
  )
  RETURNING r.id INTO v_intervencion_id;

  IF v_intervencion_id IS NULL THEN
    RAISE EXCEPTION 'No hay una intervencion vigente de tipo %', p_tipo
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_intervencion_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalizar_rag_vigente(
  p_vencimiento_id uuid,
  p_motivo text,
  p_nota text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.finalizar_intervencion_por_tipo_impl(
    p_vencimiento_id, 'rag', p_motivo, p_nota
  );
$$;

CREATE OR REPLACE FUNCTION public.finalizar_oferta_central(
  p_vencimiento_id uuid,
  p_nota text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.finalizar_intervencion_por_tipo_impl(
    p_vencimiento_id, 'oferta_central', 'decision_comercial', p_nota
  );
$$;

-- --- 3. Compatibilidad segura durante el despliegue gradual -----------------
--
-- La UI anterior envia FINALIZAR_RAG dentro de p_nota. Se conserva el camino
-- hasta que todos los clientes tengan C2, pero se acota la busqueda a tipo=rag.

CREATE OR REPLACE FUNCTION public.registrar_control_vencimiento_dashboard_invoker_v1(
  p_vencimiento_id uuid,
  p_cantidad_comprometida numeric,
  p_fecha_vencimiento date,
  p_stock_actual integer,
  p_porcentaje_rag numeric DEFAULT NULL::numeric,
  p_nota text DEFAULT NULL::text
)
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
    SET finalizado_at = now(),
        finalizado_por = v_uid,
        motivo_finalizacion = v_motivo_finalizacion,
        nota_finalizacion = v_nota_finalizacion
    WHERE id = (
      SELECT r.id
      FROM public.intervenciones_rag r
      WHERE r.vencimiento_id = p_vencimiento_id
        AND r.tipo = 'rag'
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
$function$;

-- --- 4. Superficie RPC minima y explicita -----------------------------------

REVOKE ALL ON FUNCTION noven_private.informar_oferta_central_impl(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.informar_oferta_central_impl(uuid, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.informar_oferta_central(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.informar_oferta_central(uuid, text)
  TO authenticated;

REVOKE ALL ON FUNCTION noven_private.finalizar_intervencion_por_tipo_impl(uuid, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.finalizar_intervencion_por_tipo_impl(uuid, text, text, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.finalizar_rag_vigente(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_rag_vigente(uuid, text, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.finalizar_oferta_central(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_oferta_central(uuid, text)
  TO authenticated;

COMMENT ON FUNCTION public.informar_oferta_central(uuid, text) IS
  'Declara por click que una oferta central esta visible en gondola. No retrotrae aplicado_at y es idempotente mientras siga vigente.';
COMMENT ON FUNCTION public.finalizar_rag_vigente(uuid, text, text) IS
  'Finaliza solamente el RAG vigente del vencimiento, sin registrar un control ni alterar la oferta central.';
COMMENT ON FUNCTION public.finalizar_oferta_central(uuid, text) IS
  'Finaliza solamente la oferta central vigente del vencimiento, sin registrar un control ni alterar el RAG.';
