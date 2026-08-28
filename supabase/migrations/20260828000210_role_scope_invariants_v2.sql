-- =============================================================================
-- NOVEN · INVARIANTES DE ROLES Y ALCANCE V2
--
-- Reglas de producto:
-- - gerente_sucursal: administra y opera únicamente su propia sucursal.
-- - gerente_zonal: lectura/seguimiento de su zona; nunca administra accesos.
-- - admin_organizacion: capacidad de jerarquía solamente cuando la misma cuenta
--   es además gerente_sucursal de la sucursal código 091.
-- - el rol jerárquico no amplía el alcance operativo de la cuenta.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION noven_private.es_administrador_jerarquia_v1(
  p_actor_id uuid,
  p_organizacion_id uuid
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
    JOIN public.usuario_accesos ua_admin
      ON ua_admin.usuario_id = u.id
     AND ua_admin.organizacion_id = p_organizacion_id
     AND ua_admin.rol = 'admin_organizacion'
     AND ua_admin.activo = true
    JOIN public.usuario_accesos ua_local
      ON ua_local.usuario_id = u.id
     AND ua_local.organizacion_id = p_organizacion_id
     AND ua_local.rol = 'gerente_sucursal'
     AND ua_local.activo = true
    JOIN public.sucursales s091
      ON s091.id = ua_local.sucursal_id
     AND s091.organizacion_id = p_organizacion_id
     AND s091.codigo = '091'
     AND s091.activa = true
    WHERE u.id = p_actor_id
      AND u.activo = true
  );
$$;

