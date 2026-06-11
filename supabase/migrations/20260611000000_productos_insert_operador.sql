-- ============================================================
-- 20260611000000_productos_insert_operador.sql
-- Agrega policy INSERT para operadores autenticados sobre productos
-- de las familias que tienen asignadas.
--
-- Contexto: la migración 20260610000000_fix_productos_rls.sql eliminó
-- la policy abierta "productos_insert" (WITH CHECK (true)) y solo
-- creó "productos_insert_admin", dejando a los operadores sin poder
-- insertar productos nuevos desde Scanner e Importar.
-- ============================================================

DROP POLICY IF EXISTS "productos_insert_operador_familia" ON productos;
CREATE POLICY "productos_insert_operador_familia" ON productos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuario_familias uf
      WHERE uf.usuario_id = auth.uid()
        AND uf.familia_id = productos.familia_id
    )
  );
