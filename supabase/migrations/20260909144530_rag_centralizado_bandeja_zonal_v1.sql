-- =============================================================================
-- NOVEN · RAG CENTRALIZADO · ALTA Y BANDEJA ZONAL V1
--
-- - habilita el alta de administrativa_precios_zonal con zona obligatoria;
-- - informa la cobertura gerencial de cada zona sin volverla bloqueante;
-- - expone una bandeja limitada a las zonas activas de la administrativa;
-- - permite marcar una solicitud como ejecutada, de a una e idempotentemente.
--
-- Solicitar o ejecutar nunca abre una intervención RAG. La confirmación física
-- en góndola continúa fuera de este bloque.
-- =============================================================================

BEGIN;

-- --- 1. La invitación zonal admite el rol de propósito único ----------------

ALTER TABLE public.invitaciones_acceso
  DROP CONSTRAINT IF EXISTS invitaciones_acceso_rol_check,
  DROP CONSTRAINT IF EXISTS invitaciones_acceso_scope_valido;

ALTER TABLE public.invitaciones_acceso
  ADD CONSTRAINT invitaciones_acceso_rol_check
  CHECK (rol IN (
    'gerente_zonal', 'administrativa_precios_zonal',
    'gerente_sucursal', 'supervisor', 'operador'
  )),
  ADD CONSTRAINT invitaciones_acceso_scope_valido
  CHECK (
    (
      rol IN ('gerente_zonal', 'administrativa_precios_zonal')
      AND zona_id IS NOT NULL
      AND sucursal_id IS NULL
      AND cardinality(familias_ids) = 0
    )
    OR
    (
      rol IN ('gerente_sucursal', 'supervisor')
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

-- Accesos y jerarquía recibe sólo nombres y estados necesarios para mostrar la
-- cobertura de cada zona. La falta de gerente se informa; no invalida el alta.
CREATE OR REPLACE FUNCTION public.listar_contexto_altas_v1(p_actor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'noven_private'
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT ua.organizacion_id INTO v_org
  FROM public.usuario_accesos ua
  WHERE ua.usuario_id = p_actor_id
    AND ua.rol = 'admin_organizacion'
    AND ua.activo = true
    AND noven_private.es_administrador_jerarquia_v1(p_actor_id, ua.organizacion_id)
  ORDER BY ua.created_at
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sin permiso para administrar accesos y jerarquía'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'puede_crear_zonal', true,
    'regiones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'codigo', r.codigo,
        'nombre', r.nombre,
        'organizacion_id', r.organizacion_id
      ) ORDER BY r.nombre)
      FROM public.regiones r
      WHERE r.organizacion_id = v_org AND r.activa = true
    ), '[]'::jsonb),
    'zonas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', z.id,
        'codigo', z.codigo,
        'nombre', z.nombre,
        'region_id', z.region_id,
        'organizacion_id', z.organizacion_id
      ) ORDER BY z.nombre)
      FROM public.zonas z
      WHERE z.organizacion_id = v_org AND z.activa = true
    ), '[]'::jsonb),
    'sucursales', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'codigo', s.codigo,
        'nombre', s.nombre,
        'zona_id', s.zona_id,
        'organizacion_id', s.organizacion_id
      ) ORDER BY s.codigo)
      FROM public.sucursales s
      WHERE s.organizacion_id = v_org AND s.activa = true
    ), '[]'::jsonb),
    'cobertura_zonal', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'zona_id', z.id,
        'gerentes_zonales', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'usuario_id', u.id,
            'nombre', u.nombre
          ) ORDER BY u.nombre)
          FROM public.usuario_accesos ua
          JOIN public.usuarios u
            ON u.id = ua.usuario_id AND u.activo = true
          WHERE ua.organizacion_id = v_org
            AND ua.zona_id = z.id
            AND ua.rol = 'gerente_zonal'
            AND ua.activo = true
        ), '[]'::jsonb),
        'gerentes_zonales_pendientes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'invitacion_id', ia.id,
            'nombre', ia.nombre
          ) ORDER BY ia.created_at)
          FROM public.invitaciones_acceso ia
          WHERE ia.organizacion_id = v_org
            AND ia.zona_id = z.id
            AND ia.rol = 'gerente_zonal'
            AND ia.estado = 'pendiente'
            AND ia.expires_at > now()
        ), '[]'::jsonb),
        'administrativas_precios', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'usuario_id', u.id,
            'nombre', u.nombre
          ) ORDER BY u.nombre)
          FROM public.usuario_accesos ua
          JOIN public.usuarios u
            ON u.id = ua.usuario_id AND u.activo = true
          WHERE ua.organizacion_id = v_org
            AND ua.zona_id = z.id
            AND ua.rol = 'administrativa_precios_zonal'
            AND ua.activo = true
        ), '[]'::jsonb),
        'administrativas_precios_pendientes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'invitacion_id', ia.id,
            'nombre', ia.nombre
          ) ORDER BY ia.created_at)
          FROM public.invitaciones_acceso ia
          WHERE ia.organizacion_id = v_org
            AND ia.zona_id = z.id
            AND ia.rol = 'administrativa_precios_zonal'
            AND ia.estado = 'pendiente'
            AND ia.expires_at > now()
        ), '[]'::jsonb)
      ) ORDER BY z.nombre)
      FROM public.zonas z
      WHERE z.organizacion_id = v_org AND z.activa = true
    ), '[]'::jsonb),
    'accesos_actor', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'rol', ua.rol,
        'organizacion_id', ua.organizacion_id,
        'zona_id', ua.zona_id,
        'sucursal_id', ua.sucursal_id
      ) ORDER BY ua.created_at)
      FROM public.usuario_accesos ua
      WHERE ua.usuario_id = p_actor_id
        AND ua.organizacion_id = v_org
        AND ua.activo = true
    ), '[]'::jsonb)
  );
