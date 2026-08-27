-- =============================================================================
-- NOVEN · CONTROL DE VENCIMIENTO DESDE DASHBOARD ATÓMICO V1
--
-- El modal de control deja de encadenar escrituras browser→tabla. Fecha,
-- cantidad observada, RAG opcional y stock local se aplican en una transacción.
-- La anulación por carga incorrecta queda auditada y NO se confunde con un
-- resultado terminal vendido/donación/decomiso.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_control_vencimiento_dashboard(
  p_vencimiento_id uuid,
  p_cantidad_comprometida numeric,
  p_fecha_vencimiento date,
  p_stock_actual integer,
  p_porcentaje_rag numeric DEFAULT NULL,
  p_nota text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, noven_private, pg_temp
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_sucursal uuid;
  v_producto uuid;
  v_obs_id bigint;
  v_rag_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_cantidad_comprometida IS NULL OR p_cantidad_comprometida <= 0 THEN
    RAISE EXCEPTION 'La cantidad comprometida debe ser mayor a cero; use cierre vendido para cantidad cero'
      USING ERRCODE = '22023';
  END IF;

  IF p_fecha_vencimiento IS NULL THEN
    RAISE EXCEPTION 'La fecha de vencimiento es obligatoria' USING ERRCODE = '22023';
  END IF;

  IF p_stock_actual IS NULL OR p_stock_actual < 0 THEN
    RAISE EXCEPTION 'El stock total debe ser mayor o igual a cero' USING ERRCODE = '22023';
  END IF;

  IF p_porcentaje_rag IS NOT NULL
     AND (p_porcentaje_rag <= 0 OR p_porcentaje_rag > 100) THEN
    RAISE EXCEPTION 'El porcentaje RAG debe ser mayor a 0 y menor o igual a 100'
      USING ERRCODE = '22023';
  END IF;

  SELECT v.sucursal_id, v.producto_id
  INTO v_sucursal, v_producto
  FROM public.vencimientos v
  WHERE v.id = p_vencimiento_id
    AND v.activo = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para controlar este vencimiento' USING ERRCODE = '42501';
  END IF;

  UPDATE public.vencimientos
  SET
    fecha_vencimiento = p_fecha_vencimiento,
    updated_at = now()
  WHERE id = p_vencimiento_id;

  SELECT public.registrar_control_vencimiento(
    p_vencimiento_id,
    p_cantidad_comprometida,
    p_nota
  ) INTO v_obs_id;

  IF p_porcentaje_rag IS NOT NULL THEN
    SELECT public.registrar_intervencion_rag(
      p_vencimiento_id,
      p_porcentaje_rag,
      p_nota
    ) INTO v_rag_id;
  END IF;

  PERFORM public.actualizar_stock_producto_sucursal_scanner(
    v_sucursal,
    v_producto,
    p_stock_actual
  );

  RETURN jsonb_build_object(
    'observacion_id', v_obs_id,
    'intervencion_rag_id', v_rag_id,
    'sucursal_id', v_sucursal,
    'producto_id', v_producto
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_control_vencimiento_dashboard(
  uuid, numeric, date, integer, numeric, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_control_vencimiento_dashboard(
  uuid, numeric, date, integer, numeric, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.anular_vencimiento_carga_incorrecta(
  p_vencimiento_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, noven_private, pg_temp
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_sucursal uuid;
  v_producto uuid;
  v_cantidad numeric;
  v_motivo text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT v.sucursal_id, v.producto_id, v.cantidad
  INTO v_sucursal, v_producto, v_cantidad
  FROM public.vencimientos v
  WHERE v.id = p_vencimiento_id
    AND v.activo = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para anular este vencimiento' USING ERRCODE = '42501';
  END IF;

  v_motivo := COALESCE(NULLIF(btrim(COALESCE(p_motivo, '')), ''), 'Carga incorrecta');

  -- Deja evidencia de la corrección sin crear un falso resultado comercial.
  PERFORM public.registrar_control_vencimiento(
    p_vencimiento_id,
    GREATEST(COALESCE(v_cantidad, 0), 0),
    'ANULACIÓN DE CARGA: ' || v_motivo
  );

  UPDATE public.vencimientos
  SET
    activo = false,
    updated_at = now()
  WHERE id = p_vencimiento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.anular_vencimiento_carga_incorrecta(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anular_vencimiento_carga_incorrecta(uuid, text)
  TO authenticated;

COMMENT ON FUNCTION public.registrar_control_vencimiento_dashboard(uuid, numeric, date, integer, numeric, text) IS
  'Dashboard: fecha + control físico + RAG opcional + stock local en una única transacción.';
COMMENT ON FUNCTION public.anular_vencimiento_carga_incorrecta(uuid, text) IS
  'Anula una carga errónea preservando evidencia en observaciones; no registra un resultado terminal.';

COMMIT;