REVOKE ALL ON FUNCTION noven_private.es_administrador_jerarquia_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- El rol de jerarquía no concede acceso operativo a otras sucursales.
CREATE OR REPLACE FUNCTION noven_private.tiene_acceso_sucursal(p_sucursal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.sucursales s ON s.id = p_sucursal_id
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = s.organizacion_id
     AND ua.activo = true
    WHERE u.id = (SELECT auth.uid())
      AND u.activo = true
      AND (
        (ua.rol = 'gerente_zonal' AND ua.zona_id = s.zona_id)
        OR (
          ua.rol IN ('gerente_sucursal', 'supervisor', 'operador')
          AND ua.sucursal_id = s.id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION noven_private.tiene_acceso_zona(p_zona_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.zonas z ON z.id = p_zona_id
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = z.organizacion_id
     AND ua.activo = true
    WHERE u.id = (SELECT auth.uid())
      AND u.activo = true
      AND (
        (ua.rol = 'gerente_zonal' AND ua.zona_id = z.id)
        OR (
          ua.rol IN ('gerente_sucursal', 'supervisor', 'operador')
          AND EXISTS (
            SELECT 1
            FROM public.sucursales s
            WHERE s.id = ua.sucursal_id
              AND s.zona_id = z.id
              AND s.activa = true
          )
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
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.sucursales s ON s.id = p_sucursal_id
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
        (ua.rol = 'gerente_zonal' AND ua.zona_id = s.zona_id)
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

-- Radar zonal: el gerente zonal ve su zona; gerente/supervisor sólo su origen local.
CREATE OR REPLACE FUNCTION noven_private.listar_resumen_radar_zonal_v1_impl(p_zona_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
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
            (ua.rol = 'gerente_zonal' AND ua.zona_id = a.zona_id)
            OR (
              ua.rol IN ('gerente_sucursal', 'supervisor')
              AND ua.sucursal_id = a.sucursal_origen_id
            )
          )
      )
    GROUP BY a.id, a.zona_id, a.producto_id, a.fecha_vencimiento,
             a.nivel_origen, a.last_detected_at, p.cod_art, p.descripcion, so.codigo
  ) q;

  RETURN v_result;
END;
$$;

-- Fotos globales: un zonal puede verlas, pero no escribirlas.
CREATE OR REPLACE FUNCTION noven_private.puede_reemplazar_imagen_producto(
  p_sucursal_id uuid,
  p_producto_id uuid
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
    JOIN public.productos p ON p.id = p_producto_id
    JOIN public.sucursales s
      ON s.id = p_sucursal_id
     AND s.organizacion_id = p.organizacion_id
     AND s.activa = true
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = p.organizacion_id
     AND ua.activo = true
    WHERE u.id = (SELECT auth.uid())
      AND u.activo = true
      AND ua.rol IN ('gerente_sucursal', 'supervisor')
      AND ua.sucursal_id = s.id
  );
$$;

CREATE OR REPLACE FUNCTION noven_private.puede_insertar_imagen_catalogo_storage(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_org uuid;
  v_producto uuid;
  v_archivo text;
  v_imagen_actual text;
  v_visible_local boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RETURN false; END IF;
  IF pg_catalog.split_part(p_name, '/', 2) <> 'productos' THEN RETURN false; END IF;
  v_archivo := pg_catalog.split_part(p_name, '/', 4);
  IF v_archivo NOT IN ('full.webp', 'thumb.webp') THEN RETURN false; END IF;
  BEGIN
    v_org := pg_catalog.split_part(p_name, '/', 1)::uuid;
    v_producto := pg_catalog.split_part(p_name, '/', 3)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  SELECT p.imagen_url,
    EXISTS (
      SELECT 1
      FROM public.producto_sucursal ps
      JOIN public.usuario_accesos ua
        ON ua.usuario_id = (SELECT auth.uid())
       AND ua.organizacion_id = ps.organizacion_id
       AND ua.sucursal_id = ps.sucursal_id
       AND ua.activo = true
       AND ua.rol IN ('gerente_sucursal', 'supervisor', 'operador')
      WHERE ps.producto_id = p.id
        AND ps.organizacion_id = p.organizacion_id
        AND noven_private.puede_ver_producto_sucursal(ps.sucursal_id, p.id)
    )
  INTO v_imagen_actual, v_visible_local
  FROM public.productos p
  WHERE p.id = v_producto AND p.organizacion_id = v_org;

  IF NOT FOUND OR NOT COALESCE(v_visible_local, false) THEN RETURN false; END IF;
  IF NULLIF(btrim(COALESCE(v_imagen_actual, '')), '') IS NULL THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.producto_sucursal ps
    WHERE ps.producto_id = v_producto
      AND ps.organizacion_id = v_org
      AND noven_private.puede_reemplazar_imagen_producto(ps.sucursal_id, v_producto)
  );
END;
$$;

CREATE OR REPLACE FUNCTION noven_private.puede_actualizar_imagen_catalogo_storage(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_org uuid;
  v_producto uuid;
  v_imagen_actual text;
BEGIN
  IF NOT noven_private.puede_insertar_imagen_catalogo_storage(p_name) THEN RETURN false; END IF;
  BEGIN
    v_org := pg_catalog.split_part(p_name,'/',1)::uuid;
    v_producto := pg_catalog.split_part(p_name,'/',3)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN false;
  END;

  SELECT p.imagen_url INTO v_imagen_actual
  FROM public.productos p
  WHERE p.id = v_producto AND p.organizacion_id = v_org;

  IF NULLIF(btrim(COALESCE(v_imagen_actual,'')),'') IS NULL THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.producto_sucursal ps
    WHERE ps.producto_id = v_producto
      AND ps.organizacion_id = v_org
      AND noven_private.puede_reemplazar_imagen_producto(ps.sucursal_id, v_producto)
  );
END;
$$;

-- Administración local: exclusivamente el gerente de ESA sucursal.
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
BEGIN
  SELECT s.organizacion_id INTO v_org
  FROM public.sucursales s
  WHERE s.id = p_sucursal_id AND s.activa = true;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sucursal inexistente o inactiva' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios actor
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = actor.id
     AND ua.organizacion_id = v_org
     AND ua.rol = 'gerente_sucursal'
     AND ua.sucursal_id = p_sucursal_id
     AND ua.activo = true
    WHERE actor.id = p_actor_id
      AND actor.activo = true
  ) THEN
    RAISE EXCEPTION 'Sin permiso para administrar usuarios de esta sucursal' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'sucursal', (
      SELECT jsonb_build_object('id',s.id,'codigo',s.codigo,'nombre',s.nombre,'organizacion_id',s.organizacion_id)
      FROM public.sucursales s WHERE s.id = p_sucursal_id
    ),
    'familias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',f.id,'codigo',f.codigo,'nombre',f.nombre,'sector_id',f.sector_id) ORDER BY f.codigo,f.nombre)
      FROM public.familias f WHERE f.organizacion_id = v_org
    ), '[]'::jsonb),
    'sectores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',s.id,'codigo',s.codigo,'nombre',s.nombre) ORDER BY s.codigo,s.nombre)
      FROM public.sectores s WHERE s.organizacion_id = v_org
    ), '[]'::jsonb),
    'usuarios', COALESCE((
      SELECT jsonb_agg(item ORDER BY item->>'nombre')
      FROM (
        SELECT jsonb_build_object(
          'id',u.id,'nombre',u.nombre,'activo',ua.activo,'perfil_activo',u.activo,
          'editable',(u.activo AND ua.rol IN ('supervisor','operador')),
          'rol',CASE ua.rol WHEN 'gerente_sucursal' THEN 'admin' WHEN 'supervisor' THEN 'supervisor' ELSE 'operador' END,
          'rol_scope',ua.rol,
          'familias_ids',COALESCE((
            SELECT jsonb_agg(ufs.familia_id ORDER BY ufs.familia_id)
            FROM public.usuario_familias_sucursal ufs
            WHERE ufs.usuario_id=u.id AND ufs.sucursal_id=p_sucursal_id AND ufs.activo=true
          ),'[]'::jsonb)
        ) item
        FROM public.usuario_accesos ua
        JOIN public.usuarios u ON u.id=ua.usuario_id
        WHERE ua.organizacion_id=v_org
          AND ua.sucursal_id=p_sucursal_id
          AND ua.rol IN ('gerente_sucursal','supervisor','operador')
      ) q
    ), '[]'::jsonb)
  );
