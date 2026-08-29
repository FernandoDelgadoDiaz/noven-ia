-- =============================================================================
-- NOVEN · RESTAURAR HELPER RLS DE LECTURA PRODUCTO/SUCURSAL
--
-- producto_sucursal evalúa noven_private.puede_leer_producto_sucursal(...)
-- en su política RLS. Las vistas SECURITY INVOKER necesitan que authenticated
-- pueda ejecutar este helper para evaluar el alcance legítimo.
-- =============================================================================

BEGIN;

GRANT EXECUTE ON FUNCTION noven_private.puede_leer_producto_sucursal(uuid, uuid)
  TO authenticated;

COMMIT;
