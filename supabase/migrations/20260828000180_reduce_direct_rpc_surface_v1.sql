-- =============================================================================
-- NOVEN · REDUCCIÓN DE SUPERFICIE RPC DIRECTA V1
--
-- El control operativo completo se guarda por la RPC atómica del Dashboard.
-- `registrar_control_vencimiento` y `registrar_intervencion_rag` son piezas
-- internas reutilizadas por implementaciones SECURITY DEFINER; no deben quedar
-- disponibles como operaciones fragmentarias directamente desde un cliente.
--
-- `handle_updated_at()` es una función de trigger. El trigger instalado no
-- necesita que el rol authenticated conserve EXECUTE directo sobre la función.
-- =============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.registrar_control_vencimiento(uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.registrar_intervencion_rag(uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_updated_at()
  FROM PUBLIC, anon, authenticated;

COMMIT;
