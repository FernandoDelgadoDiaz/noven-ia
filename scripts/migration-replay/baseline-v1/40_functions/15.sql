CREATE OR REPLACE FUNCTION public.registrar_invitacion_acceso_v1(p_actor_id uuid, p_usuario_id uuid, p_email text, p_nombre text, p_rol text, p_zona_id uuid DEFAULT NULL::uuid, p_sucursal_id uuid DEFAULT NULL::uuid, p_canal text DEFAULT 'link'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'noven_private'
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION public.registrar_invitacion_local_v1(p_actor_id uuid, p_usuario_id uuid, p_email text, p_nombre text, p_rol text, p_sucursal_id uuid, p_familias uuid[] DEFAULT ARRAY[]::uuid[], p_canal text DEFAULT 'link'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION public.resolver_pendientes_catalogo_por_familia_csv(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_cod_arts jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.validar_operacion_local_server_v1(p_usuario_id,p_sucursal_id) THEN
    RAISE EXCEPTION 'El usuario no tiene permiso operativo para aprender catálogo desde esta sucursal'
      USING ERRCODE='42501';
  END IF;
  RETURN public.resolver_pendientes_catalogo_por_familia_csv_legacy_v1(
    p_sucursal_id,p_usuario_id,p_codigo_sucursal_fuente,p_codigo_familia,p_cod_arts
  );
END;
$function$

CREATE OR REPLACE FUNCTION public.resolver_pendientes_catalogo_por_familia_csv_legacy_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_cod_arts jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$ DECLARE v_org_id uuid; v_zona_id uuid; v_codigo_sucursal text; v_familia_id uuid; v_pendiente record; v_resultado jsonb; v_resueltos integer:=0; v_ya_resueltos integer:=0; v_sucursales_afectadas integer:=0; BEGIN IF p_usuario_id IS NULL THEN RAISE EXCEPTION 'Usuario requerido'; END IF; IF p_cod_arts IS NULL OR jsonb_typeof(p_cod_arts)<>'array' THEN RAISE EXCEPTION 'p_cod_arts debe ser un array JSON'; END IF; SELECT s.organizacion_id,s.zona_id,s.codigo INTO v_org_id,v_zona_id,v_codigo_sucursal FROM public.sucursales s WHERE s.id=p_sucursal_id AND s.activa=true; IF v_org_id IS NULL THEN RAISE EXCEPTION 'Sucursal inexistente o inactiva'; END IF; IF btrim(COALESCE(p_codigo_sucursal_fuente,''))<>v_codigo_sucursal THEN RAISE EXCEPTION 'El archivo corresponde a la sucursal %, pero la sesión intenta aprender desde %',p_codigo_sucursal_fuente,v_codigo_sucursal; END IF; IF NOT EXISTS(SELECT 1 FROM public.usuario_accesos ua WHERE ua.usuario_id=p_usuario_id AND ua.organizacion_id=v_org_id AND ua.activo=true AND ua.rol<>'operador' AND (ua.rol='admin_organizacion' OR (ua.rol='gerente_zonal' AND ua.zona_id=v_zona_id) OR (ua.rol IN('gerente_sucursal','supervisor') AND ua.sucursal_id=p_sucursal_id))) THEN RAISE EXCEPTION 'El usuario no tiene alcance para aprender catálogo desde esta sucursal'; END IF; SELECT f.id INTO v_familia_id FROM public.familias f WHERE f.organizacion_id=v_org_id AND f.codigo=btrim(p_codigo_familia); IF v_familia_id IS NULL THEN RAISE EXCEPTION 'La familia % no existe en la organización',p_codigo_familia; END IF; FOR v_pendiente IN WITH codigos AS (SELECT DISTINCT btrim(value #>> '{}') AS cod_art FROM jsonb_array_elements(p_cod_arts) WHERE jsonb_typeof(value)='string' AND btrim(value #>> '{}')<>'') SELECT pp.id,pp.cod_art FROM public.productos_pendientes_catalogo pp JOIN codigos c ON c.cod_art=pp.cod_art WHERE pp.organizacion_id=v_org_id AND pp.estado='pendiente' ORDER BY pp.cod_art LOOP SELECT public.resolver_producto_pendiente_catalogo(v_pendiente.id,v_familia_id,p_usuario_id) INTO v_resultado; IF COALESCE((v_resultado->>'ya_resuelto')::boolean,false) THEN v_ya_resueltos:=v_ya_resueltos+1; ELSE v_resueltos:=v_resueltos+1; v_sucursales_afectadas:=v_sucursales_afectadas+COALESCE((v_resultado->>'sucursales_afectadas')::integer,0); END IF; END LOOP; RETURN jsonb_build_object('familia_id',v_familia_id,'codigo_familia',btrim(p_codigo_familia),'resueltos',v_resueltos,'ya_resueltos',v_ya_resueltos,'sucursales_afectadas',v_sucursales_afectadas); END; $function$

CREATE OR REPLACE FUNCTION public.resolver_producto_pendiente_catalogo(p_pendiente_id uuid, p_familia_id uuid, p_usuario_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.validar_resolucion_pendiente_server_v1(p_usuario_id,p_pendiente_id) THEN
    RAISE EXCEPTION 'El usuario no tiene permiso operativo para clasificar este producto'
      USING ERRCODE='42501';
  END IF;
  RETURN public.resolver_producto_pendiente_catalogo_legacy_v1(
    p_pendiente_id,p_familia_id,p_usuario_id
  );
END;
$function$

CREATE OR REPLACE FUNCTION public.resolver_producto_pendiente_catalogo_legacy_v1(p_pendiente_id uuid, p_familia_id uuid, p_usuario_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$ DECLARE v_p public.productos_pendientes_catalogo%ROWTYPE; v_producto_id uuid; v_familia_org uuid; v_sucursales_afectadas integer:=0; v_legacy_091 constant uuid:='00000000-0000-0000-0000-000000000001'::uuid; BEGIN SELECT * INTO v_p FROM public.productos_pendientes_catalogo WHERE id=p_pendiente_id FOR UPDATE; IF v_p.id IS NULL THEN RAISE EXCEPTION 'Producto pendiente inexistente'; END IF; IF v_p.estado='resuelto' THEN RETURN jsonb_build_object('ya_resuelto',true,'producto_id',v_p.producto_id,'familia_id',v_p.familia_id_resuelta); END IF; IF v_p.estado<>'pendiente' THEN RAISE EXCEPTION 'El producto pendiente no está disponible para clasificación'; END IF; SELECT organizacion_id INTO v_familia_org FROM public.familias WHERE id=p_familia_id; IF v_familia_org IS DISTINCT FROM v_p.organizacion_id THEN RAISE EXCEPTION 'La familia no pertenece a la organización del producto'; END IF; IF NOT EXISTS(SELECT 1 FROM public.producto_pendiente_detecciones d JOIN public.sucursales s ON s.id=d.sucursal_id JOIN public.usuario_accesos ua ON ua.usuario_id=p_usuario_id AND ua.organizacion_id=v_p.organizacion_id AND ua.activo=true WHERE d.pendiente_id=v_p.id AND ua.rol<>'operador' AND (ua.rol='admin_organizacion' OR (ua.rol='gerente_zonal' AND ua.zona_id=s.zona_id) OR (ua.rol IN('gerente_sucursal','supervisor') AND ua.sucursal_id=s.id))) THEN RAISE EXCEPTION 'El usuario no tiene alcance para clasificar este producto'; END IF; v_producto_id:=v_p.producto_id; IF v_producto_id IS NOT NULL THEN UPDATE public.productos SET familia_id=p_familia_id,updated_at=now() WHERE id=v_producto_id AND organizacion_id=v_p.organizacion_id AND familia_id IS NULL; IF NOT FOUND THEN SELECT id INTO v_producto_id FROM public.productos WHERE id=v_p.producto_id AND organizacion_id=v_p.organizacion_id AND familia_id=p_familia_id; IF v_producto_id IS NULL THEN RAISE EXCEPTION 'El producto ya tiene una clasificación diferente; requiere revisión administrativa'; END IF; END IF; ELSE PERFORM set_config('noven.skip_legacy_bridge','1',true); INSERT INTO public.productos(organizacion_id,cod_art,descripcion,marca,gramaje,categoria,familia_id,stock_actual,venta_media_diaria,activo) VALUES(v_p.organizacion_id,v_p.cod_art,v_p.descripcion,v_p.marca,v_p.gramaje,'OTRO',p_familia_id,0,0,true) ON CONFLICT(organizacion_id,cod_art) DO NOTHING RETURNING id INTO v_producto_id; IF v_producto_id IS NULL THEN SELECT id INTO v_producto_id FROM public.productos WHERE organizacion_id=v_p.organizacion_id AND cod_art=v_p.cod_art AND activo=true; IF v_producto_id IS NULL THEN RAISE EXCEPTION 'No se pudo crear ni recuperar el producto global'; END IF; UPDATE public.productos SET familia_id=p_familia_id,updated_at=now() WHERE id=v_producto_id AND familia_id IS NULL; IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM public.productos WHERE id=v_producto_id AND familia_id=p_familia_id) THEN RAISE EXCEPTION 'El producto fue clasificado simultáneamente con otra familia'; END IF; END IF; END IF; INSERT INTO public.producto_snapshots(importacion_id,organizacion_id,sucursal_id,producto_id,stock,venta_media_diaria,fila_origen,captured_at) SELECT d.importacion_id,d.organizacion_id,d.sucursal_id,v_producto_id,d.stock,d.venta_media_diaria,d.fila_origen,d.detected_at FROM public.producto_pendiente_detecciones d WHERE d.pendiente_id=v_p.id ON CONFLICT(importacion_id,producto_id) DO NOTHING; WITH ultimas AS (SELECT DISTINCT ON(d.sucursal_id) d.organizacion_id,d.sucursal_id,d.stock,d.venta_media_diaria,d.detected_at FROM public.producto_pendiente_detecciones d WHERE d.pendiente_id=v_p.id ORDER BY d.sucursal_id,d.detected_at DESC,d.id DESC) INSERT INTO public.producto_sucursal(organizacion_id,producto_id,sucursal_id,stock_actual,venta_media_diaria,fecha_ultima_importacion) SELECT u.organizacion_id,v_producto_id,u.sucursal_id,u.stock,u.venta_media_diaria,u.detected_at FROM ultimas u ON CONFLICT(producto_id,sucursal_id) DO UPDATE SET stock_actual=EXCLUDED.stock_actual,venta_media_diaria=EXCLUDED.venta_media_diaria,fecha_ultima_importacion=EXCLUDED.fecha_ultima_importacion,updated_at=now(); SELECT count(DISTINCT sucursal_id) INTO v_sucursales_afectadas FROM public.producto_pendiente_detecciones WHERE pendiente_id=v_p.id; PERFORM set_config('noven.skip_legacy_bridge','1',true); UPDATE public.productos p SET stock_actual=x.stock,venta_media_diaria=x.venta_media_diaria,updated_at=now() FROM (SELECT d.stock,d.venta_media_diaria FROM public.producto_pendiente_detecciones d WHERE d.pendiente_id=v_p.id AND d.sucursal_id=v_legacy_091 ORDER BY d.detected_at DESC,d.id DESC LIMIT 1) x WHERE p.id=v_producto_id; UPDATE public.productos_pendientes_catalogo SET producto_id=v_producto_id,estado='resuelto',familia_id_resuelta=p_familia_id,clasificado_por=p_usuario_id,clasificado_at=now(),updated_at=now() WHERE id=v_p.id; RETURN jsonb_build_object('ya_resuelto',false,'producto_id',v_producto_id,'familia_id',p_familia_id,'sucursales_afectadas',v_sucursales_afectadas); END; $function$

CREATE OR REPLACE FUNCTION public.responder_alerta_zonal_v1(p_destino_id uuid, p_respuesta text, p_cantidad integer DEFAULT NULL::integer, p_fecha_otra date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT noven_private.responder_alerta_zonal_v1_impl(p_destino_id,p_respuesta,p_cantidad,p_fecha_otra); $function$