END;
$$;

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
  v_rol_actual text;
  v_perfil_activo boolean;
  v_rol_scope text;
  v_familia uuid;
BEGIN
  SELECT s.organizacion_id INTO v_org
  FROM public.sucursales s
  WHERE s.id=p_sucursal_id AND s.activa=true;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Sucursal inexistente o inactiva' USING ERRCODE='P0002'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios actor
    JOIN public.usuario_accesos ua ON ua.usuario_id=actor.id
      AND ua.organizacion_id=v_org AND ua.rol='gerente_sucursal'
      AND ua.sucursal_id=p_sucursal_id AND ua.activo=true
    WHERE actor.id=p_actor_id AND actor.activo=true
  ) THEN
    RAISE EXCEPTION 'Sin permiso para administrar usuarios de esta sucursal' USING ERRCODE='42501';
  END IF;

  IF NULLIF(btrim(COALESCE(p_nombre,'')),'') IS NULL THEN RAISE EXCEPTION 'El nombre es obligatorio' USING ERRCODE='22023'; END IF;
  IF p_rol_legacy NOT IN ('supervisor','operador') THEN
    RAISE EXCEPTION 'Los gerentes de sucursal se gestionan desde Accesos y jerarquía' USING ERRCODE='42501';
  END IF;

  SELECT u.activo,ua.rol INTO v_perfil_activo,v_rol_actual
  FROM public.usuarios u
  JOIN public.usuario_accesos ua ON ua.usuario_id=u.id
    AND ua.organizacion_id=v_org AND ua.sucursal_id=p_sucursal_id
    AND ua.rol IN ('gerente_sucursal','supervisor','operador')
  WHERE u.id=p_usuario_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'El usuario no tiene un acceso local existente en esta sucursal. Usá una invitación.' USING ERRCODE='42501'; END IF;
  IF NOT v_perfil_activo THEN RAISE EXCEPTION 'La cuenta debe completar su activación antes de administrar el acceso local' USING ERRCODE='42501'; END IF;
  IF v_rol_actual='gerente_sucursal' THEN RAISE EXCEPTION 'Los gerentes de sucursal se gestionan desde Accesos y jerarquía' USING ERRCODE='42501'; END IF;

  v_rol_scope := CASE p_rol_legacy WHEN 'supervisor' THEN 'supervisor' ELSE 'operador' END;
  UPDATE public.usuarios SET nombre=btrim(p_nombre) WHERE id=p_usuario_id;
  UPDATE public.usuario_accesos
  SET rol=v_rol_scope, activo=p_activo, updated_at=now()
  WHERE usuario_id=p_usuario_id AND organizacion_id=v_org AND sucursal_id=p_sucursal_id AND rol IN ('supervisor','operador');
  IF NOT FOUND THEN RAISE EXCEPTION 'El acceso local cambió durante la edición. Volvé a cargar la pantalla.' USING ERRCODE='40001'; END IF;

  UPDATE public.usuario_familias_sucursal SET activo=false,updated_at=now()
  WHERE usuario_id=p_usuario_id AND sucursal_id=p_sucursal_id AND activo=true;

  IF p_rol_legacy='operador' AND p_activo THEN
    FOREACH v_familia IN ARRAY COALESCE(p_familias,ARRAY[]::uuid[]) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.familias f WHERE f.id=v_familia AND f.organizacion_id=v_org) THEN
        RAISE EXCEPTION 'Familia % no pertenece a la organización',v_familia USING ERRCODE='23503';
      END IF;
      INSERT INTO public.usuario_familias_sucursal(usuario_id,organizacion_id,sucursal_id,familia_id,activo)
      VALUES(p_usuario_id,v_org,p_sucursal_id,v_familia,true)
      ON CONFLICT(usuario_id,sucursal_id,familia_id)
      DO UPDATE SET activo=true,organizacion_id=EXCLUDED.organizacion_id,updated_at=now();
    END LOOP;
  END IF;

  RETURN jsonb_build_object('usuario_id',p_usuario_id,'sucursal_id',p_sucursal_id,'rol',p_rol_legacy,'rol_scope',v_rol_scope,'activo',p_activo,'familias',CASE WHEN p_rol_legacy='operador' AND p_activo THEN COALESCE(array_length(p_familias,1),0) ELSE 0 END);
