-- ============================================================
-- 20260611100001_updated_at_vencimientos_acciones.sql
-- Agrega columna updated_at + trigger a vencimientos y
-- acciones_operativas. Reutiliza la función set_updated_at()
-- que ya existe (creada en 001_initial_schema.sql).
-- Migración no destructiva (IF NOT EXISTS).
-- ============================================================

-- ------------------------------------------------------------
-- vencimientos
-- ------------------------------------------------------------
ALTER TABLE vencimientos
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS vencimientos_set_updated_at ON vencimientos;
CREATE TRIGGER vencimientos_set_updated_at
  BEFORE UPDATE ON vencimientos
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- acciones_operativas
-- ------------------------------------------------------------
ALTER TABLE acciones_operativas
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS acciones_operativas_set_updated_at ON acciones_operativas;
CREATE TRIGGER acciones_operativas_set_updated_at
  BEFORE UPDATE ON acciones_operativas
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
