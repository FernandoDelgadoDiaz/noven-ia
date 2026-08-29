-- =============================================================================
-- NOVEN · RESTAURAR LECTURA PROTEGIDA DEL CATÁLOGO
--
-- Las vistas operativas SECURITY INVOKER dependen de public.productos.
-- Sin SELECT sobre la tabla base, usuarios autenticados legítimos reciben 403
-- aun cuando la vista y las políticas RLS autorizan su alcance.
--
-- Se restaura únicamente SELECT. RLS continúa habilitado y
-- productos_select_scope_v1 mantiene el aislamiento por organización.
-- =============================================================================

BEGIN;

GRANT SELECT ON TABLE public.productos TO authenticated;

COMMIT;
