-- ============================================================
-- 20260610000001_fix_acciones_operativas_select.sql
-- C3: Garantizar que la policy SELECT de acciones_operativas
--     permita a todos los usuarios autenticados ver todos los
--     registros (agregados de negocio por sucursal).
--
-- Estado en producción antes de esta migración (inspeccionado 2026-06-10):
--   La migración 20260526000001 NO fue aplicada al remoto (falta en migration list).
--   Sin embargo, el esquema de producción ya tiene:
--     - acciones_insert: WITH CHECK (auth.uid() = usuario_id)  ← correcto
--     - acciones_select: USING (true)                          ← ya corregido manualmente
--   Esta migración es idempotente y reconcilia el estado sin romper nada.
--
-- La policy SELECT "usuarios autenticados pueden leer acciones" del archivo
-- 20260526000001 usa auth.uid() = usuario_id (ownership), lo que impide
-- ver totales de trimestre del negocio completo. Esta migración la reemplaza
-- por una policy abierta a todos los autenticados (los datos son métricas
-- de negocio, no datos personales sensibles).
--
-- La policy INSERT queda intacta (usuario_id = auth.uid() evita suplantación).
-- ============================================================

-- Eliminar la policy SELECT restrictiva (ownership) si existe con cualquier nombre
DROP POLICY IF EXISTS "usuarios autenticados pueden leer acciones" ON acciones_operativas;
DROP POLICY IF EXISTS "acciones_select_sucursal" ON acciones_operativas;
DROP POLICY IF EXISTS "acciones_select" ON acciones_operativas;

-- Crear policy SELECT abierta para todos los autenticados
CREATE POLICY "acciones_select_sucursal" ON acciones_operativas
  FOR SELECT
  TO authenticated
  USING (true);
