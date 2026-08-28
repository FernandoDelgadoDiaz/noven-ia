-- =============================================================================
-- NOVEN · LOCAL USER INVITATIONS V1
--
-- Extiende el contrato seguro de invitaciones a Supervisor y Operador.
-- La cuenta, acceso local y familias del operador quedan INACTIVOS hasta que la
-- persona acepte la invitación y defina su propia contraseña en /activar.
-- =============================================================================

BEGIN;

ALTER TABLE public.invitaciones_acceso
  ADD COLUMN IF NOT EXISTS familias_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

ALTER TABLE public.invitaciones_acceso
  DROP CONSTRAINT IF EXISTS invitaciones_acceso_rol_check,
  DROP CONSTRAINT IF EXISTS invitaciones_acceso_scope_valido;

ALTER TABLE public.invitaciones_acceso
  ADD CONSTRAINT invitaciones_acceso_rol_check
  CHECK (rol IN ('gerente_zonal','gerente_sucursal','supervisor','operador')),
  ADD CONSTRAINT invitaciones_acceso_scope_valido
  CHECK (
    (
      rol = 'gerente_zonal'
      AND zona_id IS NOT NULL
      AND sucursal_id IS NULL
      AND cardinality(familias_ids) = 0
    )
    OR
    (
      rol IN ('gerente_sucursal','supervisor')
      AND zona_id IS NULL
      AND sucursal_id IS NOT NULL
      AND cardinality(familias_ids) = 0
    )
    OR
    (
      rol = 'operador'
      AND zona_id IS NULL
      AND sucursal_id IS NOT NULL
      AND cardinality(familias_ids) > 0
    )
  );