END;
$$;

-- Restaura el alta local segura: crea perfil/acceso INACTIVOS y la activación
-- posterior los habilita. No pasa por guardar_usuario_sucursal_admin_v1.
CREATE OR REPLACE FUNCTION public.registrar_invitacion_local_v1(
  p_actor_id uuid,
  p_usuario_id uuid,
  p_email text,
  p_nombre text,
  p_rol text,
  p_sucursal_id uuid,
  p_familias uuid[] DEFAULT ARRAY[]::uuid[],
  p_canal text DEFAULT 'link'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
DECLARE
  v_org uuid;
  v_familias uuid[] := ARRAY[]::uuid[];
  v_familia uuid;
  v_invitacion_id uuid;
  v_expires_at timestamptz := now()+interval '72 hours';
BEGIN
  IF nullif(btrim(coalesce(p_nombre,'')),'') IS NULL THEN RAISE EXCEPTION 'El nombre es obligatorio' USING ERRCODE='22023'; END IF;
  IF nullif(btrim(coalesce(p_email,'')),'') IS NULL THEN RAISE EXCEPTION 'El email es obligatorio' USING ERRCODE='22023'; END IF;
  IF p_rol NOT IN ('supervisor','operador') THEN RAISE EXCEPTION 'Rol local de invitación inválido' USING ERRCODE='22023'; END IF;
  IF p_sucursal_id IS NULL THEN RAISE EXCEPTION 'La sucursal es obligatoria' USING ERRCODE='22023'; END IF;
  IF p_canal NOT IN ('link','email') THEN RAISE EXCEPTION 'Canal de invitación inválido' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.usuarios u WHERE u.id=p_usuario_id) THEN RAISE EXCEPTION 'La cuenta ya está registrada en Noven' USING ERRCODE='23505'; END IF;

  SELECT s.organizacion_id INTO v_org FROM public.sucursales s WHERE s.id=p_sucursal_id AND s.activa=true;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Sucursal inexistente o inactiva' USING ERRCODE='P0002'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios actor
    JOIN public.usuario_accesos ua ON ua.usuario_id=actor.id
      AND ua.organizacion_id=v_org AND ua.rol='gerente_sucursal'
      AND ua.sucursal_id=p_sucursal_id AND ua.activo=true
    WHERE actor.id=p_actor_id AND actor.activo=true
  ) THEN
    RAISE EXCEPTION 'Sin permiso para administrar usuarios de esta sucursal' USING ERRCODE='42501';
  END IF;

  IF p_rol='operador' THEN
    SELECT coalesce(array_agg(DISTINCT x ORDER BY x),ARRAY[]::uuid[]) INTO v_familias
    FROM unnest(coalesce(p_familias,ARRAY[]::uuid[])) AS t(x);
    IF cardinality(v_familias)=0 THEN RAISE EXCEPTION 'El operador requiere al menos una familia responsable' USING ERRCODE='22023'; END IF;
    FOREACH v_familia IN ARRAY v_familias LOOP
      IF NOT EXISTS(SELECT 1 FROM public.familias f WHERE f.id=v_familia AND f.organizacion_id=v_org) THEN
        RAISE EXCEPTION 'Familia % no pertenece a la organización',v_familia USING ERRCODE='23503';
      END IF;
      IF EXISTS(SELECT 1 FROM public.usuario_familias_sucursal ufs WHERE ufs.sucursal_id=p_sucursal_id AND ufs.familia_id=v_familia AND ufs.activo=true) THEN
        RAISE EXCEPTION 'Una o más familias ya tienen otro operador responsable en esta sucursal' USING ERRCODE='23505';
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.usuarios(id,nombre,rol,sucursal_id,activo)
  VALUES(p_usuario_id,btrim(p_nombre),p_rol,p_sucursal_id,false);

  INSERT INTO public.usuario_accesos(usuario_id,organizacion_id,rol,zona_id,sucursal_id,activo)
  VALUES(p_usuario_id,v_org,p_rol,NULL,p_sucursal_id,false);

  IF p_rol='operador' THEN
    FOREACH v_familia IN ARRAY v_familias LOOP
      INSERT INTO public.usuario_familias_sucursal(usuario_id,organizacion_id,sucursal_id,familia_id,activo)
      VALUES(p_usuario_id,v_org,p_sucursal_id,v_familia,false)
      ON CONFLICT(usuario_id,sucursal_id,familia_id)
      DO UPDATE SET organizacion_id=EXCLUDED.organizacion_id,activo=false,updated_at=now();
    END LOOP;
  END IF;

  INSERT INTO public.invitaciones_acceso(usuario_id,organizacion_id,email,nombre,rol,zona_id,sucursal_id,creado_por,canal,estado,expires_at,familias_ids)
  VALUES(p_usuario_id,v_org,lower(btrim(p_email)),btrim(p_nombre),p_rol,NULL,p_sucursal_id,p_actor_id,p_canal,'pendiente',v_expires_at,CASE WHEN p_rol='operador' THEN v_familias ELSE ARRAY[]::uuid[] END)
  RETURNING id INTO v_invitacion_id;

  RETURN jsonb_build_object('invitacion_id',v_invitacion_id,'usuario_id',p_usuario_id,'rol',p_rol,'organizacion_id',v_org,'sucursal_id',p_sucursal_id,'familias_ids',CASE WHEN p_rol='operador' THEN to_jsonb(v_familias) ELSE '[]'::jsonb END,'estado','pendiente','expires_at',v_expires_at);
