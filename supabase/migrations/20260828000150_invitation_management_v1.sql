-- =============================================================================
-- NOVEN · INVITATION MANAGEMENT V1
--
-- Gestión auditable de invitaciones pendientes:
-- - listado limitado por jerarquía real;
-- - anulación server-side;
-- - preservación del historial aunque se elimine la cuenta Auth pendiente;
-- - soporte para regeneración desde Netlify sin reutilizar links viejos.
-- =============================================================================

BEGIN;

-- La invitación debe sobrevivir a la limpieza de una cuenta Auth pendiente.
ALTER TABLE public.invitaciones_acceso
  ALTER COLUMN usuario_id DROP NOT NULL;

ALTER TABLE public.invitaciones_acceso
  DROP CONSTRAINT IF EXISTS invitaciones_acceso_usuario_id_fkey;

ALTER TABLE public.invitaciones_acceso
  ADD CONSTRAINT invitaciones_acceso_usuario_id_fkey
  FOREIGN KEY (usuario_id)
  REFERENCES public.usuarios(id)
  ON DELETE SET NULL;

ALTER TABLE public.invitaciones_acceso
  ADD COLUMN IF NOT EXISTS auth_deleted_at timestamptz;

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
    LEFT JOIN public.sucursales s
      ON s.id = ia.sucursal_id
     AND s.organizacion_id = ia.organizacion_id
    WHERE ia.id = p_invitacion_id
      AND EXISTS (
        SELECT 1
        FROM public.usuario_accesos ua
        WHERE ua.usuario_id = p_actor_id
          AND ua.organizacion_id = ia.organizacion_id
          AND ua.activo = true
          AND (
            ua.rol = 'admin_organizacion'
            OR (
              ia.rol = 'gerente_sucursal'
              AND ua.rol = 'gerente_zonal'
              AND ua.zona_id = s.zona_id
            )
            OR (
              ia.rol IN ('supervisor','operador')
              AND (
                (ua.rol = 'gerente_zonal' AND ua.zona_id = s.zona_id)
                OR (ua.rol = 'gerente_sucursal' AND ua.sucursal_id = ia.sucursal_id)
              )
            )
          )
      )
  );
$$;

REVOKE ALL ON FUNCTION noven_private.puede_gestionar_invitacion_v1(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION noven_private.puede_gestionar_invitacion_v1(uuid,uuid)
  TO service_role;

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
  IF p_tipo NOT IN ('todas','jerarquia','local') THEN
    RAISE EXCEPTION 'Tipo de listado de invitaciones inválido' USING ERRCODE='22023';
  END IF;
  IF p_tipo = 'local' AND p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'La sucursal es obligatoria para invitaciones locales' USING ERRCODE='22023';
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
          WHEN ia.estado='pendiente' AND ia.expires_at<=now() THEN 'vencida'
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
      )
      ORDER BY ia.created_at DESC
    )
    FROM public.invitaciones_acceso ia
    LEFT JOIN public.zonas z
      ON z.id=ia.zona_id AND z.organizacion_id=ia.organizacion_id
    LEFT JOIN public.sucursales s
      ON s.id=ia.sucursal_id AND s.organizacion_id=ia.organizacion_id
    LEFT JOIN public.usuarios creador ON creador.id=ia.creado_por
    WHERE ia.estado='pendiente'
      AND noven_private.puede_gestionar_invitacion_v1(p_actor_id, ia.id)
      AND (
        p_tipo='todas'
        OR (p_tipo='jerarquia' AND ia.rol IN ('gerente_zonal','gerente_sucursal'))
        OR (p_tipo='local' AND ia.rol IN ('supervisor','operador') AND ia.sucursal_id=p_sucursal_id)
      )
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.listar_invitaciones_gestion_v1(uuid,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_invitaciones_gestion_v1(uuid,text,uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.obtener_invitacion_gestion_v1(
  p_actor_id uuid,
  p_invitacion_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'noven_private'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT noven_private.puede_gestionar_invitacion_v1(p_actor_id,p_invitacion_id) THEN
    RAISE EXCEPTION 'Sin permiso para gestionar esta invitación' USING ERRCODE='42501';
  END IF;

  SELECT jsonb_build_object(
    'id',ia.id,
    'usuario_id',ia.usuario_id,
    'organizacion_id',ia.organizacion_id,
    'email',ia.email,
    'nombre',ia.nombre,
    'rol',ia.rol,
    'zona_id',ia.zona_id,
    'sucursal_id',ia.sucursal_id,
    'familias_ids',to_jsonb(ia.familias_ids),
    'canal',ia.canal,
    'estado',ia.estado,
    'created_at',ia.created_at,
    'expires_at',ia.expires_at
  ) INTO v_result
  FROM public.invitaciones_acceso ia
  WHERE ia.id=p_invitacion_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Invitación inexistente' USING ERRCODE='P0002';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.obtener_invitacion_gestion_v1(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_invitacion_gestion_v1(uuid,uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.anular_invitacion_gestion_v1(
  p_actor_id uuid,
  p_invitacion_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'noven_private'
AS $$
DECLARE
  v_inv public.invitaciones_acceso%ROWTYPE;
  v_puede_eliminar_auth boolean;
BEGIN
  SELECT * INTO v_inv
  FROM public.invitaciones_acceso
  WHERE id=p_invitacion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitación inexistente' USING ERRCODE='P0002';
  END IF;
  IF NOT noven_private.puede_gestionar_invitacion_v1(p_actor_id,p_invitacion_id) THEN
    RAISE EXCEPTION 'Sin permiso para gestionar esta invitación' USING ERRCODE='42501';
  END IF;
  IF v_inv.estado='aceptada' THEN
    RAISE EXCEPTION 'Una invitación aceptada no puede anularse desde este flujo' USING ERRCODE='22023';
  END IF;

  IF v_inv.estado='pendiente' THEN
    UPDATE public.invitaciones_acceso
    SET estado='anulada', anulada_at=COALESCE(anulada_at,now())
    WHERE id=p_invitacion_id;
  END IF;

  v_puede_eliminar_auth := v_inv.usuario_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.usuario_accesos ua
      WHERE ua.usuario_id=v_inv.usuario_id AND ua.activo=true
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.invitaciones_acceso ia
      WHERE ia.usuario_id=v_inv.usuario_id
        AND ia.id<>p_invitacion_id
        AND ia.estado='aceptada'
    );

  RETURN jsonb_build_object(
    'invitacion_id',p_invitacion_id,
    'usuario_id',v_inv.usuario_id,
    'email',v_inv.email,
    'estado','anulada',
    'puede_eliminar_auth',v_puede_eliminar_auth
  );
END;
$$;

REVOKE ALL ON FUNCTION public.anular_invitacion_gestion_v1(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anular_invitacion_gestion_v1(uuid,uuid)
  TO service_role;

COMMENT ON FUNCTION public.listar_invitaciones_gestion_v1(uuid,text,uuid) IS
  'Lista únicamente invitaciones pendientes que el actor puede administrar por organización, zona o sucursal.';
COMMENT ON FUNCTION public.anular_invitacion_gestion_v1(uuid,uuid) IS
  'Anula una invitación dentro del alcance real del actor y devuelve si la cuenta Auth pendiente puede eliminarse de forma segura.';
COMMENT ON FUNCTION public.obtener_invitacion_gestion_v1(uuid,uuid) IS
  'Devuelve una invitación gestionable para anulación/regeneración server-side.';

COMMIT;
