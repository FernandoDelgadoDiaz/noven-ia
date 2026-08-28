-- =============================================================================
-- NOVEN · SCOPE SERVER-ONLY PARA IMPORTACIÓN/CATÁLOGO
--
-- Los RPC legacy de escritura siguen siendo service_role-only. Estos gates son
-- la frontera obligatoria de sus Netlify callers:
-- - gerente_sucursal / supervisor: pueden operar sólo su sucursal.
-- - gerente_zonal: sólo lectura, nunca pasa estos gates de escritura.
-- - admin_organizacion: no amplía alcance operativo.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.validar_operacion_local_server_v1(
  p_actor_id uuid,
  p_sucursal_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.sucursales s
      ON s.id=p_sucursal_id
     AND s.activa=true
    JOIN public.usuario_accesos ua
      ON ua.usuario_id=u.id
     AND ua.organizacion_id=s.organizacion_id
     AND ua.sucursal_id=s.id
     AND ua.rol IN ('gerente_sucursal','supervisor')
     AND ua.activo=true
    WHERE u.id=p_actor_id
      AND u.activo=true
  );
$$;

CREATE OR REPLACE FUNCTION public.validar_resolucion_pendiente_server_v1(
  p_actor_id uuid,
  p_pendiente_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.producto_pendiente_detecciones d
      ON d.pendiente_id=p_pendiente_id
    JOIN public.sucursales s
      ON s.id=d.sucursal_id
     AND s.activa=true
    JOIN public.usuario_accesos ua
      ON ua.usuario_id=u.id
     AND ua.organizacion_id=s.organizacion_id
     AND ua.sucursal_id=s.id
     AND ua.rol IN ('gerente_sucursal','supervisor')
     AND ua.activo=true
    WHERE u.id=p_actor_id
      AND u.activo=true
  );
$$;

-- Lectura de pendientes con alcance real. El admin jerárquico sólo ve lo que
-- además le corresponda por un rol operativo; el zonal ve detecciones de su zona.
CREATE OR REPLACE FUNCTION public.listar_productos_pendientes_catalogo_v2(p_usuario_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
  SELECT COALESCE(jsonb_agg(item ORDER BY last_detected_at DESC),'[]'::jsonb)
  FROM (
    SELECT
      jsonb_build_object(
        'id',pp.id,
        'organizacion_id',pp.organizacion_id,
        'cod_art',pp.cod_art,
        'descripcion',pp.descripcion,
        'marca',pp.marca,
        'gramaje',pp.gramaje,
        'producto_id',pp.producto_id,
        'first_detected_at',pp.first_detected_at,
        'last_detected_at',pp.last_detected_at,
        'detecciones',count(DISTINCT d.importacion_id),
        'sucursales',COALESCE(
          jsonb_agg(DISTINCT jsonb_build_object('id',s.id,'codigo',s.codigo,'nombre',s.nombre)),
          '[]'::jsonb
        )
      ) AS item,
      pp.last_detected_at
    FROM public.productos_pendientes_catalogo pp
    JOIN public.producto_pendiente_detecciones d ON d.pendiente_id=pp.id
    JOIN public.sucursales s ON s.id=d.sucursal_id AND s.activa=true
    JOIN public.usuarios u ON u.id=p_usuario_id AND u.activo=true
    WHERE pp.estado='pendiente'
      AND EXISTS (
        SELECT 1
        FROM public.usuario_accesos ua
        WHERE ua.usuario_id=p_usuario_id
          AND ua.organizacion_id=pp.organizacion_id
          AND ua.activo=true
          AND (
            (ua.rol='gerente_zonal' AND ua.zona_id=s.zona_id)
            OR (
              ua.rol IN ('gerente_sucursal','supervisor')
              AND ua.sucursal_id=s.id
            )
          )
      )
    GROUP BY pp.id,pp.organizacion_id,pp.cod_art,pp.descripcion,pp.marca,
             pp.gramaje,pp.producto_id,pp.first_detected_at,pp.last_detected_at
  ) q;
$$;

REVOKE ALL ON FUNCTION public.validar_operacion_local_server_v1(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validar_operacion_local_server_v1(uuid,uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.validar_resolucion_pendiente_server_v1(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validar_resolucion_pendiente_server_v1(uuid,uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.listar_productos_pendientes_catalogo_v2(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listar_productos_pendientes_catalogo_v2(uuid)
  TO service_role;

COMMIT;