END;
$$;

-- --- 2. Bandeja estrictamente zonal ----------------------------------------

CREATE OR REPLACE FUNCTION noven_private.listar_bandeja_rag_zonal_impl()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.rol = 'administrativa_precios_zonal'
     AND ua.zona_id IS NOT NULL
     AND ua.sucursal_id IS NULL
     AND ua.activo = true
    WHERE u.id = v_uid AND u.activo = true
  ) THEN
    RAISE EXCEPTION 'Sin permiso para la bandeja zonal de precios'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'zonas', COALESCE((
      SELECT jsonb_agg(to_jsonb(zonas_actor) ORDER BY zonas_actor.nombre)
      FROM (
        SELECT DISTINCT z.id, z.codigo, z.nombre, z.organizacion_id
        FROM public.usuario_accesos ua
        JOIN public.usuarios u
          ON u.id = ua.usuario_id AND u.activo = true
        JOIN public.zonas z
          ON z.id = ua.zona_id
         AND z.organizacion_id = ua.organizacion_id
         AND z.activa = true
        WHERE ua.usuario_id = v_uid
          AND ua.rol = 'administrativa_precios_zonal'
          AND ua.activo = true
      ) zonas_actor
    ), '[]'::jsonb),
    'solicitudes', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(bandeja)
        ORDER BY
          bandeja.sucursal_codigo,
          bandeja.sector_nombre,
          bandeja.familia_nombre,
          bandeja.fin_accion,
          bandeja.creada_at
      )
      FROM (
        SELECT DISTINCT ON (s.id)
          s.id,
          s.organizacion_id,
          s.zona_id,
          z.nombre AS zona_nombre,
          s.sucursal_id,
          suc.codigo AS sucursal_codigo,
          suc.nombre AS sucursal_nombre,
          s.producto_id,
          s.vencimiento_id,
          s.producto_codigo,
          s.producto_descripcion,
          s.sector_nombre,
          s.familia_nombre,
          s.porcentaje_rag_vigente,
          s.porcentaje_solicitado,
          s.fecha_vencimiento,
          s.fin_accion,
          s.cantidad_comprometida,
          s.creada_at,
          s.ultimo_evento,
          s.ultimo_evento_at,
          s.habilitada_desde,
          s.estado_actual,
          solicitante.nombre AS validada_por_nombre,
          (s.ultimo_evento IN ('solicitada', 'no_aplicada')) AS requiere_ejecucion
        FROM public.v_solicitudes_cambio_rag_actual s
        JOIN public.usuario_accesos ua
          ON ua.usuario_id = v_uid
         AND ua.organizacion_id = s.organizacion_id
         AND ua.zona_id = s.zona_id
         AND ua.rol = 'administrativa_precios_zonal'
         AND ua.sucursal_id IS NULL
         AND ua.activo = true
        JOIN public.usuarios actor
          ON actor.id = ua.usuario_id AND actor.activo = true
        JOIN public.zonas z
          ON z.id = s.zona_id AND z.organizacion_id = s.organizacion_id
        JOIN public.sucursales suc
          ON suc.id = s.sucursal_id
         AND suc.zona_id = s.zona_id
         AND suc.organizacion_id = s.organizacion_id
        JOIN public.usuarios solicitante ON solicitante.id = s.solicitada_por
        WHERE s.ultimo_evento IN ('solicitada', 'no_aplicada', 'ejecutada')
          AND (
            s.ultimo_evento <> 'ejecutada'
            OR s.ultimo_evento_at >= now() - interval '24 hours'
          )
        ORDER BY s.id, ua.created_at
      ) bandeja
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_bandeja_rag_zonal()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT noven_private.listar_bandeja_rag_zonal_impl();
$$;