END;
$$;

-- Jerarquía: sólo la cuenta admin_organizacion + gerente 091.
CREATE OR REPLACE FUNCTION public.listar_contexto_altas_v1(p_actor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','noven_private'
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT ua.organizacion_id INTO v_org
  FROM public.usuario_accesos ua
  WHERE ua.usuario_id=p_actor_id
    AND ua.rol='admin_organizacion'
    AND ua.activo=true
    AND noven_private.es_administrador_jerarquia_v1(p_actor_id,ua.organizacion_id)
  ORDER BY ua.created_at
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sin permiso para administrar accesos y jerarquía' USING ERRCODE='42501';
  END IF;

  RETURN jsonb_build_object(
    'puede_crear_zonal',true,
    'regiones',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'codigo',r.codigo,'nombre',r.nombre,'organizacion_id',r.organizacion_id) ORDER BY r.nombre) FROM public.regiones r WHERE r.organizacion_id=v_org AND r.activa=true),'[]'::jsonb),
    'zonas',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',z.id,'codigo',z.codigo,'nombre',z.nombre,'region_id',z.region_id,'organizacion_id',z.organizacion_id) ORDER BY z.nombre) FROM public.zonas z WHERE z.organizacion_id=v_org AND z.activa=true),'[]'::jsonb),
    'sucursales',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'codigo',s.codigo,'nombre',s.nombre,'zona_id',s.zona_id,'organizacion_id',s.organizacion_id) ORDER BY s.codigo) FROM public.sucursales s WHERE s.organizacion_id=v_org AND s.activa=true),'[]'::jsonb),
    'accesos_actor',COALESCE((SELECT jsonb_agg(jsonb_build_object('rol',ua.rol,'organizacion_id',ua.organizacion_id,'zona_id',ua.zona_id,'sucursal_id',ua.sucursal_id) ORDER BY ua.created_at) FROM public.usuario_accesos ua WHERE ua.usuario_id=p_actor_id AND ua.organizacion_id=v_org AND ua.activo=true),'[]'::jsonb)
  );
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
SET search_path TO 'pg_catalog','public','noven_private'
AS $$
DECLARE
  v_org uuid;
  v_invitacion_id uuid;
  v_expires_at timestamptz := now()+interval '72 hours';
