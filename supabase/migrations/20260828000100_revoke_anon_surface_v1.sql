-- =============================================================================
-- NOVEN · REVOKE ANON SURFACE V1
--
-- La aplicación exige autenticación para acceder a datos operativos. RLS ya
-- bloqueaba a anon, pero quedaron grants SQL heredados innecesarios. Se revocan
-- para aplicar defensa en profundidad sin tocar permisos de authenticated.
--
-- NO toca tablas desafio5s_*.
-- =============================================================================

BEGIN;

REVOKE ALL ON TABLE public.acciones_operativas FROM anon;
REVOKE ALL ON TABLE public.familias FROM anon;
REVOKE ALL ON TABLE public.invitaciones_acceso FROM anon;
REVOKE ALL ON TABLE public.productos FROM anon;
REVOKE ALL ON TABLE public.productos_familia_backup_20260806 FROM anon;
REVOKE ALL ON TABLE public.push_subscriptions FROM anon;
REVOKE ALL ON TABLE public.regiones FROM anon;
REVOKE ALL ON TABLE public.sectores FROM anon;
REVOKE ALL ON TABLE public.sucursales FROM anon;
REVOKE ALL ON TABLE public.usuario_familias FROM anon;
REVOKE ALL ON TABLE public.usuarios FROM anon;
REVOKE ALL ON TABLE public.vencimientos FROM anon;
REVOKE ALL ON TABLE public.vw_usuarios_completos FROM anon;

-- Esta trigger function conservaba EXECUTE para PUBLIC/anon por default.
-- Los triggers no necesitan que el rol DML tenga EXECUTE directo sobre ella.
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon;

COMMIT;
