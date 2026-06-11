-- ============================================================
-- 20260610000000_fix_productos_rls.sql
-- C2: Reemplazar policies de productos que usan auth.jwt() ->> 'role'
--     (claim que nunca matchea) por policies basadas en public.usuarios.rol.
--
-- Estado en producción antes de esta migración (inspeccionado 2026-06-10):
--   - productos_insert_admin: WITH CHECK (auth.jwt() ->> 'role' = 'admin') — ROTA
--   - productos_update_admin: USING/WITH CHECK (auth.jwt() ->> 'role' = 'admin') — ROTA
--   - productos_insert:       WITH CHECK (true) — permisiva abierta (workaround manual)
--   - productos_update:       USING (true)      — permisiva abierta (workaround manual)
--   - productos_select:       USING (true)      — redundante con productos_select_authenticated
--   - productos_select_authenticated: USING (true) — correcta
--
-- Esta migración:
--   1. Elimina las policies rotas de admin basadas en JWT claim.
--   2. Elimina las policies abiertas de workaround (productos_insert, productos_update).
--   3. Crea policies correctas para admin (via subquery a public.usuarios).
--   4. Crea policy para operadores: pueden actualizar imagen_url, stock_actual y
--      codigo_barras en productos de sus familias asignadas.
--   5. Elimina policy SELECT duplicada (productos_select).
-- ============================================================

-- 1. Eliminar policies rotas y de workaround
DROP POLICY IF EXISTS "productos_insert_admin" ON productos;
DROP POLICY IF EXISTS "productos_update_admin" ON productos;
DROP POLICY IF EXISTS "productos_insert" ON productos;
DROP POLICY IF EXISTS "productos_update" ON productos;
DROP POLICY IF EXISTS "productos_select" ON productos;

-- 2. Policy INSERT para admin (via subquery a public.usuarios)
CREATE POLICY "productos_insert_admin" ON productos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- 3. Policy UPDATE para admin (via subquery a public.usuarios)
CREATE POLICY "productos_update_admin" ON productos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- 4. Policy UPDATE para operadores: pueden actualizar productos de sus familias asignadas.
--    Postgres no permite restringir UPDATE por columnas en una policy, por lo que
--    se permite el UPDATE completo del row siempre que el producto pertenezca a una
--    familia del operador. El control de qué campos puede editar queda en el frontend
--    y en la RPC actualizar_producto_operador (SECURITY DEFINER) si se necesita
--    restricción hard a nivel DB.
CREATE POLICY "productos_update_operador_familia" ON productos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM usuario_familias uf
      WHERE uf.usuario_id = auth.uid()
        AND uf.familia_id = productos.familia_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM usuario_familias uf
      WHERE uf.usuario_id = auth.uid()
        AND uf.familia_id = productos.familia_id
    )
  );
