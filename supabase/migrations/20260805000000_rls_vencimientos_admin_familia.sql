-- =============================================================================
-- MIGRACIÓN: RLS vencimientos — acceso admin/supervisor + filtro por familia
-- Problema que resuelve: el soft-delete (UPDATE activo=false) emitido por el
-- botón "Eliminar registro" afectaba 0 filas cuando el admin intentaba borrar
-- un registro creado por otro usuario, porque las policies de UPDATE solo
-- permitían usuario_id = auth.uid(). PostgREST no devuelve error en ese caso
-- → falla silenciosa en producción.
-- Solución: nueva policy de UPDATE que permite admin/supervisor sin restricción
-- de ownership, y además abre acceso por familia asignada al operador.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Función helper: evita leer public.usuarios directamente desde el cuerpo
--    de una policy (lo cual causaría recursión de RLS si esa tabla tiene RLS).
--    SECURITY DEFINER + search_path fijo = ejecución segura y acotada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rol_actual()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid();
$$;

-- Revocar acceso amplio y otorgar solo a authenticated.
REVOKE EXECUTE ON FUNCTION public.rol_actual() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rol_actual() FROM anon;
GRANT  EXECUTE ON FUNCTION public.rol_actual() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Eliminar las policies de UPDATE y DELETE que se reemplazan.
--    Las de SELECT e INSERT NO se tocan.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS vencimientos_update     ON public.vencimientos;
DROP POLICY IF EXISTS vencimientos_update_own ON public.vencimientos;
DROP POLICY IF EXISTS vencimientos_delete_own ON public.vencimientos;

-- ---------------------------------------------------------------------------
-- 3. Policy de UPDATE unificada.
--
--    Criterio de autorización (USING = WITH CHECK, misma expresión):
--      a) admin o supervisor → acceso irrestricto.
--      b) usuario_id = auth.uid() → un operador siempre puede editar los
--         registros que él mismo cargó.
--         DECISIÓN DE DISEÑO: este OR se mantiene deliberadamente aunque ya
--         exista el criterio (c). Hay productos en producción con familia_id
--         NULL; sin este OR quedarían fuera del alcance del operador que los
--         cargó, generando registros huérfanos inaccesibles.
--      c) Existe una asignación uf en usuario_familias donde la familia del
--         producto coincide con una familia asignada al usuario → acceso
--         cruzado por familia.
-- ---------------------------------------------------------------------------
CREATE POLICY vencimientos_update_admin_o_familia
  ON public.vencimientos
  FOR UPDATE
  TO authenticated
  USING (
    public.rol_actual() IN ('admin', 'supervisor')
    OR usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.productos p
      JOIN public.usuario_familias uf ON uf.familia_id = p.familia_id
      WHERE p.id = vencimientos.producto_id
        AND uf.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    public.rol_actual() IN ('admin', 'supervisor')
    OR usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.productos p
      JOIN public.usuario_familias uf ON uf.familia_id = p.familia_id
      WHERE p.id = vencimientos.producto_id
        AND uf.usuario_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Policy de DELETE unificada.
--    Actualmente el borrado es siempre soft (UPDATE activo=false), pero se
--    crea esta policy por consistencia y para no bloquear un hard-delete
--    futuro. Misma lógica de autorización que UPDATE.
-- ---------------------------------------------------------------------------
CREATE POLICY vencimientos_delete_admin_o_familia
  ON public.vencimientos
  FOR DELETE
  TO authenticated
  USING (
    public.rol_actual() IN ('admin', 'supervisor')
    OR usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.productos p
      JOIN public.usuario_familias uf ON uf.familia_id = p.familia_id
      WHERE p.id = vencimientos.producto_id
        AND uf.usuario_id = auth.uid()
    )
  );

COMMIT;
