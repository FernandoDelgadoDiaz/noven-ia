-- =============================================================================
-- NOVEN · RPC DE CONTROL OPERADOR + RAG V1
--
-- El navegador nunca decide organizacion_id, usuario_id, VMD de base ni cantidad
-- base del RAG. Las funciones derivan esos datos del vencimiento/estado actual y
-- verifican explícitamente el scope antes de escribir.
--
-- SECURITY INVOKER: conserva RLS/permisos del usuario autenticado.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_control_vencimiento(
  p_vencimiento_id uuid,
  p_cantidad_comprometida numeric,
  p_nota text DEFAULT NULL
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_cantidad_comprometida IS NULL OR p_cantidad_comprometida < 0 THEN
    RAISE EXCEPTION 'La cantidad comprometida debe ser mayor o igual a cero'
      USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'Sin permiso para registrar este control' USING ERRCODE = '42501';
  END IF;

  -- Cada control queda en historia aunque la cantidad no cambie: 10 → 10 es
  -- evidencia operativa de que no hubo movimiento desde el control anterior.
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
    p_cantidad_comprometida,
    NULLIF(btrim(p_nota), '')
  )
  RETURNING id INTO v_obs_id;

  -- Mantener el estado actual del vencimiento sincronizado con la última
  -- observación física. La fila histórica anterior no se modifica.
  UPDATE public.vencimientos
  SET cantidad = p_cantidad_comprometida
  WHERE id = p_vencimiento_id;

  RETURN v_obs_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_control_vencimiento(uuid, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_control_vencimiento(uuid, numeric, text)
  TO authenticated;

COMMENT ON FUNCTION public.registrar_control_vencimiento(uuid, numeric, text) IS
  'Registra una observación física append-only y sincroniza la cantidad actual del vencimiento. Valida scope por sucursal/familia.';

CREATE OR REPLACE FUNCTION public.registrar_intervencion_rag(
  p_vencimiento_id uuid,
  p_porcentaje_descuento numeric,
  p_nota text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, noven_private, pg_temp
AS $$
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
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_porcentaje_descuento IS NULL
     OR p_porcentaje_descuento <= 0
     OR p_porcentaje_descuento > 100 THEN
    RAISE EXCEPTION 'El porcentaje RAG debe ser mayor a 0 y menor o igual a 100'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    p.organizacion_id,
    v.sucursal_id,
    v.producto_id,
    v.cantidad,
    ps.venta_media_diaria
  INTO
    v_org,
    v_sucursal,
    v_producto,
    v_cantidad,
    v_vmd
  FROM public.vencimientos v
  JOIN public.productos p
    ON p.id = v.producto_id
  JOIN public.producto_sucursal ps
    ON ps.producto_id = v.producto_id
   AND ps.sucursal_id = v.sucursal_id
   AND ps.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo/estado de sucursal no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para registrar RAG sobre este producto'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.intervenciones_rag (
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
  VALUES (
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
$$;

REVOKE ALL ON FUNCTION public.registrar_intervencion_rag(uuid, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_intervencion_rag(uuid, numeric, text)
  TO authenticated;

COMMENT ON FUNCTION public.registrar_intervencion_rag(uuid, numeric, text) IS
  'Registra una nueva intervención RAG append-only, capturando cantidad comprometida y VMD Glaciar vigentes al aplicarla.';

COMMIT;
