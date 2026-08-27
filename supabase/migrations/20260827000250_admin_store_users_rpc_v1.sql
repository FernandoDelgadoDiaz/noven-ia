-- =============================================================================
-- NOVEN · ADMINISTRACIÓN DE USUARIOS POR SUCURSAL V1
--
-- Reemplaza UPDATE/DELETE/INSERT browser sobre usuarios y usuario_familias.
-- La cuenta Auth se crea en Netlify; perfil, acceso y familias se guardan aquí
-- de forma atómica y branch-aware.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.listar_admin_sucursal_v1(
  p_actor_id uuid,
  p_sucursal_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org uuid;
  v_zona uuid;
  v_puede boolean;
BEGIN
  SELECT s.organizacion_id, s.zona_id
  INTO v_org, v_zona
  FROM public.sucursales s
  WHERE s.id = p_sucursal_id
    AND s.activa = true;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sucursal inexistente o inactiva' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_accesos ua
    WHERE ua.usuario_id = p_actor_id
      AND ua.organizacion_id = v_org
      AND ua.activo = true
      AND (
        ua.rol = 'admin_organizacion'
        OR (ua.rol = 'gerente_zonal' AND ua.zona_id = v_zona)
        OR (ua.rol = 'gerente_sucursal' AND ua.sucursal_id = p_sucursal_id)
      )
  ) INTO v_puede;

  IF NOT v_puede THEN
    RAISE EXCEPTION 'Sin permiso para administrar usuarios de esta sucursal'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'sucursal', (
      SELECT jsonb_build_object(
        'id', s.id,
        'codigo', s.codigo,
        'nombre', s.nombre,
        'organizacion_id', s.organizacion_id
      )
      FROM public.sucursales s
      WHERE s.id = p_sucursal_id
    ),
    'familias', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'codigo', f.codigo,
          'nombre', f.nombre,
          'sector_id', f.sector_id
        ) ORDER BY f.codigo, f.nombre
      )
      FROM public.familias f
      WHERE f.organizacion_id = v_org
    ), '[]'::jsonb),
    'sectores', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'codigo', s.codigo,
          'nombre', s.nombre
        ) ORDER BY s.codigo, s.nombre
      )
      FROM public.sectores s
      WHERE s.organizacion_id = v_org
    ), '[]'::jsonb),
    'usuarios', COALESCE((
      SELECT jsonb_agg(item ORDER BY item->>'nombre')
      FROM (
        SELECT jsonb_build_object(
          'id', u.id,
          'nombre', u.nombre,
          'activo', u.activo,
          'rol', CASE ua.rol
            WHEN 'gerente_sucursal' THEN 'admin'
            WHEN 'supervisor' THEN 'supervisor'
            ELSE 'operador'
          END,
          'rol_scope', ua.rol,
          'familias_ids', COALESCE((
            SELECT jsonb_agg(ufs.familia_id ORDER BY ufs.familia_id)
            FROM public.usuario_familias_sucursal ufs
            WHERE ufs.usuario_id = u.id
              AND ufs.sucursal_id = p_sucursal_id
              AND ufs.activo = true
          ), '[]'::jsonb)
        ) AS item
        FROM public.usuario_accesos ua
        JOIN public.usuarios u ON u.id = ua.usuario_id
        WHERE ua.organizacion_id = v_org
          AND ua.sucursal_id = p_sucursal_id
          AND ua.rol IN ('gerente_sucursal', 'supervisor', 'operador')
      ) q
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.listar_admin_sucursal_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_admin_sucursal_v1(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.guardar_usuario_sucursal_admin_v1(
  p_actor_id uuid,
  p_sucursal_id uuid,
  p_usuario_id uuid,
  p_nombre text,
  p_rol_legacy text,
  p_activo boolean,
  p_familias uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org uuid;
  v_zona uuid;
  v_puede boolean;
  v_rol_scope text;
  v_familia uuid;
BEGIN
  SELECT s.organizacion_id, s.zona_id
  INTO v_org, v_zona
  FROM public.sucursales s
  WHERE s.id = p_sucursal_id
    AND s.activa = true;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sucursal inexistente o inactiva' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_accesos ua
    WHERE ua.usuario_id = p_actor_id
      AND ua.organizacion_id = v_org
      AND ua.activo = true
      AND (
        ua.rol = 'admin_organizacion'
        OR (ua.rol = 'gerente_zonal' AND ua.zona_id = v_zona)
        OR (ua.rol = 'gerente_sucursal' AND ua.sucursal_id = p_sucursal_id)
      )
  ) INTO v_puede;

  IF NOT v_puede THEN
    RAISE EXCEPTION 'Sin permiso para administrar usuarios de esta sucursal'
      USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(COALESCE(p_nombre, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre es obligatorio' USING ERRCODE = '22023';
  END IF;

  IF p_rol_legacy NOT IN ('admin', 'supervisor', 'operador') THEN
    RAISE EXCEPTION 'Rol inválido' USING ERRCODE = '22023';
  END IF;

  v_rol_scope := CASE p_rol_legacy
    WHEN 'admin' THEN 'gerente_sucursal'
    WHEN 'supervisor' THEN 'supervisor'
    ELSE 'operador'
  END;

  -- El auth.users debe existir antes. La FK de usuarios.id hace de gate.
  INSERT INTO public.usuarios (
    id,
    nombre,
    rol,
    activo,
    sucursal_id
  )
  VALUES (
    p_usuario_id,
    btrim(p_nombre),
    p_rol_legacy,
    p_activo,
    p_sucursal_id
  )
  ON CONFLICT (id)
  DO UPDATE SET
    nombre = EXCLUDED.nombre,
    rol = EXCLUDED.rol,
    activo = EXCLUDED.activo,
    sucursal_id = EXCLUDED.sucursal_id;

  -- Esta pantalla administra exclusivamente el acceso de la sucursal elegida.
  -- Otros accesos del usuario (otra sucursal/zona/org) no se tocan.
  DELETE FROM public.usuario_accesos ua
  WHERE ua.usuario_id = p_usuario_id
    AND ua.organizacion_id = v_org
    AND ua.sucursal_id = p_sucursal_id;

  INSERT INTO public.usuario_accesos (
    usuario_id,
    organizacion_id,
    rol,
    sucursal_id,
    activo
  )
  VALUES (
    p_usuario_id,
    v_org,
    v_rol_scope,
    p_sucursal_id,
    p_activo
  );

  -- Nunca se borra historia de asignaciones: se desactiva y se reactiva/upsertea.
  UPDATE public.usuario_familias_sucursal ufs
  SET activo = false,
      updated_at = now()
  WHERE ufs.usuario_id = p_usuario_id
    AND ufs.sucursal_id = p_sucursal_id
    AND ufs.activo = true;

  IF p_rol_legacy = 'operador' AND p_activo THEN
    FOREACH v_familia IN ARRAY COALESCE(p_familias, ARRAY[]::uuid[]) LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.familias f
        WHERE f.id = v_familia
          AND f.organizacion_id = v_org
      ) THEN
        RAISE EXCEPTION 'Familia % no pertenece a la organización', v_familia
          USING ERRCODE = '23503';
      END IF;

      INSERT INTO public.usuario_familias_sucursal (
        usuario_id,
        organizacion_id,
        sucursal_id,
        familia_id,
        activo
      )
      VALUES (
        p_usuario_id,
        v_org,
        p_sucursal_id,
        v_familia,
        true
      )
      ON CONFLICT (usuario_id, sucursal_id, familia_id)
      DO UPDATE SET
        activo = true,
        organizacion_id = EXCLUDED.organizacion_id,
        updated_at = now();
      -- Si la familia ya tiene OTRO responsable activo, el índice único parcial
      -- aborta toda la función y revierte perfil + acceso + asignaciones.
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'usuario_id', p_usuario_id,
    'sucursal_id', p_sucursal_id,
    'rol', p_rol_legacy,
    'rol_scope', v_rol_scope,
    'activo', p_activo,
    'familias', CASE
      WHEN p_rol_legacy = 'operador' AND p_activo THEN COALESCE(array_length(p_familias, 1), 0)
      ELSE 0
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_usuario_sucursal_admin_v1(
  uuid, uuid, uuid, text, text, boolean, uuid[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_usuario_sucursal_admin_v1(
  uuid, uuid, uuid, text, text, boolean, uuid[]
) TO service_role;

COMMENT ON FUNCTION public.listar_admin_sucursal_v1(uuid, uuid) IS
  'Server-only: payload de administración de usuarios y familias de una sucursal autorizada.';
COMMENT ON FUNCTION public.guardar_usuario_sucursal_admin_v1(uuid, uuid, uuid, text, text, boolean, uuid[]) IS
  'Server-only: guarda perfil, acceso de sucursal y familias de operador en una transacción.';

COMMIT;