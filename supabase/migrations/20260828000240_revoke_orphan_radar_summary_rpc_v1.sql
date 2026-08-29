-- =============================================================================
-- NOVEN · RETIRAR RPC RADAR ZONAL HUÉRFANA DEL NAVEGADOR
--
-- El frontend activo usa listar_mis_alertas_zonales_v1 y responder_alerta_zonal_v1.
-- listar_resumen_radar_zonal_v1 no tiene caller browser ni dependencia funcional
-- que requiera EXECUTE de authenticated. Se conserva service_role por compatibilidad
-- server-side explícita.
-- =============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.listar_resumen_radar_zonal_v1(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_resumen_radar_zonal_v1(uuid)
  TO service_role;

COMMIT;
