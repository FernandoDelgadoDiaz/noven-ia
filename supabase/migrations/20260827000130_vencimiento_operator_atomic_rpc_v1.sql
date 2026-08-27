-- =============================================================================
-- NOVEN · ALTA/ACTUALIZACIÓN DE VENCIMIENTO + OBSERVACIÓN ATÓMICA V1
--
-- Garantiza que el primer dato del operador y cada actualización desde Scanner
-- dejen historia. Si la observación falla, también falla el alta/actualización.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.crear_vencimiento_operador(
  p_producto_id uuid,
  p_sucursal_id uuid,
  p_cantidad numeric,
  p_fecha_vencimiento date,
  p_lote text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, noven_private, pg_temp
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_id uuid;
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

  SELECT p.organizacion_id
  INTO v_org
  FROM public.productos p
  JOIN public.sucursales s
    ON s.id = p_sucursal_id
   AND s.organizacion_id = p.organizacion_id
  WHERE p.id = p_producto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto/sucursal incompatibles o inexistentes' USING ERRCODE = 'P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id, p_producto_id) THEN
    RAISE EXCEPTION 'Sin permiso para registrar este producto en la sucursal' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.vencimientos (
    producto_id,
    sucursal_id,
    usuario_id,
    cantidad,
    lote,
    fecha_vencimiento,
    fecha_carga,
    activo
  )
  VALUES (
    p_producto_id,
    p_sucursal_id,
    v_uid,
    p_cantidad,
    NULLIF(btrim(p_lote), ''),
    p_fecha_vencimiento,
    CURRENT_DATE,
    true
  )
  RETURNING id INTO v_id;

  INSERT INTO public.vencimiento_observaciones (
    organizacion_id,
    sucursal_id,
    producto_id,
    vencimiento_id,
    usuario_id,
    cantidad_comprometida,
    observada_at,
    nota
  )
  VALUES (
    v_org,
    p_sucursal_id,
    p_producto_id,
    v_id,
    v_uid,
    p_cantidad,
    now(),
    'Carga inicial'
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_vencimiento_operador(uuid, uuid, numeric, date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_vencimiento_operador(uuid, uuid, numeric, date, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_vencimiento_operador(
  p_vencimiento_id uuid,
  p_cantidad numeric,
  p_fecha_vencimiento date,
  p_lote text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, noven_private, pg_temp
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_sucursal uuid;
  v_producto uuid;
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

  SELECT p.organizacion_id, v.sucursal_id, v.producto_id
  INTO v_org, v_sucursal, v_producto
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para actualizar este vencimiento' USING ERRCODE = '42501';
  END IF;

  UPDATE public.vencimientos
  SET
    cantidad = p_cantidad,
    fecha_vencimiento = p_fecha_vencimiento,
    lote = NULLIF(btrim(p_lote), '')
  WHERE id = p_vencimiento_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'La política de acceso impidió actualizar el vencimiento'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.vencimiento_observaciones (
    organizacion_id,
    sucursal_id,
    producto_id,
    vencimiento_id,
    usuario_id,
    cantidad_comprometida,
    nota
  )
  VALUES (
    v_org,
    v_sucursal,
    v_producto,
    p_vencimiento_id,
    v_uid,
    p_cantidad,
    'Control desde Scanner'
  )
  RETURNING id INTO v_obs_id;

  RETURN v_obs_id;
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_vencimiento_operador(uuid, numeric, date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_vencimiento_operador(uuid, numeric, date, text)
  TO authenticated;

COMMENT ON FUNCTION public.crear_vencimiento_operador(uuid, uuid, numeric, date, text) IS
  'Alta atómica del vencimiento y su primera observación física del operador.';
COMMENT ON FUNCTION public.actualizar_vencimiento_operador(uuid, numeric, date, text) IS
  'Actualización atómica del vencimiento desde Scanner y nueva observación append-only.';

COMMIT;
