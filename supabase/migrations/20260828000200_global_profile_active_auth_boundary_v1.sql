-- =============================================================================
-- NOVEN · PERFIL GLOBAL ACTIVO COMO FRONTERA DE AUTORIZACIÓN V1
--
-- `usuarios.activo` gobierna el ciclo de vida global de la cuenta. Un JWT válido
-- y un `usuario_accesos.activo=true` no deben alcanzar para leer ni operar Noven
-- si el perfil global fue desactivado.
--
-- Estos helpers son usados por RLS y por las RPC operativas de producto, por lo
-- que endurecerlos cierra la frontera de forma transversal.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION noven_private.tiene_acceso_organizacion(
  p_organizacion_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = p_organizacion_id
     AND ua.activo = true
    WHERE u.id = (SELECT auth.uid())
      AND u.activo = true
  );
$$;

CREATE OR REPLACE FUNCTION noven_private.tiene_acceso_sucursal(
  p_sucursal_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.sucursales s
      ON s.id = p_sucursal_id
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = s.organizacion_id
     AND ua.activo = true
    WHERE u.id = (SELECT auth.uid())
      AND u.activo = true
      AND (
        ua.rol = 'admin_organizacion'
        OR (ua.rol = 'gerente_zonal' AND ua.zona_id = s.zona_id)
        OR (
          ua.rol IN ('gerente_sucursal', 'supervisor', 'operador')
          AND ua.sucursal_id = s.id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION noven_private.puede_ver_familia_sucursal(
  p_sucursal_id uuid,
  p_familia_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.sucursales s
      ON s.id = p_sucursal_id
    JOIN public.familias f
      ON f.id = p_familia_id
     AND f.organizacion_id = s.organizacion_id
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = s.organizacion_id
     AND ua.activo = true
    WHERE u.id = (SELECT auth.uid())
      AND u.activo = true
      AND (
        ua.rol = 'admin_organizacion'
        OR (ua.rol = 'gerente_zonal' AND ua.zona_id = s.zona_id)
        OR (
          ua.rol IN ('gerente_sucursal', 'supervisor')
          AND ua.sucursal_id = s.id
        )
        OR (
          ua.rol = 'operador'
          AND ua.sucursal_id = s.id
          AND EXISTS (
            SELECT 1
            FROM public.usuario_familias_sucursal ufs
            WHERE ufs.usuario_id = ua.usuario_id
              AND ufs.organizacion_id = s.organizacion_id
              AND ufs.sucursal_id = s.id
              AND ufs.familia_id = f.id
              AND ufs.activo = true
          )
        )
      )
  );
$$;

-- Radar zonal usa SECURITY DEFINER porque agrega información entre sucursales.
-- La autorización debe contemplar también el estado global del actor.
CREATE OR REPLACE FUNCTION noven_private.listar_resumen_radar_zonal_v1_impl(
  p_zona_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY last_detected_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'alerta_id', a.id,
        'zona_id', a.zona_id,
        'producto_id', a.producto_id,
        'cod_art', p.cod_art,
        'descripcion', p.descripcion,
        'fecha_vencimiento', a.fecha_vencimiento,
        'nivel_origen', a.nivel_origen,
        'sucursal_origen_codigo', so.codigo,
        'con_stock', count(d.id),
        'pendientes', count(*) FILTER (WHERE d.estado IN ('pendiente', 'revisar_despues')),
        'ya_controlados', count(*) FILTER (WHERE d.estado = 'ya_controlado'),
        'misma_fecha', count(*) FILTER (WHERE d.estado = 'misma_fecha'),
        'otra_fecha', count(*) FILTER (WHERE d.estado = 'otra_fecha'),
        'no_lo_tienen', count(*) FILTER (WHERE d.estado = 'no_lo_tengo'),
        'sin_responsable', count(*) FILTER (WHERE d.estado = 'sin_responsable')
      ) AS item,
      a.last_detected_at
    FROM public.alertas_zonales a
    JOIN public.productos p ON p.id = a.producto_id
    JOIN public.sucursales so ON so.id = a.sucursal_origen_id
    LEFT JOIN public.alertas_zonales_destinos d ON d.alerta_id = a.id
    WHERE (p_zona_id IS NULL OR a.zona_id = p_zona_id)
      AND EXISTS (
        SELECT 1
        FROM public.usuarios u
        JOIN public.usuario_accesos ua
          ON ua.usuario_id = u.id
         AND ua.organizacion_id = a.organizacion_id
         AND ua.activo = true
        WHERE u.id = v_uid
          AND u.activo = true
          AND (
            ua.rol = 'admin_organizacion'
            OR (ua.rol = 'gerente_zonal' AND ua.zona_id = a.zona_id)
            OR (
              ua.rol IN ('gerente_sucursal', 'supervisor')
              AND ua.sucursal_id = a.sucursal_origen_id
            )
          )
      )
    GROUP BY
      a.id,
      a.zona_id,
      a.producto_id,
      a.fecha_vencimiento,
      a.nivel_origen,
      a.last_detected_at,
      p.cod_art,
      p.descripcion,
      so.codigo
  ) q;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION noven_private.tiene_acceso_organizacion(uuid) IS
  'RLS helper: exige perfil global activo y acceso activo a la organización.';
COMMENT ON FUNCTION noven_private.tiene_acceso_sucursal(uuid) IS
  'RLS helper: exige perfil global activo y alcance activo sobre la sucursal.';
COMMENT ON FUNCTION noven_private.puede_ver_familia_sucursal(uuid, uuid) IS
  'RLS/RPC helper: exige perfil global activo, alcance activo y familia válida de la organización.';

COMMIT;
