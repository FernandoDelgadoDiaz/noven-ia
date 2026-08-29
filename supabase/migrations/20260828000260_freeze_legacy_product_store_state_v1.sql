-- =============================================================================
-- NOVEN · CONGELAR ESTADO LEGACY EN PRODUCTOS
--
-- `productos.stock_actual` y `productos.venta_media_diaria` fueron el estado
-- histórico de la sucursal 091. El estado operativo autoritativo vive en
-- `producto_sucursal` para cada sucursal.
--
-- Este cutover NO elimina las columnas todavía:
-- - retira el bridge que podía escribir producto_sucursal desde productos;
-- - congela las columnas legacy para que ningún writer residual las reactive;
-- - deja intactos los valores existentes para compatibilidad/rollback.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS productos_sync_estado_091_insert ON public.productos;
DROP TRIGGER IF EXISTS productos_sync_estado_091_update ON public.productos;

CREATE OR REPLACE FUNCTION noven_private.freeze_legacy_producto_estado_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_otro_cambio boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Un producto global nuevo no nace con estado de ninguna sucursal.
    NEW.stock_actual := 0;
    NEW.venta_media_diaria := 0;
    RETURN NEW;
  END IF;

  v_otro_cambio :=
    (to_jsonb(NEW) - ARRAY['stock_actual','venta_media_diaria','updated_at'])
      IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['stock_actual','venta_media_diaria','updated_at']);

  -- Cualquier writer legacy que todavía intente espejar la 091 queda inerte.
  NEW.stock_actual := OLD.stock_actual;
  NEW.venta_media_diaria := OLD.venta_media_diaria;

  -- Si la sentencia sólo intentaba tocar el espejo legacy, tampoco debe fingir
  -- una modificación de identidad global mediante updated_at.
  IF NOT v_otro_cambio THEN
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS productos_freeze_legacy_state_insert_v1 ON public.productos;
CREATE TRIGGER productos_freeze_legacy_state_insert_v1
BEFORE INSERT ON public.productos
FOR EACH ROW
EXECUTE FUNCTION noven_private.freeze_legacy_producto_estado_v1();

-- Prefijo zzz: corre después de los triggers legacy de updated_at y puede
-- restaurar updated_at cuando la única intención era modificar el espejo.
DROP TRIGGER IF EXISTS zzz_productos_freeze_legacy_state_update_v1 ON public.productos;
CREATE TRIGGER zzz_productos_freeze_legacy_state_update_v1
BEFORE UPDATE OF stock_actual, venta_media_diaria ON public.productos
FOR EACH ROW
EXECUTE FUNCTION noven_private.freeze_legacy_producto_estado_v1();

REVOKE ALL ON FUNCTION noven_private.freeze_legacy_producto_estado_v1()
  FROM PUBLIC, anon, authenticated, service_role;

-- El bridge queda disponible sólo como artefacto de rollback del owner, sin
-- triggers ni superficie API. No debe volver a formar parte del runtime.
REVOKE ALL ON FUNCTION public.sync_legacy_producto_estado_091()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON COLUMN public.productos.stock_actual IS
  'LEGACY CONGELADO. No es estado operativo. Usar public.producto_sucursal.stock_actual por sucursal.';
COMMENT ON COLUMN public.productos.venta_media_diaria IS
  'LEGACY CONGELADO. No es estado operativo. Usar public.producto_sucursal.venta_media_diaria por sucursal.';
COMMENT ON FUNCTION public.sync_legacy_producto_estado_091() IS
  'LEGACY sin runtime: bridge productos -> sucursal 091 retirado; conservar sólo para rollback hasta eliminación física futura.';

COMMIT;
