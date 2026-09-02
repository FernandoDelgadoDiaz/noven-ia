CREATE OR REPLACE FUNCTION public.anular_invitacion_gestion_v1(p_actor_id uuid, p_invitacion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'noven_private'
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION public.anular_vencimiento_carga_incorrecta(p_vencimiento_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT noven_private.anular_vencimiento_carga_incorrecta_impl(p_vencimiento_id,p_motivo); $function$

CREATE OR REPLACE FUNCTION public.anular_vencimiento_carga_incorrecta_invoker_v1(p_vencimiento_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$ DECLARE v_uid uuid := (SELECT auth.uid()); v_sucursal uuid; v_producto uuid; v_cantidad numeric; v_motivo text; BEGIN IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF; SELECT v.sucursal_id,v.producto_id,v.cantidad INTO v_sucursal,v_producto,v_cantidad FROM public.vencimientos v WHERE v.id=p_vencimiento_id AND v.activo=true FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Vencimiento activo no encontrado' USING ERRCODE='P0002'; END IF; IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal,v_producto) THEN RAISE EXCEPTION 'Sin permiso para anular este vencimiento' USING ERRCODE='42501'; END IF; v_motivo:=COALESCE(NULLIF(btrim(COALESCE(p_motivo,'')),''),'Carga incorrecta'); PERFORM public.registrar_control_vencimiento(p_vencimiento_id,GREATEST(COALESCE(v_cantidad,0),0),'ANULACIÓN DE CARGA: '||v_motivo); UPDATE public.vencimientos SET activo=false,updated_at=now() WHERE id=p_vencimiento_id; END; $function$

CREATE OR REPLACE FUNCTION public.aplicar_importacion_0258_familia_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_operaciones jsonb, p_detalle_items jsonb, p_fecha_reporte date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ DECLARE v_result jsonb; v_importacion_id uuid; v_existente_id uuid; v_existente_estado text; BEGIN IF NOT public.validar_operacion_local_server_v1(p_usuario_id,p_sucursal_id) THEN RAISE EXCEPTION 'El usuario no tiene permiso operativo para importar esta familia en la sucursal' USING ERRCODE='42501'; END IF; SELECT i.id,i.estado INTO v_existente_id,v_existente_estado FROM public.importaciones i WHERE i.sucursal_id=p_sucursal_id AND i.tipo_reporte='glaciar_0258' AND i.archivo_sha256=p_archivo_sha256; IF v_existente_id IS NOT NULL THEN PERFORM noven_private.persistir_detalle_0258_v1(v_existente_id,p_sucursal_id,p_detalle_items); RETURN jsonb_build_object('duplicada',true,'importacion_id',v_existente_id,'estado',v_existente_estado,'fuente','glaciar_0258','detalle_enriquecido',true); END IF; v_result:=public.aplicar_importacion_glaciar_familia_v1(p_sucursal_id,p_usuario_id,p_codigo_sucursal_fuente,p_codigo_familia,p_nombre_archivo,p_archivo_sha256,p_filas_total,p_filas_validas,p_filas_descartadas,p_operaciones,p_fecha_reporte); v_importacion_id:=NULLIF(v_result->>'importacion_id','')::uuid; IF v_importacion_id IS NULL THEN RAISE EXCEPTION 'La importación no devolvió identidad trazable'; END IF; IF COALESCE((v_result->>'duplicada')::boolean,false) THEN UPDATE public.importaciones SET tipo_reporte='glaciar_0258' WHERE id=v_importacion_id AND sucursal_id=p_sucursal_id AND archivo_sha256=p_archivo_sha256 AND tipo_reporte='reposicion_asistida'; PERFORM noven_private.persistir_detalle_0258_v1(v_importacion_id,p_sucursal_id,p_detalle_items); RETURN v_result||jsonb_build_object('fuente','glaciar_0258','detalle_enriquecido',true); END IF; UPDATE public.importaciones SET tipo_reporte='glaciar_0258' WHERE id=v_importacion_id; PERFORM noven_private.persistir_detalle_0258_v1(v_importacion_id,p_sucursal_id,p_detalle_items); RETURN v_result||jsonb_build_object('fuente','glaciar_0258'); END; $function$

CREATE OR REPLACE FUNCTION public.aplicar_importacion_0258_masiva_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_items jsonb, p_detalle_items jsonb, p_fecha_reporte date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ DECLARE v_result jsonb; v_importacion_id uuid; v_existente_id uuid; v_existente_estado text; BEGIN IF NOT public.validar_operacion_local_server_v1(p_usuario_id,p_sucursal_id) THEN RAISE EXCEPTION 'El usuario no tiene permiso operativo para importar en la sucursal' USING ERRCODE='42501'; END IF; SELECT i.id,i.estado INTO v_existente_id,v_existente_estado FROM public.importaciones i WHERE i.sucursal_id=p_sucursal_id AND i.tipo_reporte='glaciar_0258' AND i.archivo_sha256=p_archivo_sha256; IF v_existente_id IS NOT NULL THEN PERFORM noven_private.persistir_detalle_0258_v1(v_existente_id,p_sucursal_id,p_detalle_items); RETURN jsonb_build_object('duplicada',true,'importacion_id',v_existente_id,'estado',v_existente_estado,'fuente','glaciar_0258','detalle_enriquecido',true); END IF; v_result:=public.aplicar_importacion_glaciar_masiva_v2(p_sucursal_id,p_usuario_id,p_codigo_sucursal_fuente,p_nombre_archivo,p_archivo_sha256,p_filas_total,p_filas_validas,p_filas_descartadas,p_items,p_fecha_reporte); v_importacion_id:=NULLIF(v_result->>'importacion_id','')::uuid; IF v_importacion_id IS NULL THEN RAISE EXCEPTION 'La importación no devolvió identidad trazable'; END IF; IF COALESCE((v_result->>'duplicada')::boolean,false) THEN UPDATE public.importaciones SET tipo_reporte='glaciar_0258' WHERE id=v_importacion_id AND sucursal_id=p_sucursal_id AND archivo_sha256=p_archivo_sha256 AND tipo_reporte='reposicion_asistida'; PERFORM noven_private.persistir_detalle_0258_v1(v_importacion_id,p_sucursal_id,p_detalle_items); RETURN v_result||jsonb_build_object('fuente','glaciar_0258','detalle_enriquecido',true); END IF; UPDATE public.importaciones SET tipo_reporte='glaciar_0258' WHERE id=v_importacion_id; PERFORM noven_private.persistir_detalle_0258_v1(v_importacion_id,p_sucursal_id,p_detalle_items); RETURN v_result||jsonb_build_object('fuente','glaciar_0258'); END; $function$

CREATE OR REPLACE FUNCTION public.aplicar_importacion_glaciar_familia_legacy_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_operaciones jsonb, p_fecha_reporte date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$ DECLARE v_org_id uuid; v_zona_id uuid; v_codigo_sucursal text; v_familia_id uuid; v_importacion_id uuid; v_importacion_existente uuid; v_estado_existente text; v_op record; v_producto_id uuid; v_actualizados integer:=0; v_nuevos integer:=0; v_operaciones_count integer:=0; v_legacy_091 constant uuid:='00000000-0000-0000-0000-000000000001'::uuid; BEGIN IF p_usuario_id IS NULL THEN RAISE EXCEPTION 'Usuario requerido para importar'; END IF; IF p_operaciones IS NULL OR jsonb_typeof(p_operaciones)<>'array' THEN RAISE EXCEPTION 'p_operaciones debe ser un array JSON'; END IF; v_operaciones_count:=jsonb_array_length(p_operaciones); IF v_operaciones_count=0 THEN RAISE EXCEPTION 'La importación no contiene operaciones'; END IF; IF p_archivo_sha256 IS NULL OR p_archivo_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'SHA-256 de archivo inválido'; END IF; SELECT s.organizacion_id,s.zona_id,s.codigo INTO v_org_id,v_zona_id,v_codigo_sucursal FROM public.sucursales s WHERE s.id=p_sucursal_id AND s.activa=true; IF v_org_id IS NULL THEN RAISE EXCEPTION 'Sucursal inexistente o inactiva'; END IF; IF btrim(COALESCE(p_codigo_sucursal_fuente,''))<>v_codigo_sucursal THEN RAISE EXCEPTION 'El archivo corresponde a la sucursal %, pero la sesión intenta importar en %',p_codigo_sucursal_fuente,v_codigo_sucursal; END IF; SELECT f.id INTO v_familia_id FROM public.familias f WHERE f.organizacion_id=v_org_id AND f.codigo=btrim(p_codigo_familia); IF v_familia_id IS NULL THEN RAISE EXCEPTION 'La familia % no existe en la organización',p_codigo_familia; END IF; IF NOT EXISTS(SELECT 1 FROM public.usuario_accesos ua WHERE ua.usuario_id=p_usuario_id AND ua.organizacion_id=v_org_id AND ua.activo=true AND (ua.rol='admin_organizacion' OR (ua.rol='gerente_zonal' AND ua.zona_id=v_zona_id) OR (ua.rol IN('gerente_sucursal','supervisor') AND ua.sucursal_id=p_sucursal_id))) THEN RAISE EXCEPTION 'El usuario no tiene permiso para importar esta familia en la sucursal'; END IF; SELECT i.id,i.estado INTO v_importacion_existente,v_estado_existente FROM public.importaciones i WHERE i.sucursal_id=p_sucursal_id AND i.tipo_reporte='reposicion_asistida' AND i.archivo_sha256=p_archivo_sha256; IF v_importacion_existente IS NOT NULL THEN RETURN jsonb_build_object('duplicada',true,'importacion_id',v_importacion_existente,'estado',v_estado_existente); END IF; INSERT INTO public.importaciones(organizacion_id,sucursal_id,usuario_id,tipo_reporte,codigo_sucursal_fuente,fecha_reporte,nombre_archivo,archivo_sha256,filas_total,filas_validas,filas_descartadas,modo,estado) VALUES(v_org_id,p_sucursal_id,p_usuario_id,'reposicion_asistida',p_codigo_sucursal_fuente,p_fecha_reporte,p_nombre_archivo,p_archivo_sha256,GREATEST(COALESCE(p_filas_total,v_operaciones_count),0),GREATEST(COALESCE(p_filas_validas,v_operaciones_count),0),GREATEST(COALESCE(p_filas_descartadas,0),0),'familia','validada') RETURNING id INTO v_importacion_id; PERFORM set_config('noven.skip_legacy_bridge','1',true); FOR v_op IN SELECT * FROM jsonb_to_recordset(p_operaciones) AS x(accion text,producto_id uuid,cod_art text,descripcion text,marca text,gramaje text,stock integer,venta_media_diaria numeric,fila_origen integer,corregir_cod_art boolean,asignar_familia boolean) LOOP IF v_op.accion NOT IN('actualizar','insertar') THEN RAISE EXCEPTION 'Operación de importación inválida: %',v_op.accion; END IF; IF btrim(COALESCE(v_op.cod_art,''))='' THEN RAISE EXCEPTION 'Operación sin cod_art'; END IF; IF v_op.stock IS NULL THEN RAISE EXCEPTION 'Stock ausente para %',v_op.cod_art; END IF; IF v_op.accion='actualizar' THEN IF v_op.producto_id IS NULL THEN RAISE EXCEPTION 'Operación actualizar sin producto_id para %',v_op.cod_art; END IF; UPDATE public.productos p SET cod_art=CASE WHEN COALESCE(v_op.corregir_cod_art,false) THEN btrim(v_op.cod_art) ELSE p.cod_art END,marca=CASE WHEN NULLIF(btrim(COALESCE(v_op.marca,'')),'') IS NOT NULL THEN btrim(v_op.marca) ELSE p.marca END,gramaje=COALESCE(v_op.gramaje,p.gramaje),familia_id=CASE WHEN COALESCE(v_op.asignar_familia,false) THEN v_familia_id ELSE p.familia_id END,updated_at=now() WHERE p.id=v_op.producto_id AND p.organizacion_id=v_org_id RETURNING p.id INTO v_producto_id; IF v_producto_id IS NULL THEN RAISE EXCEPTION 'Producto % fuera de la organización o inexistente',v_op.producto_id; END IF; v_actualizados:=v_actualizados+1; ELSE INSERT INTO public.productos(organizacion_id,cod_art,descripcion,marca,gramaje,categoria,familia_id,stock_actual,venta_media_diaria,activo) VALUES(v_org_id,btrim(v_op.cod_art),COALESCE(NULLIF(btrim(v_op.descripcion),''),btrim(v_op.cod_art)),NULLIF(btrim(COALESCE(v_op.marca,'')),''),v_op.gramaje,'OTRO',v_familia_id,0,0,true) RETURNING id INTO v_producto_id; v_nuevos:=v_nuevos+1; END IF; INSERT INTO public.producto_sucursal(organizacion_id,producto_id,sucursal_id,stock_actual,venta_media_diaria,fecha_ultima_importacion) VALUES(v_org_id,v_producto_id,p_sucursal_id,v_op.stock,COALESCE(v_op.venta_media_diaria,0),now()) ON CONFLICT(producto_id,sucursal_id) DO UPDATE SET stock_actual=EXCLUDED.stock_actual,venta_media_diaria=EXCLUDED.venta_media_diaria,fecha_ultima_importacion=EXCLUDED.fecha_ultima_importacion,updated_at=now(); INSERT INTO public.producto_snapshots(importacion_id,organizacion_id,sucursal_id,producto_id,stock,venta_media_diaria,fila_origen) VALUES(v_importacion_id,v_org_id,p_sucursal_id,v_producto_id,v_op.stock,COALESCE(v_op.venta_media_diaria,0),v_op.fila_origen); IF p_sucursal_id=v_legacy_091 THEN UPDATE public.productos SET stock_actual=v_op.stock,venta_media_diaria=COALESCE(v_op.venta_media_diaria,0),updated_at=now() WHERE id=v_producto_id AND organizacion_id=v_org_id; END IF; END LOOP; UPDATE public.importaciones SET filas_aplicadas=v_actualizados+v_nuevos,filas_sin_mapear=0,filas_sin_familia=0,estado='aplicada',aplicada_at=now() WHERE id=v_importacion_id; RETURN jsonb_build_object('duplicada',false,'importacion_id',v_importacion_id,'actualizados',v_actualizados,'nuevos',v_nuevos,'aplicadas',v_actualizados+v_nuevos); END; $function$

CREATE OR REPLACE FUNCTION public.aplicar_importacion_glaciar_familia_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_operaciones jsonb, p_fecha_reporte date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.validar_operacion_local_server_v1(p_usuario_id,p_sucursal_id) THEN
    RAISE EXCEPTION 'El usuario no tiene permiso operativo para importar esta familia en la sucursal'
      USING ERRCODE='42501';
  END IF;
  RETURN public.aplicar_importacion_glaciar_familia_legacy_v1(
    p_sucursal_id,p_usuario_id,p_codigo_sucursal_fuente,p_codigo_familia,
    p_nombre_archivo,p_archivo_sha256,p_filas_total,p_filas_validas,
    p_filas_descartadas,p_operaciones,p_fecha_reporte
  );
END;
$function$
