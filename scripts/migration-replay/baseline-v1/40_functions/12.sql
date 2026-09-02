CREATE OR REPLACE FUNCTION public.fn_rol_operador_sin_colision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_familia  text;
  v_ocupante text;
BEGIN
  IF NEW.rol IS NOT DISTINCT FROM OLD.rol OR NEW.rol <> 'operador' THEN
    RETURN NEW;
  END IF;

  SELECT f.nombre, u.nombre
  INTO v_familia, v_ocupante
  FROM public.usuario_familias uf_candidato
  JOIN public.familias f
    ON f.id = uf_candidato.familia_id
  JOIN public.usuario_familias uf_otro
    ON uf_otro.familia_id  = uf_candidato.familia_id
   AND uf_otro.usuario_id <> NEW.id
  JOIN public.usuarios u
    ON u.id  = uf_otro.usuario_id
   AND u.rol = 'operador'
  WHERE uf_candidato.usuario_id = NEW.id
  LIMIT 1;

  IF v_ocupante IS NOT NULL THEN
    RAISE EXCEPTION
      USING errcode = '23505',
            message = format(
              'No se puede asignar rol operador: la familia %s ya pertenece al operador %s.',
              v_familia, v_ocupante
            );
  END IF;

  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.guardar_usuario_sucursal_admin_v1(p_actor_id uuid, p_sucursal_id uuid, p_usuario_id uuid, p_nombre text, p_rol_legacy text, p_activo boolean, p_familias uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION public.guardar_vencimiento_y_stock_scanner_v1(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text DEFAULT NULL::text, p_stock_actual integer DEFAULT NULL::integer, p_vencimiento_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_vencimiento_id uuid;
  v_producto_actual uuid;
  v_sucursal_actual uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_producto_id IS NULL OR p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'Producto y sucursal son obligatorios' USING ERRCODE = '22023';
  END IF;

  IF p_stock_actual IS NOT NULL AND p_stock_actual < 0 THEN
    RAISE EXCEPTION 'El stock debe ser mayor o igual a cero' USING ERRCODE = '22023';
  END IF;

  IF p_vencimiento_id IS NULL THEN
    v_vencimiento_id := noven_private.crear_vencimiento_operador_impl(
      p_producto_id,
      p_sucursal_id,
      p_cantidad,
      p_fecha_vencimiento,
      p_lote
    );
  ELSE
    SELECT v.producto_id, v.sucursal_id
      INTO v_producto_actual, v_sucursal_actual
    FROM public.vencimientos v
    WHERE v.id = p_vencimiento_id
      AND v.activo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vencimiento activo no encontrado o no autorizado' USING ERRCODE = 'P0002';
    END IF;

    IF v_producto_actual IS DISTINCT FROM p_producto_id
       OR v_sucursal_actual IS DISTINCT FROM p_sucursal_id THEN
      RAISE EXCEPTION 'El vencimiento no pertenece al producto/sucursal informados' USING ERRCODE = '22023';
    END IF;

    PERFORM noven_private.actualizar_vencimiento_operador_impl(
      p_vencimiento_id,
      p_cantidad,
      p_fecha_vencimiento,
      p_lote
    );
    v_vencimiento_id := p_vencimiento_id;
  END IF;

  IF p_stock_actual IS NOT NULL THEN
    PERFORM noven_private.upsert_stock_producto_sucursal_scanner(
      p_sucursal_id,
      p_producto_id,
      p_stock_actual
    );
  END IF;

  RETURN jsonb_build_object(
    'vencimiento_id', v_vencimiento_id,
    'producto_id', p_producto_id,
    'sucursal_id', p_sucursal_id,
    'stock_actual', p_stock_actual
  );
END;
$function$

CREATE OR REPLACE FUNCTION public.listar_admin_sucursal_v1(p_actor_id uuid, p_sucursal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION public.listar_contexto_altas_v1(p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'noven_private'
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION public.listar_familias_scanner(p_sucursal_id uuid)
 RETURNS TABLE(id uuid, nombre text, codigo text, sector_id uuid)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$ DECLARE v_org uuid := noven_private.scanner_org(p_sucursal_id); BEGIN RETURN QUERY SELECT f.id,f.nombre,f.codigo,f.sector_id FROM public.familias f WHERE f.organizacion_id=v_org AND noven_private.puede_ver_familia_sucursal(p_sucursal_id,f.id) ORDER BY f.nombre; END; $function$

CREATE OR REPLACE FUNCTION public.listar_invitaciones_gestion_v1(p_actor_id uuid, p_tipo text DEFAULT 'todas'::text, p_sucursal_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'noven_private'
AS $function$
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
$function$
