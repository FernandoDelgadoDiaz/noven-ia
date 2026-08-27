-- =============================================================================
-- NOVEN · ADVISOR HARDENING V1
--
-- Cierra hallazgos legacy detectados al validar el cutover multitenant en una
-- branch descartable:
--   - backup público sin RLS;
--   - funciones trigger/rol SECURITY DEFINER expuestas como RPC;
--   - set_updated_at con search_path mutable;
--   - policy push que reevalúa auth.uid() por fila;
--   - FK legacy sin índices de cobertura.
--
-- No cambia reglas 45/20 ni políticas de donación/RAG.
-- =============================================================================

BEGIN;

-- Backups históricos: sin superficie browser.
ALTER TABLE public.productos_descripcion_backup_20260805 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.productos_descripcion_backup_20260805 FROM anon, authenticated;
REVOKE ALL ON TABLE public.dedup_turrocklets_backup_20260805 FROM anon, authenticated;

-- Helpers internos/trigger: nunca son RPC de usuario.
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_familia_exclusiva_operador() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_rol_operador_sin_colision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rol_actual() FROM PUBLIC, anon, authenticated;

-- Evitar reevaluar auth.uid() por cada fila.
DROP POLICY IF EXISTS push_own ON public.push_subscriptions;
CREATE POLICY push_own ON public.push_subscriptions
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = usuario_id)
  WITH CHECK ((SELECT auth.uid()) = usuario_id);

-- Cobertura de FK legacy señaladas por Supabase Advisor.
CREATE INDEX IF NOT EXISTS acciones_operativas_producto_idx
  ON public.acciones_operativas(producto_id);
CREATE INDEX IF NOT EXISTS acciones_operativas_usuario_idx
  ON public.acciones_operativas(usuario_id);
CREATE INDEX IF NOT EXISTS acciones_operativas_vencimiento_idx
  ON public.acciones_operativas(vencimiento_id);
CREATE INDEX IF NOT EXISTS usuario_familias_familia_idx
  ON public.usuario_familias(familia_id);
CREATE INDEX IF NOT EXISTS usuarios_sucursal_idx
  ON public.usuarios(sucursal_id)
  WHERE sucursal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vencimientos_usuario_idx
  ON public.vencimientos(usuario_id);

COMMIT;
