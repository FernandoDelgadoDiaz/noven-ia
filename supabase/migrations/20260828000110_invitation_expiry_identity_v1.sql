-- =============================================================================
-- NOVEN · INVITATION EXPIRY + IDENTITY V1
--
-- Las invitaciones de acceso tienen una vigencia propia de Noven de 72 horas.
-- La aceptación exige usuario autenticado, email coincidente, estado pendiente y
-- vigencia activa. Una invitación vencida se anula server-side y jamás habilita
-- usuario_accesos.
-- =============================================================================

BEGIN;

ALTER TABLE public.invitaciones_acceso
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.invitaciones_acceso
SET expires_at = created_at + interval '72 hours'
WHERE expires_at IS NULL;

ALTER TABLE public.invitaciones_acceso
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '72 hours'),
  ALTER COLUMN expires_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invitaciones_acceso_expira_despues_creacion'
      AND conrelid = 'public.invitaciones_acceso'::regclass
  ) THEN
    ALTER TABLE public.invitaciones_acceso
      ADD CONSTRAINT invitaciones_acceso_expira_despues_creacion
      CHECK (expires_at > created_at);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS invitaciones_acceso_pendiente_expira_idx
  ON public.invitaciones_acceso(usuario_id, expires_at)
  WHERE estado = 'pendiente';

CREATE OR REPLACE FUNCTION public.registrar_invitacion_acceso_v1(
  p_actor_id uuid,
  p_usuario_id uuid,
  p_email text,
  p_nombre text,
  p_rol text,
  p_zona_id uuid DEFAULT NULL,
  p_sucursal_id uuid DEFAULT NULL,
  p_canal text DEFAULT 'link'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_org uuid;
  v_zona_objetivo uuid;
  v_puede boolean;
  v_invitacion_id uuid;
  v_expires_at timestamptz := now() + interval '72 hours';
BEGIN
  IF nullif(btrim(coalesce(p_nombre, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre es obligatorio' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_email, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El email es obligatorio' USING ERRCODE = '22023';
  END IF;
  IF p_rol NOT IN ('gerente_zonal', 'gerente_sucursal') THEN
    RAISE EXCEPTION 'Rol de invitación inválido' USING ERRCODE = '22023';
  END IF;
  IF p_canal NOT IN ('link', 'email') THEN
    RAISE EXCEPTION 'Canal de invitación inválido' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_usuario_id) THEN
    RAISE EXCEPTION 'La cuenta ya está registrada en Noven' USING ERRCODE = '23505';
  END IF;

  IF p_rol = 'gerente_zonal' THEN
    IF p_zona_id IS NULL OR p_sucursal_id IS NOT NULL THEN
      RAISE EXCEPTION 'Gerente zonal requiere una zona' USING ERRCODE = '22023';
    END IF;

    SELECT z.organizacion_id, z.id
      INTO v_org, v_zona_objetivo
    FROM public.zonas z
    WHERE z.id = p_zona_id
      AND z.activa = true;
  ELSE
    IF p_sucursal_id IS NULL OR p_zona_id IS NOT NULL THEN
      RAISE EXCEPTION 'Gerente de sucursal requiere una sucursal' USING ERRCODE = '22023';
    END IF;

    SELECT s.organizacion_id, s.zona_id
      INTO v_org, v_zona_objetivo
    FROM public.sucursales s
    WHERE s.id = p_sucursal_id
      AND s.activa = true;
  END IF;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Alcance inexistente o inactivo' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_accesos ua
    WHERE ua.usuario_id = p_actor_id
      AND ua.organizacion_id = v_org
      AND ua.activo = true
      AND (
        ua.rol = 'admin_organizacion'
        OR (
          p_rol = 'gerente_sucursal'
          AND ua.rol = 'gerente_zonal'
          AND ua.zona_id = v_zona_objetivo
        )
      )
  ) INTO v_puede;

  IF NOT v_puede THEN
    RAISE EXCEPTION 'Sin permiso para crear este acceso' USING ERRCODE = '42501';
  END IF;

  IF p_rol = 'gerente_zonal' AND NOT EXISTS (
    SELECT 1
    FROM public.usuario_accesos ua
    WHERE ua.usuario_id = p_actor_id
      AND ua.organizacion_id = v_org
      AND ua.rol = 'admin_organizacion'
      AND ua.activo = true
  ) THEN
    RAISE EXCEPTION 'Solo el administrador de organización puede crear gerentes zonales'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.usuarios(id, nombre, rol, sucursal_id, activo)
  VALUES (
    p_usuario_id,
    btrim(p_nombre),
    CASE WHEN p_rol = 'gerente_sucursal' THEN 'admin' ELSE 'supervisor' END,
    CASE WHEN p_rol = 'gerente_sucursal' THEN p_sucursal_id ELSE NULL END,
    false
  );

  INSERT INTO public.usuario_accesos(
    usuario_id, organizacion_id, rol, zona_id, sucursal_id, activo
  ) VALUES (
    p_usuario_id,
    v_org,
    p_rol,
    CASE WHEN p_rol = 'gerente_zonal' THEN p_zona_id ELSE NULL END,
    CASE WHEN p_rol = 'gerente_sucursal' THEN p_sucursal_id ELSE NULL END,
    false
  );

  INSERT INTO public.invitaciones_acceso(
    usuario_id, organizacion_id, email, nombre, rol, zona_id, sucursal_id,
    creado_por, canal, estado, expires_at
  ) VALUES (
    p_usuario_id, v_org, lower(btrim(p_email)), btrim(p_nombre), p_rol,
    CASE WHEN p_rol = 'gerente_zonal' THEN p_zona_id ELSE NULL END,
    CASE WHEN p_rol = 'gerente_sucursal' THEN p_sucursal_id ELSE NULL END,
    p_actor_id, p_canal, 'pendiente', v_expires_at
  )
  RETURNING id INTO v_invitacion_id;

  RETURN jsonb_build_object(
    'invitacion_id', v_invitacion_id,
    'usuario_id', p_usuario_id,
    'rol', p_rol,
    'organizacion_id', v_org,
    'zona_id', CASE WHEN p_rol = 'gerente_zonal' THEN p_zona_id ELSE NULL END,
    'sucursal_id', CASE WHEN p_rol = 'gerente_sucursal' THEN p_sucursal_id ELSE NULL END,
    'estado', 'pendiente',
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_invitacion_acceso_v1(uuid,uuid,text,text,text,uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_invitacion_acceso_v1(uuid,uuid,text,text,text,uuid,uuid,text)
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

  -- Toda invitación propia que ya venció queda terminalmente anulada.
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
            ia.rol = 'gerente_sucursal'
            AND ia.sucursal_id = ua.sucursal_id
            AND ua.zona_id IS NULL
          )
        )
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

COMMENT ON COLUMN public.invitaciones_acceso.expires_at IS
  'Caducidad server-side propia de Noven. Por defecto 72 horas desde la creación.';

COMMENT ON FUNCTION public.aceptar_invitacion_acceso_v1() IS
  'Acepta sólo invitaciones propias, pendientes, no vencidas y cuyo email coincide con auth.users.';

COMMIT;