-- --- 3. Ejecución individual, atómica e idempotente ------------------------

CREATE OR REPLACE FUNCTION noven_private.ejecutar_solicitud_cambio_rag_impl(
  p_solicitud_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_solicitud public.solicitudes_cambio_rag%ROWTYPE;
  v_ultimo public.solicitud_cambio_rag_eventos%ROWTYPE;
  v_evento_id bigint;
  v_ocurrida_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_solicitud_id IS NULL THEN
    RAISE EXCEPTION 'La solicitud es obligatoria' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_solicitud
  FROM public.solicitudes_cambio_rag s
  WHERE s.id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud RAG inexistente' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = v_solicitud.organizacion_id
     AND ua.zona_id = v_solicitud.zona_id
     AND ua.rol = 'administrativa_precios_zonal'
     AND ua.sucursal_id IS NULL
     AND ua.activo = true
    WHERE u.id = v_uid AND u.activo = true
  ) THEN
    RAISE EXCEPTION 'Sin permiso para ejecutar solicitudes de esta zona'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ultimo
  FROM public.solicitud_cambio_rag_eventos e
  WHERE e.solicitud_id = p_solicitud_id
  ORDER BY e.id DESC
  LIMIT 1;

  IF v_ultimo.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud RAG sin evento inicial' USING ERRCODE = '23514';
  END IF;

  -- Doble click o reintento de red: devolver el evento vigente sin duplicarlo.
  IF v_ultimo.tipo = 'ejecutada' THEN
    RETURN v_ultimo.id;
  END IF;

  IF v_ultimo.tipo NOT IN ('solicitada', 'no_aplicada') THEN
    RAISE EXCEPTION 'La solicitud ya no admite ejecución'
      USING ERRCODE = '23514';
  END IF;

  -- Se toma después de adquirir el lock: una espera concurrente nunca puede
  -- producir un evento anterior al que terminó mientras esta llamada esperaba.
  v_ocurrida_at := clock_timestamp();

  INSERT INTO public.solicitud_cambio_rag_eventos(
    solicitud_id, tipo, actor_id, ocurrida_at, habilitada_desde
  ) VALUES (
    p_solicitud_id,
    'ejecutada',
    v_uid,
    v_ocurrida_at,
    (v_ocurrida_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 1
  ) RETURNING id INTO v_evento_id;

  RETURN v_evento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ejecutar_solicitud_cambio_rag(
  p_solicitud_id uuid
)
RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT noven_private.ejecutar_solicitud_cambio_rag_impl(p_solicitud_id);
$$;

-- --- 4. ACL explícita -------------------------------------------------------

REVOKE ALL ON FUNCTION public.listar_contexto_altas_v1(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_contexto_altas_v1(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.registrar_invitacion_acceso_v1(
  uuid, uuid, text, text, text, uuid, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_invitacion_acceso_v1(
  uuid, uuid, text, text, text, uuid, uuid, text
) TO service_role;

REVOKE ALL ON FUNCTION public.aceptar_invitacion_acceso_v1()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceptar_invitacion_acceso_v1()
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION noven_private.puede_gestionar_invitacion_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION noven_private.puede_gestionar_invitacion_v1(uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.listar_invitaciones_gestion_v1(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_invitaciones_gestion_v1(uuid, text, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION noven_private.listar_bandeja_rag_zonal_impl()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION noven_private.listar_bandeja_rag_zonal_impl()
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.listar_bandeja_rag_zonal()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.listar_bandeja_rag_zonal()
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION noven_private.ejecutar_solicitud_cambio_rag_impl(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION noven_private.ejecutar_solicitud_cambio_rag_impl(uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ejecutar_solicitud_cambio_rag(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ejecutar_solicitud_cambio_rag(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.listar_bandeja_rag_zonal() IS
  'Devuelve zonas y solicitudes activas exclusivamente para la administración zonal de precios autenticada.';
COMMENT ON FUNCTION public.ejecutar_solicitud_cambio_rag(uuid) IS
  'Marca individualmente una solicitud RAG como ejecutada; no abre la intervención ni confirma góndola.';

-- La activación reconoce ambos roles zonales y conserva el alcance inactivo
-- hasta que la persona acepte la invitación con el mismo email de Auth.
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

  SELECT lower(btrim(u.email)) INTO v_email
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

  SELECT count(*) INTO v_count
  FROM public.invitaciones_acceso ia
  WHERE ia.usuario_id = v_uid
    AND lower(btrim(ia.email)) = v_email
    AND ia.estado = 'pendiente'
    AND ia.expires_at > now();

  IF v_count = 0 THEN
    RETURN 0;
  END IF;

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
            ia.rol IN ('gerente_zonal', 'administrativa_precios_zonal')
            AND ia.zona_id = ua.zona_id
            AND ua.sucursal_id IS NULL
          )
          OR
          (
            ia.rol IN ('gerente_sucursal', 'supervisor', 'operador')
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

-- La gestión de pendientes jerárquicos incluye el rol nuevo. Sólo la cuenta
-- administradora de la organización puede anularlo o regenerarlo.
CREATE OR REPLACE FUNCTION noven_private.puede_gestionar_invitacion_v1(
  p_actor_id uuid,
  p_invitacion_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.invitaciones_acceso ia
    JOIN public.usuarios actor
      ON actor.id = p_actor_id AND actor.activo = true
    WHERE ia.id = p_invitacion_id
      AND (
        (
          ia.rol IN (
            'gerente_zonal', 'administrativa_precios_zonal', 'gerente_sucursal'
          )
          AND noven_private.es_administrador_jerarquia_v1(
            p_actor_id, ia.organizacion_id
          )
        )
        OR (
          ia.rol IN ('supervisor', 'operador')
          AND EXISTS (
            SELECT 1
            FROM public.usuario_accesos ua_local
            WHERE ua_local.usuario_id = p_actor_id
              AND ua_local.organizacion_id = ia.organizacion_id
              AND ua_local.rol = 'gerente_sucursal'
              AND ua_local.sucursal_id = ia.sucursal_id
              AND ua_local.activo = true
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.listar_invitaciones_gestion_v1(
  p_actor_id uuid,
  p_tipo text DEFAULT 'todas',
  p_sucursal_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'noven_private'
AS $$
BEGIN
  IF p_tipo NOT IN ('todas', 'jerarquia', 'local') THEN
    RAISE EXCEPTION 'Tipo de listado de invitaciones inválido'
      USING ERRCODE = '22023';
  END IF;
  IF p_tipo = 'local' AND p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'La sucursal es obligatoria para invitaciones locales'
      USING ERRCODE = '22023';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ia.id,
        'usuario_id', ia.usuario_id,
        'email', ia.email,
        'nombre', ia.nombre,
        'rol', ia.rol,
        'canal', ia.canal,
        'estado', CASE
          WHEN ia.estado = 'pendiente' AND ia.expires_at <= now() THEN 'vencida'
          ELSE ia.estado
        END,
        'created_at', ia.created_at,
        'expires_at', ia.expires_at,
        'zona_id', ia.zona_id,
        'zona_nombre', z.nombre,
        'sucursal_id', ia.sucursal_id,
        'sucursal_codigo', s.codigo,
        'sucursal_nombre', s.nombre,
        'familias_ids', to_jsonb(ia.familias_ids),
        'creado_por', ia.creado_por,
        'creado_por_nombre', creador.nombre
      ) ORDER BY ia.created_at DESC
    )
    FROM public.invitaciones_acceso ia
    LEFT JOIN public.zonas z
      ON z.id = ia.zona_id AND z.organizacion_id = ia.organizacion_id
    LEFT JOIN public.sucursales s
      ON s.id = ia.sucursal_id AND s.organizacion_id = ia.organizacion_id
    LEFT JOIN public.usuarios creador ON creador.id = ia.creado_por
    WHERE ia.estado = 'pendiente'
      AND noven_private.puede_gestionar_invitacion_v1(p_actor_id, ia.id)
      AND (
        p_tipo = 'todas'
        OR (
          p_tipo = 'jerarquia'
          AND ia.rol IN (
            'gerente_zonal', 'administrativa_precios_zonal', 'gerente_sucursal'
          )
        )
        OR (
          p_tipo = 'local'
          AND ia.rol IN ('supervisor', 'operador')
          AND ia.sucursal_id = p_sucursal_id
        )
      )
  ), '[]'::jsonb);
END;
$$;


CREATE OR REPLACE FUNCTION public.registrar_invitacion_acceso_v1(
  p_actor_id uuid,
  p_usuario_id uuid,
  p_email text,
  p_nombre text,
  p_rol text,
  p_zona_id uuid DEFAULT NULL::uuid,
  p_sucursal_id uuid DEFAULT NULL::uuid,
  p_canal text DEFAULT 'link'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'noven_private'
AS $$
DECLARE
  v_org uuid;
  v_invitacion_id uuid;
  v_expires_at timestamptz := now() + interval '72 hours';
BEGIN
  IF nullif(btrim(coalesce(p_nombre, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre es obligatorio' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_email, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El email es obligatorio' USING ERRCODE = '22023';
  END IF;
  IF p_rol NOT IN (
    'gerente_zonal', 'administrativa_precios_zonal', 'gerente_sucursal'
  ) THEN
    RAISE EXCEPTION 'Rol de invitación inválido' USING ERRCODE = '22023';
  END IF;
  IF p_canal NOT IN ('link', 'email') THEN
    RAISE EXCEPTION 'Canal de invitación inválido' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_usuario_id) THEN
    RAISE EXCEPTION 'La cuenta ya está registrada en Noven' USING ERRCODE = '23505';
  END IF;

  IF p_rol IN ('gerente_zonal', 'administrativa_precios_zonal') THEN
    IF p_zona_id IS NULL OR p_sucursal_id IS NOT NULL THEN
      RAISE EXCEPTION 'El rol zonal requiere una zona' USING ERRCODE = '22023';
    END IF;
    SELECT z.organizacion_id INTO v_org
    FROM public.zonas z
    WHERE z.id = p_zona_id AND z.activa = true;
  ELSE
    IF p_sucursal_id IS NULL OR p_zona_id IS NOT NULL THEN
      RAISE EXCEPTION 'Gerente de sucursal requiere una sucursal'
        USING ERRCODE = '22023';
    END IF;
    SELECT s.organizacion_id INTO v_org
    FROM public.sucursales s
    WHERE s.id = p_sucursal_id AND s.activa = true;
  END IF;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Alcance inexistente o inactivo' USING ERRCODE = 'P0002';
  END IF;
  IF NOT noven_private.es_administrador_jerarquia_v1(p_actor_id, v_org) THEN
    RAISE EXCEPTION 'Sin permiso para administrar accesos y jerarquía'
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
    CASE
      WHEN p_rol IN ('gerente_zonal', 'administrativa_precios_zonal')
        THEN p_zona_id
      ELSE NULL
    END,
    CASE WHEN p_rol = 'gerente_sucursal' THEN p_sucursal_id ELSE NULL END,
    false
  );

  INSERT INTO public.invitaciones_acceso(
    usuario_id, organizacion_id, email, nombre, rol, zona_id, sucursal_id,
    creado_por, canal, estado, expires_at
  ) VALUES (
    p_usuario_id,
    v_org,
    lower(btrim(p_email)),
    btrim(p_nombre),
    p_rol,
    CASE
      WHEN p_rol IN ('gerente_zonal', 'administrativa_precios_zonal')
        THEN p_zona_id
      ELSE NULL
    END,
    CASE WHEN p_rol = 'gerente_sucursal' THEN p_sucursal_id ELSE NULL END,
    p_actor_id,
    p_canal,
    'pendiente',
    v_expires_at
  ) RETURNING id INTO v_invitacion_id;

  RETURN jsonb_build_object(
    'invitacion_id', v_invitacion_id,
    'usuario_id', p_usuario_id,
    'rol', p_rol,
    'organizacion_id', v_org,
    'zona_id', CASE
      WHEN p_rol IN ('gerente_zonal', 'administrativa_precios_zonal')
        THEN p_zona_id
      ELSE NULL
    END,
    'sucursal_id', CASE
      WHEN p_rol = 'gerente_sucursal' THEN p_sucursal_id
      ELSE NULL
    END,
    'estado', 'pendiente',
    'expires_at', v_expires_at
  );
END;
$$;

COMMIT;
