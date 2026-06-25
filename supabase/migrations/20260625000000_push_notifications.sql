-- ============================================================
-- 20260625000000_push_notifications.sql
-- Infraestructura para notificaciones Web Push.
--
-- 1) Columna `nivel_actual` en vencimientos: guarda el último nivel
--    de riesgo "conocido/notificado". El frontend la actualiza cuando
--    un vencimiento transiciona a 'urgente', y un webhook de DB sobre
--    ese UPDATE dispara el envío de la notificación.
-- 2) Tabla `push_subscriptions`: una fila por suscripción de dispositivo
--    (Web Push API), con RLS de ownership.
--
-- Nota: la UNIQUE sobre la expresión (subscription->>'endpoint') NO puede
-- declararse como constraint de tabla en Postgres; se implementa como
-- índice único. Se usa gen_random_uuid() (pgcrypto) como en el resto del repo.
--
-- El webhook de DB (trigger pg_net) se configura por separado porque
-- incluye un secreto (x-webhook-secret) que no debe vivir en el repo.
-- ============================================================

-- ------------------------------------------------------------
-- 1) vencimientos.nivel_actual
-- ------------------------------------------------------------
ALTER TABLE vencimientos
  ADD COLUMN IF NOT EXISTS nivel_actual text
  CHECK (nivel_actual IN ('seguro', 'radar', 'urgente', 'donacion', 'decomiso'));

-- ------------------------------------------------------------
-- 2) push_subscriptions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_own" ON push_subscriptions;
CREATE POLICY "push_own" ON push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- Una suscripción única por (usuario, endpoint del navegador)
CREATE UNIQUE INDEX IF NOT EXISTS uq_push_usuario_endpoint
  ON push_subscriptions (usuario_id, (subscription->>'endpoint'));

CREATE INDEX IF NOT EXISTS idx_push_usuario
  ON push_subscriptions (usuario_id);

-- updated_at automático (reutiliza set_updated_at() de 001_initial_schema.sql)
DROP TRIGGER IF EXISTS push_subscriptions_set_updated_at ON push_subscriptions;
CREATE TRIGGER push_subscriptions_set_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