BEGIN
  IF nullif(btrim(coalesce(p_nombre,'')),'') IS NULL THEN RAISE EXCEPTION 'El nombre es obligatorio' USING ERRCODE='22023'; END IF;
  IF nullif(btrim(coalesce(p_email,'')),'') IS NULL THEN RAISE EXCEPTION 'El email es obligatorio' USING ERRCODE='22023'; END IF;
  IF p_rol NOT IN ('gerente_zonal','gerente_sucursal') THEN RAISE EXCEPTION 'Rol de invitación inválido' USING ERRCODE='22023'; END IF;
  IF p_canal NOT IN ('link','email') THEN RAISE EXCEPTION 'Canal de invitación inválido' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.usuarios u WHERE u.id=p_usuario_id) THEN RAISE EXCEPTION 'La cuenta ya está registrada en Noven' USING ERRCODE='23505'; END IF;

  IF p_rol='gerente_zonal' THEN
    IF p_zona_id IS NULL OR p_sucursal_id IS NOT NULL THEN RAISE EXCEPTION 'Gerente zonal requiere una zona' USING ERRCODE='22023'; END IF;
    SELECT z.organizacion_id INTO v_org FROM public.zonas z WHERE z.id=p_zona_id AND z.activa=true;
  ELSE
    IF p_sucursal_id IS NULL OR p_zona_id IS NOT NULL THEN RAISE EXCEPTION 'Gerente de sucursal requiere una sucursal' USING ERRCODE='22023'; END IF;
    SELECT s.organizacion_id INTO v_org FROM public.sucursales s WHERE s.id=p_sucursal_id AND s.activa=true;
  END IF;

  IF v_org IS NULL THEN RAISE EXCEPTION 'Alcance inexistente o inactivo' USING ERRCODE='P0002'; END IF;
  IF NOT noven_private.es_administrador_jerarquia_v1(p_actor_id,v_org) THEN
    RAISE EXCEPTION 'Sin permiso para administrar accesos y jerarquía' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.usuarios(id,nombre,rol,sucursal_id,activo)
  VALUES(p_usuario_id,btrim(p_nombre),CASE WHEN p_rol='gerente_sucursal' THEN 'admin' ELSE 'supervisor' END,CASE WHEN p_rol='gerente_sucursal' THEN p_sucursal_id ELSE NULL END,false);

  INSERT INTO public.usuario_accesos(usuario_id,organizacion_id,rol,zona_id,sucursal_id,activo)
  VALUES(p_usuario_id,v_org,p_rol,CASE WHEN p_rol='gerente_zonal' THEN p_zona_id ELSE NULL END,CASE WHEN p_rol='gerente_sucursal' THEN p_sucursal_id ELSE NULL END,false);

  INSERT INTO public.invitaciones_acceso(usuario_id,organizacion_id,email,nombre,rol,zona_id,sucursal_id,creado_por,canal,estado,expires_at)
  VALUES(p_usuario_id,v_org,lower(btrim(p_email)),btrim(p_nombre),p_rol,CASE WHEN p_rol='gerente_zonal' THEN p_zona_id ELSE NULL END,CASE WHEN p_rol='gerente_sucursal' THEN p_sucursal_id ELSE NULL END,p_actor_id,p_canal,'pendiente',v_expires_at)
  RETURNING id INTO v_invitacion_id;

  RETURN jsonb_build_object('invitacion_id',v_invitacion_id,'usuario_id',p_usuario_id,'rol',p_rol,'organizacion_id',v_org,'zona_id',CASE WHEN p_rol='gerente_zonal' THEN p_zona_id ELSE NULL END,'sucursal_id',CASE WHEN p_rol='gerente_sucursal' THEN p_sucursal_id ELSE NULL END,'estado','pendiente','expires_at',v_expires_at);
