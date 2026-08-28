-- =============================================================================
-- NOVEN · REDUCIR SUPERFICIE RPC FRAGMENTARIA DEL SCANNER V1
--
-- El browser guarda vencimiento + stock mediante la RPC atómica
-- `guardar_vencimiento_y_stock_scanner_v1`. Las tres RPC fragmentarias históricas
-- ya no son una entrada de UI y no deben quedar invocables directamente por un
-- usuario autenticado.
--
-- La RPC atómica pasa a llamar las implementaciones privadas existentes, que
-- conservan auth.uid(), alcance producto/sucursal, política de vencimientos y
-- RLS. Los wrappers públicos se mantienen sólo para compatibilidad server-side.
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
    v_vencimiento_id := noven_private.crear_vencimiento_operador_impl(
      p_producto_id,
      p_sucursal_id,
      p_cantidad,
      p_fecha_vencimiento,
      p_lote
    );
  ELSE
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

    PERFORM noven_private.actualizar_vencimiento_operador_impl(
      p_vencimiento_id,
      p_cantidad,
      p_fecha_vencimiento,
      p_lote
    );
    v_vencimiento_id := p_vencimiento_id;
  END IF;

  IF p_stock_actual IS NOT NULL THEN
    PERFORM noven_private.upsert_stock_producto_sucursal_scanner(
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

-- Las rutas fragmentarias dejan de ser API directa del browser.
REVOKE ALL ON FUNCTION public.crear_vencimiento_operador(
  uuid, uuid, numeric, date, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_vencimiento_operador(
  uuid, uuid, numeric, date, text
) TO service_role;

REVOKE ALL ON FUNCTION public.actualizar_vencimiento_operador(
  uuid, numeric, date, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_vencimiento_operador(
  uuid, numeric, date, text
) TO service_role;

REVOKE ALL ON FUNCTION public.actualizar_stock_producto_sucursal_scanner(
  uuid, uuid, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_stock_producto_sucursal_scanner(
  uuid, uuid, integer
) TO service_role;

COMMENT ON FUNCTION public.guardar_vencimiento_y_stock_scanner_v1(
  uuid, uuid, numeric, date, text, integer, uuid
) IS 'RPC browser atómica para alta/actualización de vencimiento + stock; usa implementaciones privadas y evita escritores fragmentarios directos.';

COMMIT;
