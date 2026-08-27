-- =============================================================================
-- MULTITENANT V1 · FASE 2B.5 — puente temporal legacy 091 → producto_sucursal
--
-- Problema de transición:
--   El frontend productivo actual todavía escribe stock_actual/VMD en `productos`.
--   Si aplicáramos el nuevo modelo y esperáramos a migrar toda la UI, el estado
--   de `producto_sucursal` quedaría desactualizado.
--
-- Solución:
--   Mientras dure el cutover, INSERT/UPDATE legacy de la organización inicial
--   sincronizan automáticamente el estado de Sucursal 091. El puente NO se usa
--   para futuras organizaciones/sucursales y se eliminará cuando todos los
--   escritores apunten a `producto_sucursal`/backend V2.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_legacy_producto_estado_091()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Blindaje: este puente existe exclusivamente para el tenant/store legacy.
  IF NEW.organizacion_id <> '10000000-0000-4000-8000-000000000001'::uuid THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.producto_sucursal (
    organizacion_id,
    producto_id,
    sucursal_id,
    stock_actual,
    venta_media_diaria
  )
  VALUES (
    NEW.organizacion_id,
    NEW.id,
    '00000000-0000-0000-0000-000000000001'::uuid,
    NEW.stock_actual,
    NEW.venta_media_diaria
  )
  ON CONFLICT (producto_id, sucursal_id)
  DO UPDATE SET
    stock_actual = EXCLUDED.stock_actual,
    venta_media_diaria = EXCLUDED.venta_media_diaria,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- El frontend legacy puede insertar productos nuevos desde Scanner.
CREATE TRIGGER productos_sync_estado_091_insert
  AFTER INSERT ON public.productos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_legacy_producto_estado_091();

-- Importar.tsx y formularios actualesizan estos dos campos directamente.
CREATE TRIGGER productos_sync_estado_091_update
  AFTER UPDATE OF stock_actual, venta_media_diaria ON public.productos
  FOR EACH ROW
  WHEN (
    OLD.stock_actual IS DISTINCT FROM NEW.stock_actual
    OR OLD.venta_media_diaria IS DISTINCT FROM NEW.venta_media_diaria
  )
  EXECUTE FUNCTION public.sync_legacy_producto_estado_091();

-- No es una API. Un trigger no necesita quedar invocable desde PostgREST.
REVOKE ALL ON FUNCTION public.sync_legacy_producto_estado_091()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.sync_legacy_producto_estado_091() IS
  'Puente temporal de compatibilidad: replica estado legacy de productos hacia producto_sucursal 091.';

COMMIT;
