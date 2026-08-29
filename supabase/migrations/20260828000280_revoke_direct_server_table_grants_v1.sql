-- =============================================================================
-- NOVEN · TABLAS SERVER-ONLY SIN GRANTS DIRECTOS AUTHENTICATED
--
-- Ambas tablas tienen RLS activo y cero policies, por lo que ya fallan cerradas.
-- Sin embargo conservaban ACL CRUD completas para authenticated por herencia
-- histórica. Ningún flujo legítimo las necesita: invitaciones se gestionan sólo
-- mediante funciones SECURITY DEFINER auditadas y la tabla backup no tiene
-- consumidores productivos.
-- =============================================================================

BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.invitaciones_acceso
  FROM authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.productos_familia_backup_20260806
  FROM authenticated;

COMMIT;
