-- =============================================================================
-- NOVEN · FRONTERA DE ADMINISTRACIÓN LOCAL V2
--
-- El perfil `usuarios.activo` es global (ciclo de vida de la cuenta).
-- La pantalla Admin de sucursal sólo puede administrar accesos locales ya
-- existentes de Supervisor/Operador. Los gerentes se gestionan desde Accesos
-- y jerarquía, y los usuarios nuevos nacen exclusivamente por invitación.
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
  v_actor_nivel integer := 0;
BEGIN
  SELECT s.organizacion_id, s.zona_id
  INTO v_org, v_zona
  FROM public.sucursales s
  WHERE s.id = p_sucursal_id
    AND s.activa = true;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sucursal inexistente o inactiva' USING ERRCODE = 'P0002';
  END IF;

  -- Un acceso activo no alcanza si el perfil global fue desactivado.
  SELECT COALESCE(MAX(CASE
    WHEN ua.rol = 'admin_organizacion' THEN 3
    WHEN ua.rol = 'gerente_zonal' AND ua.zona_id = v_zona THEN 2
    WHEN ua.rol = 'gerente_sucursal' AND ua.sucursal_id = p_sucursal_id THEN 1
    ELSE 0
  END), 0)
  INTO v_actor_nivel
  FROM public.usuarios actor
  JOIN public.usuario_accesos ua
    ON ua.usuario_id = actor.id
   AND ua.organizacion_id = v_org
   AND ua.activo = true
  WHERE actor.id = p_actor_id
    AND actor.activo = true;

  IF v_actor_nivel = 0 THEN
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
          -- Estado que esta pantalla administra: acceso LOCAL.
          'activo', ua.activo,
          -- Estado global visible sólo para explicar por qué una invitación
          -- pendiente no puede habilitarse localmente.
          'perfil_activo', u.activo,
          'editable', (u.activo AND ua.rol IN ('supervisor', 'operador')),
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
  v_actor_nivel integer := 0;
  v_rol_actual text;
  v_perfil_activo boolean;
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

  SELECT COALESCE(MAX(CASE
    WHEN ua.rol = 'admin_organizacion' THEN 3
    WHEN ua.rol = 'gerente_zonal' AND ua.zona_id = v_zona THEN 2
    WHEN ua.rol = 'gerente_sucursal' AND ua.sucursal_id = p_sucursal_id THEN 1
    ELSE 0
  END), 0)
  INTO v_actor_nivel
  FROM public.usuarios actor
  JOIN public.usuario_accesos ua
    ON ua.usuario_id = actor.id
   AND ua.organizacion_id = v_org
   AND ua.activo = true
  WHERE actor.id = p_actor_id
    AND actor.activo = true;

  IF v_actor_nivel = 0 THEN
    RAISE EXCEPTION 'Sin permiso para administrar usuarios de esta sucursal'
      USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(COALESCE(p_nombre, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre es obligatorio' USING ERRCODE = '22023';
  END IF;

  -- Esta RPC local nunca crea ni promueve gerentes. Ese rol pertenece al flujo
  -- jerárquico de Accesos + invitaciones.
  IF p_rol_legacy NOT IN ('supervisor', 'operador') THEN
    RAISE EXCEPTION 'Los gerentes de sucursal se gestionan desde Accesos y jerarquía'
      USING ERRCODE = '42501';
  END IF;

  -- Debe existir tanto el perfil como un acceso LOCAL previo. Esto impide usar
  -- un UUID conocido para adjuntar a alguien directamente sin invitación.
  SELECT u.activo, ua.rol
  INTO v_perfil_activo, v_rol_actual
  FROM public.usuarios u
  JOIN public.usuario_accesos ua
    ON ua.usuario_id = u.id
   AND ua.organizacion_id = v_org
   AND ua.sucursal_id = p_sucursal_id
   AND ua.rol IN ('gerente_sucursal', 'supervisor', 'operador')
  WHERE u.id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario no tiene un acceso local existente en esta sucursal. Usá una invitación.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT v_perfil_activo THEN
    RAISE EXCEPTION 'La cuenta debe completar su activación antes de administrar el acceso local'
      USING ERRCODE = '42501';
  END IF;

  -- Los gerentes son sólo lectura en Admin local, aun para actores superiores.
  -- Su alta/cambio/baja se resuelve en la administración jerárquica.
  IF v_rol_actual = 'gerente_sucursal' THEN
    RAISE EXCEPTION 'Los gerentes de sucursal se gestionan desde Accesos y jerarquía'
      USING ERRCODE = '42501';
  END IF;

  v_rol_scope := CASE p_rol_legacy
    WHEN 'supervisor' THEN 'supervisor'
    ELSE 'operador'
  END;

  -- El nombre es identidad de cuenta y puede corregirse; el estado global,
  -- rol legacy y sucursal legacy NO se modifican desde este flujo local.
  UPDATE public.usuarios u
  SET nombre = btrim(p_nombre)
  WHERE u.id = p_usuario_id;

  UPDATE public.usuario_accesos ua
  SET rol = v_rol_scope,
      activo = p_activo,
      updated_at = now()
  WHERE ua.usuario_id = p_usuario_id
    AND ua.organizacion_id = v_org
    AND ua.sucursal_id = p_sucursal_id
    AND ua.rol IN ('supervisor', 'operador');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El acceso local cambió durante la edición. Volvé a cargar la pantalla.'
      USING ERRCODE = '40001';
  END IF;

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
  'Server-only: lista usuarios locales; activo representa usuario_accesos.activo y gerentes son sólo lectura.';
COMMENT ON FUNCTION public.guardar_usuario_sucursal_admin_v1(uuid, uuid, uuid, text, text, boolean, uuid[]) IS
  'Server-only: edita sólo accesos locales existentes de Supervisor/Operador; nunca estado global ni gerentes.';

COMMIT;
