-- =============================================================================
-- NOVEN · SCANNER ATOMIC EXPIRY + STOCK V1
--
-- Un único RPC guarda/actualiza el vencimiento y el stock local dentro de la
-- misma transacción PostgreSQL. Si cualquier paso falla, no queda un estado
-- parcial. Reutiliza los wrappers endurecidos existentes para mantener una sola
-- fuente de autorización y política de vencimientos.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.guardar_vencimiento_y_stock_scanner_v1(
  p_producto_id uuid,
  p_sucursal_id uuid,
  p_cantidad numeric,
  p_fecha_vencimiento date,
  p_lote text DEFAULT NULL,
  p_stock_actual integer DEFAULT NULL,
  p_vencimiento_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_vencimiento_id uuid;
  v_producto_actual uuid;
  v_sucursal_actual uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_producto_id IS NULL OR p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'Producto y sucursal son obligatorios' USING ERRCODE = '22023';
  END IF;

  IF p_stock_actual IS NOT NULL AND p_stock_actual < 0 THEN
    RAISE EXCEPTION 'El stock debe ser mayor o igual a cero' USING ERRCODE = '22023';
  END IF;

  IF p_vencimiento_id IS NULL THEN
    v_vencimiento_id := public.crear_vencimiento_operador(
      p_producto_id,
      p_sucursal_id,
      p_cantidad,
      p_fecha_vencimiento,
      p_lote
    );
  ELSE
    -- Este SELECT corre con el rol invocador y RLS. Además evita que el caller
    -- combine un vencimiento autorizado con otro producto/sucursal en el payload.
    SELECT v.producto_id, v.sucursal_id
      INTO v_producto_actual, v_sucursal_actual
    FROM public.vencimientos v
    WHERE v.id = p_vencimiento_id
      AND v.activo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vencimiento activo no encontrado o no autorizado' USING ERRCODE = 'P0002';
    END IF;

    IF v_producto_actual IS DISTINCT FROM p_producto_id
       OR v_sucursal_actual IS DISTINCT FROM p_sucursal_id THEN
      RAISE EXCEPTION 'El vencimiento no pertenece al producto/sucursal informados' USING ERRCODE = '22023';
    END IF;

    PERFORM public.actualizar_vencimiento_operador(
      p_vencimiento_id,
      p_cantidad,
      p_fecha_vencimiento,
      p_lote
    );
    v_vencimiento_id := p_vencimiento_id;
  END IF;

  IF p_stock_actual IS NOT NULL THEN
    PERFORM public.actualizar_stock_producto_sucursal_scanner(
      p_sucursal_id,
      p_producto_id,
      p_stock_actual
    );
  END IF;

  RETURN jsonb_build_object(
    'vencimiento_id', v_vencimiento_id,
    'producto_id', p_producto_id,
    'sucursal_id', p_sucursal_id,
    'stock_actual', p_stock_actual
  );
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_vencimiento_y_stock_scanner_v1(uuid,uuid,numeric,date,text,integer,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_vencimiento_y_stock_scanner_v1(uuid,uuid,numeric,date,text,integer,uuid) TO authenticated;

COMMENT ON FUNCTION public.guardar_vencimiento_y_stock_scanner_v1(uuid,uuid,numeric,date,text,integer,uuid) IS
  'Contrato atómico del Scanner: vencimiento/control + stock local se confirman juntos o se revierten juntos.';

COMMIT;
