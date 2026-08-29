-- =============================================================================
-- NOVEN · PRODUCTOS UPDATED_AT SINGLE SOURCE
--
-- Producción conserva dos BEFORE UPDATE equivalentes sobre productos:
-- - productos_set_updated_at -> public.set_updated_at()
-- - productos_updated_at     -> public.handle_updated_at()
--
-- `handle_updated_at()` sólo depende del segundo trigger y hace exactamente lo
-- mismo que `set_updated_at()`. Eliminamos el residuo legacy sin CASCADE y
-- mantenemos `productos_set_updated_at` como única fuente de updated_at.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS productos_updated_at ON public.productos;
DROP FUNCTION IF EXISTS public.handle_updated_at();

COMMIT;
