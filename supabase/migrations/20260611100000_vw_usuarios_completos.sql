-- ============================================================
-- 20260611100000_vw_usuarios_completos.sql
-- Vista que devuelve 1 fila por usuario con sus familias
-- asignadas en un array JSON (elimina N+1 en Admin.tsx).
--
-- security_invoker = true → la vista respeta las RLS policies
-- del caller (authenticated). Todas las tablas involucradas
-- tienen SELECT FOR authenticated USING (true), por lo que
-- cualquier usuario autenticado puede leer la vista.
-- ============================================================

DROP VIEW IF EXISTS vw_usuarios_completos;

CREATE VIEW vw_usuarios_completos
  WITH (security_invoker = true)
AS
SELECT
  u.id,
  u.nombre,
  u.rol,
  u.sucursal_id,
  u.activo,
  u.created_at,
  -- Array JSON de familias asignadas (vacío si ninguna)
  COALESCE(
    json_agg(
      json_build_object(
        'id',           f.id,
        'nombre',       f.nombre,
        'codigo',       f.codigo,
        'sector_id',    f.sector_id,
        'sector_nombre', s.nombre
      )
    ) FILTER (WHERE f.id IS NOT NULL),
    '[]'::json
  ) AS familias
FROM usuarios u
LEFT JOIN usuario_familias uf ON uf.usuario_id = u.id
LEFT JOIN familias          f  ON f.id = uf.familia_id
LEFT JOIN sectores          s  ON s.id = f.sector_id
GROUP BY u.id, u.nombre, u.rol, u.sucursal_id, u.activo, u.created_at;

-- Dar acceso de lectura a la vista para el rol authenticated
GRANT SELECT ON vw_usuarios_completos TO authenticated;
