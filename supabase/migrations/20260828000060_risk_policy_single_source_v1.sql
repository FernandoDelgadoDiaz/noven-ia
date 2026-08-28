-- =============================================================================
-- NOVEN · RISK POLICY SINGLE SOURCE V1
--
-- Regla: sectores.dias_donacion es la única fuente de política.
-- NULL significa fuera del circuito y nunca debe convertirse en 10 por fallback.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Scanner: devolver también la política autoritativa del sector.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION noven_private.scanner_producto_json(
  p_producto_id uuid,
  p_sucursal_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'cod_art', p.cod_art,
    'codigo_barras', COALESCE((
      SELECT pc.codigo
      FROM public.producto_codigos pc
      WHERE pc.producto_id = p.id
        AND pc.organizacion_id = p.organizacion_id
        AND pc.activo = true
      ORDER BY pc.es_principal DESC, pc.created_at ASC
      LIMIT 1
    ), p.codigo_barras),
    'descripcion', p.descripcion,
    'marca', p.marca,
    'gramaje', p.gramaje,
    'categoria', p.categoria,
    'proveedor', p.proveedor,
    'sector', COALESCE(sec.nombre, p.sector),
    'dias_donacion', sec.dias_donacion,
    'venta_media_diaria', COALESCE(ps.venta_media_diaria, 0),
    'stock_actual', COALESCE(ps.stock_actual, 0),
    'precio_costo', p.precio_costo,
    'imagen_url', p.imagen_url,
    'imagen_thumb_url', p.imagen_thumb_url,
    'familia_id', p.familia_id,
    'activo', p.activo,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'organizacion_id', p.organizacion_id
  )
  FROM public.productos p
  LEFT JOIN public.producto_sucursal ps
    ON ps.producto_id = p.id
   AND ps.sucursal_id = p_sucursal_id
   AND ps.organizacion_id = p.organizacion_id
  LEFT JOIN public.familias f
    ON f.id = p.familia_id
   AND f.organizacion_id = p.organizacion_id
  LEFT JOIN public.sectores sec
    ON sec.id = f.sector_id
   AND sec.organizacion_id = p.organizacion_id
  WHERE p.id = p_producto_id;
$$;