CREATE OR REPLACE FUNCTION public.registrar_invitacion_local_v1(
  p_actor_id uuid,
  p_usuario_id uuid,
  p_email text,
  p_nombre text,
  p_rol text,
  p_sucursal_id uuid,
  p_familias uuid[] DEFAULT ARRAY[]::uuid[],
  p_canal text DEFAULT 'link'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_org uuid;
  v_zona uuid;
  v_puede boolean;
  v_familias uuid[] := ARRAY[]::uuid[];
  v_familia uuid;
  v_invitacion_id uuid;
  v_expires_at timestamptz := now() + interval '72 hours';
BEGIN
  IF nullif(btrim(coalesce(p_nombre, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre es obligatorio' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_email, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El email es obligatorio' USING ERRCODE = '22023';
  END IF;
  IF p_rol NOT IN ('supervisor','operador') THEN
    RAISE EXCEPTION 'Rol local de invitación inválido' USING ERRCODE = '22023';
  END IF;
  IF p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'La sucursal es obligatoria' USING ERRCODE = '22023';
  END IF;
  IF p_canal NOT IN ('link','email') THEN
    RAISE EXCEPTION 'Canal de invitación inválido' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_usuario_id) THEN
    RAISE EXCEPTION 'La cuenta ya está registrada en Noven' USING ERRCODE = '23505';
  END IF;

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

  IF p_rol = 'operador' THEN
    SELECT coalesce(array_agg(DISTINCT x ORDER BY x), ARRAY[]::uuid[])
      INTO v_familias
    FROM unnest(coalesce(p_familias, ARRAY[]::uuid[])) AS t(x);

    IF cardinality(v_familias) = 0 THEN
      RAISE EXCEPTION 'El operador requiere al menos una familia responsable'
        USING ERRCODE = '22023';
    END IF;

    FOREACH v_familia IN ARRAY v_familias LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.familias f
        WHERE f.id = v_familia
          AND f.organizacion_id = v_org
      ) THEN
        RAISE EXCEPTION 'Familia % no pertenece a la organización', v_familia
          USING ERRCODE = '23503';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.usuario_familias_sucursal ufs
        WHERE ufs.sucursal_id = p_sucursal_id
          AND ufs.familia_id = v_familia
          AND ufs.activo = true
      ) THEN
        RAISE EXCEPTION 'Una o más familias ya tienen otro operador responsable en esta sucursal'
          USING ERRCODE = '23505';
      END IF;
    END LOOP;
  END IF;

  -- Reutiliza el escritor local endurecido para crear perfil + acceso INACTIVOS.
  PERFORM public.guardar_usuario_sucursal_admin_v1(
    p_actor_id,
    p_sucursal_id,
    p_usuario_id,
    btrim(p_nombre),
    p_rol,
    false,
    ARRAY[]::uuid[]
  );

  IF p_rol = 'operador' THEN
    FOREACH v_familia IN ARRAY v_familias LOOP
      INSERT INTO public.usuario_familias_sucursal(
        usuario_id, organizacion_id, sucursal_id, familia_id, activo
      ) VALUES (
        p_usuario_id, v_org, p_sucursal_id, v_familia, false
      )
      ON CONFLICT(usuario_id, sucursal_id, familia_id) DO UPDATE SET
        organizacion_id = excluded.organizacion_id,
        activo = false,
        updated_at = now();
    END LOOP;
  END IF;

  INSERT INTO public.invitaciones_acceso(
    usuario_id, organizacion_id, email, nombre, rol, zona_id, sucursal_id,
    creado_por, canal, estado, expires_at, familias_ids
  ) VALUES (
    p_usuario_id,
    v_org,
    lower(btrim(p_email)),
    btrim(p_nombre),
    p_rol,
    NULL,
    p_sucursal_id,
    p_actor_id,
    p_canal,
    'pendiente',
    v_expires_at,
    CASE WHEN p_rol = 'operador' THEN v_familias ELSE ARRAY[]::uuid[] END
  )
  RETURNING id INTO v_invitacion_id;

  RETURN jsonb_build_object(
    'invitacion_id', v_invitacion_id,
    'usuario_id', p_usuario_id,
    'rol', p_rol,
    'organizacion_id', v_org,
    'sucursal_id', p_sucursal_id,
    'familias_ids', CASE WHEN p_rol = 'operador' THEN to_jsonb(v_familias) ELSE '[]'::jsonb END,
    'estado', 'pendiente',
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_invitacion_local_v1(uuid,uuid,text,text,text,uuid,uuid[],text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_invitacion_local_v1(uuid,uuid,text,text,text,uuid,uuid[],text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.aceptar_invitacion_acceso_v1()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT lower(btrim(u.email))
    INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.invitaciones_acceso ia
  SET estado = 'anulada',
      anulada_at = COALESCE(ia.anulada_at, now())
  WHERE ia.usuario_id = v_uid
    AND ia.estado = 'pendiente'
    AND ia.expires_at <= now();

  SELECT count(*)
    INTO v_count
  FROM public.invitaciones_acceso ia
  WHERE ia.usuario_id = v_uid
    AND lower(btrim(ia.email)) = v_email
    AND ia.estado = 'pendiente'
    AND ia.expires_at > now();

  IF v_count = 0 THEN
    RETURN 0;
  END IF;

  -- Si una familia cambió de responsable mientras la invitación estaba pendiente,
  -- no aceptamos parcialmente la cuenta: toda la transacción se revierte.
  IF EXISTS (
    SELECT 1
    FROM public.invitaciones_acceso ia
    CROSS JOIN LATERAL unnest(ia.familias_ids) AS fam(familia_id)
    JOIN public.usuario_familias_sucursal ufs
      ON ufs.sucursal_id = ia.sucursal_id
     AND ufs.familia_id = fam.familia_id
     AND ufs.activo = true
     AND ufs.usuario_id <> v_uid
    WHERE ia.usuario_id = v_uid
      AND lower(btrim(ia.email)) = v_email
      AND ia.rol = 'operador'
      AND ia.estado = 'pendiente'
      AND ia.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Una o más familias ya tienen otro operador responsable en esta sucursal'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.usuario_accesos ua
  SET activo = true,
      updated_at = now()
  WHERE ua.usuario_id = v_uid
    AND ua.activo = false
    AND EXISTS (
      SELECT 1
      FROM public.invitaciones_acceso ia
      WHERE ia.usuario_id = ua.usuario_id
        AND lower(btrim(ia.email)) = v_email
        AND ia.organizacion_id = ua.organizacion_id
        AND ia.rol = ua.rol
        AND ia.estado = 'pendiente'
        AND ia.expires_at > now()
        AND (
          (
            ia.rol = 'gerente_zonal'
            AND ia.zona_id = ua.zona_id
            AND ua.sucursal_id IS NULL
          )
          OR
          (
            ia.rol IN ('gerente_sucursal','supervisor','operador')
            AND ia.sucursal_id = ua.sucursal_id
            AND ua.zona_id IS NULL
          )
        )
    );

  UPDATE public.usuario_familias_sucursal ufs
  SET activo = true,
      updated_at = now()
  WHERE ufs.usuario_id = v_uid
    AND ufs.activo = false
    AND EXISTS (
      SELECT 1
      FROM public.invitaciones_acceso ia
      WHERE ia.usuario_id = ufs.usuario_id
        AND lower(btrim(ia.email)) = v_email
        AND ia.organizacion_id = ufs.organizacion_id
        AND ia.sucursal_id = ufs.sucursal_id
        AND ia.rol = 'operador'
        AND ufs.familia_id = ANY(ia.familias_ids)
        AND ia.estado = 'pendiente'
        AND ia.expires_at > now()
    );

  UPDATE public.usuarios
  SET activo = true
  WHERE id = v_uid;

  UPDATE public.invitaciones_acceso ia
  SET estado = 'aceptada',
      accepted_at = now()
  WHERE ia.usuario_id = v_uid
    AND lower(btrim(ia.email)) = v_email
    AND ia.estado = 'pendiente'
    AND ia.expires_at > now();

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.aceptar_invitacion_acceso_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceptar_invitacion_acceso_v1() TO authenticated, service_role;

COMMENT ON COLUMN public.invitaciones_acceso.familias_ids IS
  'Familias preasignadas al operador durante la invitación; se activan sólo al aceptar.';

COMMENT ON FUNCTION public.registrar_invitacion_local_v1(uuid,uuid,text,text,text,uuid,uuid[],text) IS
  'Registra invitaciones locales seguras para Supervisor u Operador, dejando perfil, acceso y familias inactivos hasta aceptación.';

COMMIT;
