-- =============================================================================
-- NOVEN · RETIRO RPC HUÉRFANA DE RESUMEN RADAR ZONAL
--
-- `listar_resumen_radar_zonal_v1` no tiene caller browser ni dependencias de DB.
-- El flujo Radar actual usa `listar_mis_alertas_zonales_v1` para la bandeja del
-- operador y no necesita exponer este resumen directo por PostgREST.
--
-- Conservamos las funciones para no hacer un DROP destructivo, pero retiramos
-- EXECUTE de todos los roles de API. Una futura reutilización deberá pasar por
-- una revisión explícita de contrato y alcance.
-- =============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.listar_resumen_radar_zonal_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION noven_private.listar_resumen_radar_zonal_v1_impl(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