-- -----------------------------------------------------------------------------
-- Crear vencimiento: imposible si el sector no tiene política.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_vencimiento_operador_invoker_v1(
  p_producto_id uuid,
  p_sucursal_id uuid,
  p_cantidad numeric,
  p_fecha_vencimiento date,
  p_lote text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_id uuid;
  v_dias_donacion integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero' USING ERRCODE = '22023';
  END IF;
  IF p_fecha_vencimiento IS NULL THEN
    RAISE EXCEPTION 'La fecha de vencimiento es obligatoria' USING ERRCODE = '22023';
  END IF;

  SELECT p.organizacion_id, sec.dias_donacion
    INTO v_org, v_dias_donacion
  FROM public.productos p
  JOIN public.sucursales su
    ON su.id = p_sucursal_id
   AND su.organizacion_id = p.organizacion_id
  LEFT JOIN public.familias f
    ON f.id = p.familia_id
   AND f.organizacion_id = p.organizacion_id
  LEFT JOIN public.sectores sec
    ON sec.id = f.sector_id
   AND sec.organizacion_id = p.organizacion_id
  WHERE p.id = p_producto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto/sucursal incompatibles o inexistentes' USING ERRCODE = 'P0002';
  END IF;
  IF NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id, p_producto_id) THEN
    RAISE EXCEPTION 'Sin permiso para registrar este producto en la sucursal' USING ERRCODE = '42501';
  END IF;
  IF v_dias_donacion IS NULL THEN
    RAISE EXCEPTION 'Este producto pertenece a un sector fuera del circuito de vencimientos configurado'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.vencimientos(
    producto_id, sucursal_id, usuario_id, cantidad, lote,
    fecha_vencimiento, fecha_carga, activo
  ) VALUES (
    p_producto_id, p_sucursal_id, v_uid, p_cantidad,
    NULLIF(btrim(p_lote), ''), p_fecha_vencimiento,
    (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
    true
  )
  RETURNING id INTO v_id;

  INSERT INTO public.vencimiento_observaciones(
    organizacion_id, sucursal_id, producto_id, vencimiento_id,
    usuario_id, cantidad_comprometida, observada_at, nota
  ) VALUES (
    v_org, p_sucursal_id, p_producto_id, v_id,
    v_uid, p_cantidad, now(), 'Carga inicial'
  );

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Actualizar desde Scanner: misma barrera de política.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.actualizar_vencimiento_operador_invoker_v1(
  p_vencimiento_id uuid,
  p_cantidad numeric,
  p_fecha_vencimiento date,
  p_lote text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_sucursal uuid;
  v_producto uuid;
  v_dias_donacion integer;
  v_obs_id bigint;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero' USING ERRCODE = '22023';
  END IF;
  IF p_fecha_vencimiento IS NULL THEN
    RAISE EXCEPTION 'La fecha de vencimiento es obligatoria' USING ERRCODE = '22023';
  END IF;

  SELECT p.organizacion_id, v.sucursal_id, v.producto_id, sec.dias_donacion
    INTO v_org, v_sucursal, v_producto, v_dias_donacion
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  LEFT JOIN public.familias f ON f.id = p.familia_id AND f.organizacion_id = p.organizacion_id
  LEFT JOIN public.sectores sec ON sec.id = f.sector_id AND sec.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para actualizar este vencimiento' USING ERRCODE = '42501';
  END IF;
  IF v_dias_donacion IS NULL THEN
    RAISE EXCEPTION 'Este producto pertenece a un sector fuera del circuito de vencimientos configurado'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.vencimientos
  SET cantidad = p_cantidad,
      fecha_vencimiento = p_fecha_vencimiento,
      lote = NULLIF(btrim(p_lote), '')
  WHERE id = p_vencimiento_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'La política de acceso impidió actualizar el vencimiento' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.vencimiento_observaciones(
    organizacion_id, sucursal_id, producto_id, vencimiento_id,
    usuario_id, cantidad_comprometida, nota
  ) VALUES (
    v_org, v_sucursal, v_producto, p_vencimiento_id,
    v_uid, p_cantidad, 'Control desde Scanner'
  )
  RETURNING id INTO v_obs_id;

  RETURN v_obs_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Control Dashboard: tampoco puede operar un sector sin política.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_control_vencimiento_dashboard_invoker_v1(
  p_vencimiento_id uuid,
  p_cantidad_comprometida numeric,
  p_fecha_vencimiento date,
  p_stock_actual integer,
  p_porcentaje_rag numeric DEFAULT NULL,
  p_nota text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_sucursal uuid;
  v_producto uuid;
  v_dias_donacion integer;
  v_obs_id bigint;
  v_rag_id uuid;
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
  IF p_porcentaje_rag IS NOT NULL AND (p_porcentaje_rag <= 0 OR p_porcentaje_rag > 100) THEN
    RAISE EXCEPTION 'El porcentaje RAG debe ser mayor a 0 y menor o igual a 100' USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'Este producto pertenece a un sector fuera del circuito de vencimientos configurado'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.vencimientos
  SET fecha_vencimiento = p_fecha_vencimiento,
      updated_at = now()
  WHERE id = p_vencimiento_id;

  SELECT public.registrar_control_vencimiento(
    p_vencimiento_id, p_cantidad_comprometida, p_nota
  ) INTO v_obs_id;

  IF p_porcentaje_rag IS NOT NULL THEN
    SELECT public.registrar_intervencion_rag(
      p_vencimiento_id, p_porcentaje_rag, p_nota
    ) INTO v_rag_id;
  END IF;

  PERFORM public.actualizar_stock_producto_sucursal_scanner(
    v_sucursal, v_producto, p_stock_actual
  );

  RETURN jsonb_build_object(
    'observacion_id', v_obs_id,
    'intervencion_rag_id', v_rag_id,
    'sucursal_id', v_sucursal,
    'producto_id', v_producto
  );
END;
$$;

COMMIT;
