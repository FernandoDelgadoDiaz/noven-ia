CREATE OR REPLACE VIEW public.vw_usuarios_completos WITH (security_invoker=true) AS
 SELECT u.id,
    u.nombre,
    u.rol,
    u.sucursal_id,
    u.activo,
    u.created_at,
    COALESCE(json_agg(json_build_object('id', f.id, 'nombre', f.nombre, 'codigo', f.codigo, 'sector_id', f.sector_id, 'sector_nombre', s.nombre)) FILTER (WHERE f.id IS NOT NULL), '[]'::json) AS familias
   FROM usuarios u
     LEFT JOIN usuario_familias uf ON uf.usuario_id = u.id
     LEFT JOIN familias f ON f.id = uf.familia_id
     LEFT JOIN sectores s ON s.id = f.sector_id
  GROUP BY u.id, u.nombre, u.rol, u.sucursal_id, u.activo, u.created_at;;