END;
$$;

-- Gestión de invitaciones: jerarquía especial 091 o gerente local exacto.
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
    JOIN public.usuarios actor ON actor.id=p_actor_id AND actor.activo=true
    WHERE ia.id=p_invitacion_id
      AND (
        (
          ia.rol IN ('gerente_zonal','gerente_sucursal')
          AND noven_private.es_administrador_jerarquia_v1(p_actor_id,ia.organizacion_id)
        )
        OR (
          ia.rol IN ('supervisor','operador')
          AND EXISTS (
            SELECT 1
            FROM public.usuario_accesos ua_local
            WHERE ua_local.usuario_id=p_actor_id
              AND ua_local.organizacion_id=ia.organizacion_id
              AND ua_local.rol='gerente_sucursal'
              AND ua_local.sucursal_id=ia.sucursal_id
              AND ua_local.activo=true
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.listar_admin_sucursal_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listar_admin_sucursal_v1(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.guardar_usuario_sucursal_admin_v1(uuid,uuid,uuid,text,text,boolean,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_usuario_sucursal_admin_v1(uuid,uuid,uuid,text,text,boolean,uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.registrar_invitacion_local_v1(uuid,uuid,text,text,text,uuid,uuid[],text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_invitacion_local_v1(uuid,uuid,text,text,text,uuid,uuid[],text) TO service_role;
REVOKE ALL ON FUNCTION public.listar_contexto_altas_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listar_contexto_altas_v1(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.registrar_invitacion_acceso_v1(uuid,uuid,text,text,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_invitacion_acceso_v1(uuid,uuid,text,text,text,uuid,uuid,text) TO service_role;

COMMIT;
