CREATE OR REPLACE FUNCTION public.aplicar_importacion_glaciar_masiva(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_items jsonb, p_fecha_reporte date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$ DECLARE v_org_id uuid; v_zona_id uuid; v_codigo_sucursal text; v_importacion_id uuid; v_importacion_existente uuid; v_estado_existente text; v_aplicadas integer:=0; v_sin_mapear integer:=0; v_sin_familia integer:=0; v_items_count integer:=0; v_legacy_091 constant uuid:='00000000-0000-0000-0000-000000000001'::uuid; BEGIN IF p_usuario_id IS NULL THEN RAISE EXCEPTION 'Usuario requerido para importar'; END IF; IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' THEN RAISE EXCEPTION 'p_items debe ser un array JSON'; END IF; v_items_count:=jsonb_array_length(p_items); IF v_items_count=0 THEN RAISE EXCEPTION 'La importación no contiene filas'; END IF; IF p_archivo_sha256 IS NULL OR p_archivo_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'SHA-256 de archivo inválido'; END IF; SELECT s.organizacion_id,s.zona_id,s.codigo INTO v_org_id,v_zona_id,v_codigo_sucursal FROM public.sucursales s WHERE s.id=p_sucursal_id AND s.activa=true; IF v_org_id IS NULL THEN RAISE EXCEPTION 'Sucursal inexistente o inactiva'; END IF; IF btrim(COALESCE(p_codigo_sucursal_fuente,''))<>v_codigo_sucursal THEN RAISE EXCEPTION 'El archivo corresponde a la sucursal %, pero la sesión intenta importar en %',p_codigo_sucursal_fuente,v_codigo_sucursal; END IF; IF NOT EXISTS(SELECT 1 FROM public.usuario_accesos ua WHERE ua.usuario_id=p_usuario_id AND ua.organizacion_id=v_org_id AND ua.activo=true AND (ua.rol='admin_organizacion' OR (ua.rol='gerente_zonal' AND ua.zona_id=v_zona_id) OR (ua.rol IN('gerente_sucursal','supervisor') AND ua.sucursal_id=p_sucursal_id))) THEN RAISE EXCEPTION 'El usuario no tiene permiso para importar el asistido completo de esta sucursal'; END IF; SELECT i.id,i.estado INTO v_importacion_existente,v_estado_existente FROM public.importaciones i WHERE i.sucursal_id=p_sucursal_id AND i.tipo_reporte='reposicion_asistida' AND i.archivo_sha256=p_archivo_sha256; IF v_importacion_existente IS NOT NULL THEN RETURN jsonb_build_object('duplicada',true,'importacion_id',v_importacion_existente,'estado',v_estado_existente); END IF; INSERT INTO public.importaciones(organizacion_id,sucursal_id,usuario_id,tipo_reporte,codigo_sucursal_fuente,fecha_reporte,nombre_archivo,archivo_sha256,filas_total,filas_validas,filas_descartadas,modo,estado) VALUES(v_org_id,p_sucursal_id,p_usuario_id,'reposicion_asistida',p_codigo_sucursal_fuente,p_fecha_reporte,p_nombre_archivo,p_archivo_sha256,GREATEST(COALESCE(p_filas_total,v_items_count),0),GREATEST(COALESCE(p_filas_validas,v_items_count),0),GREATEST(COALESCE(p_filas_descartadas,0),0),'masiva','validada') RETURNING id INTO v_importacion_id; WITH entrada AS (SELECT btrim(x.cod_art) AS cod_art,x.stock,COALESCE(x.venta_media_diaria,0) AS venta_media_diaria,x.fila_origen FROM jsonb_to_recordset(p_items) AS x(cod_art text,stock integer,venta_media_diaria numeric,fila_origen integer)),resuelta AS (SELECT e.*,p.id AS producto_id,p.familia_id FROM entrada e LEFT JOIN public.productos p ON p.organizacion_id=v_org_id AND p.cod_art=e.cod_art AND p.activo=true) SELECT count(*) FILTER(WHERE producto_id IS NOT NULL AND familia_id IS NOT NULL),count(*) FILTER(WHERE producto_id IS NULL),count(*) FILTER(WHERE producto_id IS NOT NULL AND familia_id IS NULL) INTO v_aplicadas,v_sin_mapear,v_sin_familia FROM resuelta; WITH entrada AS (SELECT btrim(x.cod_art) AS cod_art,x.stock,COALESCE(x.venta_media_diaria,0) AS venta_media_diaria FROM jsonb_to_recordset(p_items) AS x(cod_art text,stock integer,venta_media_diaria numeric,fila_origen integer)),ruteable AS (SELECT p.id AS producto_id,e.stock,e.venta_media_diaria FROM entrada e JOIN public.productos p ON p.organizacion_id=v_org_id AND p.cod_art=e.cod_art AND p.activo=true AND p.familia_id IS NOT NULL) INSERT INTO public.producto_sucursal(organizacion_id,producto_id,sucursal_id,stock_actual,venta_media_diaria,fecha_ultima_importacion) SELECT v_org_id,r.producto_id,p_sucursal_id,r.stock,r.venta_media_diaria,now() FROM ruteable r ON CONFLICT(producto_id,sucursal_id) DO UPDATE SET stock_actual=EXCLUDED.stock_actual,venta_media_diaria=EXCLUDED.venta_media_diaria,fecha_ultima_importacion=EXCLUDED.fecha_ultima_importacion,updated_at=now(); WITH entrada AS (SELECT btrim(x.cod_art) AS cod_art,x.stock,COALESCE(x.venta_media_diaria,0) AS venta_media_diaria,x.fila_origen FROM jsonb_to_recordset(p_items) AS x(cod_art text,stock integer,venta_media_diaria numeric,fila_origen integer)),ruteable AS (SELECT p.id AS producto_id,e.stock,e.venta_media_diaria,e.fila_origen FROM entrada e JOIN public.productos p ON p.organizacion_id=v_org_id AND p.cod_art=e.cod_art AND p.activo=true AND p.familia_id IS NOT NULL) INSERT INTO public.producto_snapshots(importacion_id,organizacion_id,sucursal_id,producto_id,stock,venta_media_diaria,fila_origen) SELECT v_importacion_id,v_org_id,p_sucursal_id,r.producto_id,r.stock,r.venta_media_diaria,r.fila_origen FROM ruteable r; IF p_sucursal_id=v_legacy_091 THEN WITH entrada AS (SELECT btrim(x.cod_art) AS cod_art,x.stock,COALESCE(x.venta_media_diaria,0) AS venta_media_diaria FROM jsonb_to_recordset(p_items) AS x(cod_art text,stock integer,venta_media_diaria numeric,fila_origen integer)) UPDATE public.productos p SET stock_actual=e.stock,venta_media_diaria=e.venta_media_diaria,updated_at=now() FROM entrada e WHERE p.organizacion_id=v_org_id AND p.cod_art=e.cod_art AND p.activo=true AND p.familia_id IS NOT NULL; END IF; UPDATE public.importaciones SET filas_aplicadas=v_aplicadas,filas_sin_mapear=v_sin_mapear,filas_sin_familia=v_sin_familia,estado='aplicada',aplicada_at=now() WHERE id=v_importacion_id; RETURN jsonb_build_object('duplicada',false,'importacion_id',v_importacion_id,'aplicadas',v_aplicadas,'sin_mapear',v_sin_mapear,'sin_familia',v_sin_familia,'familias',(WITH entrada AS (SELECT btrim(x.cod_art) AS cod_art FROM jsonb_to_recordset(p_items) AS x(cod_art text,stock integer,venta_media_diaria numeric,fila_origen integer)) SELECT COALESCE(jsonb_agg(resumen ORDER BY productos DESC,nombre),'[]'::jsonb) FROM (SELECT f.id AS familia_id,f.codigo,f.nombre,count(*) AS productos FROM entrada e JOIN public.productos p ON p.organizacion_id=v_org_id AND p.cod_art=e.cod_art AND p.activo=true AND p.familia_id IS NOT NULL JOIN public.familias f ON f.id=p.familia_id GROUP BY f.id,f.codigo,f.nombre) resumen)); END; $function$

CREATE OR REPLACE FUNCTION public.aplicar_importacion_glaciar_masiva_legacy_v2(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_items jsonb, p_fecha_reporte date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$ DECLARE v_resultado jsonb; v_importacion_id uuid; v_org_id uuid; v_pendientes integer:=0; BEGIN SELECT public.aplicar_importacion_glaciar_masiva(p_sucursal_id,p_usuario_id,p_codigo_sucursal_fuente,p_nombre_archivo,p_archivo_sha256,p_filas_total,p_filas_validas,p_filas_descartadas,p_items,p_fecha_reporte) INTO v_resultado; IF COALESCE((v_resultado->>'duplicada')::boolean,false) THEN RETURN v_resultado; END IF; v_importacion_id:=(v_resultado->>'importacion_id')::uuid; SELECT organizacion_id INTO v_org_id FROM public.importaciones WHERE id=v_importacion_id; IF v_org_id IS NULL THEN RAISE EXCEPTION 'No se pudo resolver la organización de la importación'; END IF; WITH entrada AS (SELECT btrim(x.cod_art) cod_art,NULLIF(btrim(x.descripcion),'') descripcion,NULLIF(btrim(x.marca),'') marca,NULLIF(btrim(x.gramaje),'') gramaje FROM jsonb_to_recordset(p_items) AS x(cod_art text,descripcion text,marca text,gramaje text,stock integer,venta_media_diaria numeric,fila_origen integer)),pendientes AS (SELECT e.*,p.id producto_id FROM entrada e LEFT JOIN public.productos p ON p.organizacion_id=v_org_id AND p.cod_art=e.cod_art AND p.activo=true WHERE p.id IS NULL OR p.familia_id IS NULL) INSERT INTO public.productos_pendientes_catalogo(organizacion_id,cod_art,descripcion,marca,gramaje,producto_id,last_detected_at) SELECT v_org_id,pe.cod_art,COALESCE(pe.descripcion,pe.cod_art),pe.marca,pe.gramaje,pe.producto_id,now() FROM pendientes pe ON CONFLICT(organizacion_id,cod_art) DO UPDATE SET descripcion=COALESCE(NULLIF(EXCLUDED.descripcion,''),public.productos_pendientes_catalogo.descripcion),marca=COALESCE(EXCLUDED.marca,public.productos_pendientes_catalogo.marca),gramaje=COALESCE(EXCLUDED.gramaje,public.productos_pendientes_catalogo.gramaje),producto_id=COALESCE(public.productos_pendientes_catalogo.producto_id,EXCLUDED.producto_id),last_detected_at=now() WHERE public.productos_pendientes_catalogo.estado='pendiente'; WITH entrada AS (SELECT btrim(x.cod_art) cod_art,x.stock,COALESCE(x.venta_media_diaria,0) venta_media_diaria,x.fila_origen FROM jsonb_to_recordset(p_items) AS x(cod_art text,descripcion text,marca text,gramaje text,stock integer,venta_media_diaria numeric,fila_origen integer)) INSERT INTO public.producto_pendiente_detecciones(pendiente_id,organizacion_id,sucursal_id,importacion_id,stock,venta_media_diaria,fila_origen) SELECT pp.id,v_org_id,p_sucursal_id,v_importacion_id,e.stock,e.venta_media_diaria,e.fila_origen FROM entrada e JOIN public.productos_pendientes_catalogo pp ON pp.organizacion_id=v_org_id AND pp.cod_art=e.cod_art AND pp.estado='pendiente' LEFT JOIN public.productos p ON p.organizacion_id=v_org_id AND p.cod_art=e.cod_art AND p.activo=true WHERE p.id IS NULL OR p.familia_id IS NULL ON CONFLICT(pendiente_id,importacion_id) DO NOTHING; SELECT count(*) INTO v_pendientes FROM public.productos_pendientes_catalogo pp WHERE pp.organizacion_id=v_org_id AND pp.estado='pendiente'; RETURN v_resultado||jsonb_build_object('pendientes_organizacion',v_pendientes); END; $function$

CREATE OR REPLACE FUNCTION public.aplicar_importacion_glaciar_masiva_v2(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_items jsonb, p_fecha_reporte date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.validar_operacion_local_server_v1(p_usuario_id,p_sucursal_id) THEN
    RAISE EXCEPTION 'El usuario no tiene permiso operativo para importar en la sucursal'
      USING ERRCODE='42501';
  END IF;
  RETURN public.aplicar_importacion_glaciar_masiva_legacy_v2(
    p_sucursal_id,p_usuario_id,p_codigo_sucursal_fuente,p_nombre_archivo,
    p_archivo_sha256,p_filas_total,p_filas_validas,p_filas_descartadas,
    p_items,p_fecha_reporte
  );
END;
$function$

CREATE OR REPLACE FUNCTION public.buscar_conflicto_codigos_scanner(p_sucursal_id uuid, p_cod_art text, p_ean text, p_excluir_producto_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$ DECLARE v_org uuid := noven_private.scanner_org(p_sucursal_id); v_cod text := btrim(COALESCE(p_cod_art,'')); v_ean text := btrim(COALESCE(p_ean,'')); v_id uuid; v_motivo text; BEGIN IF v_cod<>'' THEN SELECT p.id INTO v_id FROM public.productos p WHERE p.organizacion_id=v_org AND p.cod_art=v_cod AND (p_excluir_producto_id IS NULL OR p.id<>p_excluir_producto_id) LIMIT 1; IF v_id IS NOT NULL THEN v_motivo:='cod_art_ocupado'; END IF; END IF; IF v_id IS NULL AND v_ean<>'' THEN SELECT p.id INTO v_id FROM public.productos p WHERE p.organizacion_id=v_org AND (p_excluir_producto_id IS NULL OR p.id<>p_excluir_producto_id) AND (p.codigo_barras=v_ean OR EXISTS(SELECT 1 FROM public.producto_codigos pc WHERE pc.organizacion_id=v_org AND pc.producto_id=p.id AND pc.codigo=v_ean AND pc.activo=true)) LIMIT 1; IF v_id IS NOT NULL THEN v_motivo:='ean_ocupado'; END IF; END IF; IF v_id IS NULL AND v_ean<>'' THEN SELECT p.id INTO v_id FROM public.productos p WHERE p.organizacion_id=v_org AND p.cod_art=v_ean AND (p_excluir_producto_id IS NULL OR p.id<>p_excluir_producto_id) LIMIT 1; IF v_id IS NOT NULL THEN v_motivo:='ean_guardado_como_cod_art'; END IF; END IF; IF v_id IS NULL THEN RETURN NULL; END IF; RETURN jsonb_build_object('motivo',v_motivo,'producto',noven_private.scanner_producto_json(v_id,p_sucursal_id)); END; $function$

CREATE OR REPLACE FUNCTION public.buscar_producto_scanner(p_sucursal_id uuid, p_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$ DECLARE v_org uuid; v_codigo text := btrim(p_codigo); v_producto_id uuid; BEGIN IF v_codigo='' THEN RETURN NULL; END IF; v_org:=noven_private.scanner_org(p_sucursal_id); SELECT p.id INTO v_producto_id FROM public.productos p WHERE p.organizacion_id=v_org AND p.activo IS DISTINCT FROM false AND (EXISTS(SELECT 1 FROM public.producto_codigos pc WHERE pc.organizacion_id=v_org AND pc.producto_id=p.id AND pc.codigo=v_codigo AND pc.activo=true) OR p.codigo_barras=v_codigo) ORDER BY p.created_at ASC LIMIT 1; IF v_producto_id IS NULL THEN SELECT p.id INTO v_producto_id FROM public.productos p WHERE p.organizacion_id=v_org AND p.activo IS DISTINCT FROM false AND p.cod_art=v_codigo ORDER BY p.created_at ASC LIMIT 1; END IF; IF v_producto_id IS NULL THEN RETURN NULL; END IF; RETURN noven_private.scanner_producto_json(v_producto_id,p_sucursal_id); END; $function$

CREATE OR REPLACE FUNCTION public.cerrar_vencimiento_operativo(p_vencimiento_id uuid, p_resultado text, p_observaciones text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT noven_private.cerrar_vencimiento_operativo_impl(p_vencimiento_id,p_resultado,p_observaciones); $function$

CREATE OR REPLACE FUNCTION public.cerrar_vencimiento_operativo_invoker_v1(p_vencimiento_id uuid, p_resultado text, p_observaciones text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_sucursal uuid;
  v_producto uuid;
  v_cantidad numeric;
  v_cantidad_accion integer;
  v_accion_id uuid;
  v_trimestre integer;
  v_anio integer;
  v_costo_unitario numeric;
  v_costo_observado_at timestamptz;
  v_fecha_operativa date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  if p_resultado not in ('vendido', 'donacion', 'decomiso') then
    raise exception 'Resultado terminal inválido: %', p_resultado using errcode = '22023';
  end if;

  select p.organizacion_id, v.sucursal_id, v.producto_id, v.cantidad
    into v_org, v_sucursal, v_producto, v_cantidad
  from public.vencimientos v
  join public.productos p on p.id = v.producto_id
  where v.id = p_vencimiento_id
    and v.activo = true
  for update of v;

  if not found then
    raise exception 'Vencimiento activo no encontrado o ya cerrado' using errcode = 'P0002';
  end if;

  if not noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) then
    raise exception 'Sin permiso para cerrar este vencimiento' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.acciones_operativas a
    where a.vencimiento_id = p_vencimiento_id
      and a.tipo in ('vendido', 'donacion', 'decomiso')
  ) then
    raise exception 'El vencimiento ya tiene un resultado terminal registrado' using errcode = '23505';
  end if;

  if p_resultado = 'vendido' then
    v_cantidad_accion := ceil(v_cantidad)::integer;

    insert into public.vencimiento_observaciones(
      organizacion_id, sucursal_id, producto_id, vencimiento_id,
      usuario_id, cantidad_comprometida, nota
    ) values (
      v_org, v_sucursal, v_producto, p_vencimiento_id,
      v_uid, 0, 'Cierre: vendido antes del vencimiento'
    );
  else
    if coalesce(v_cantidad, 0) <= 0 then
      raise exception 'No se puede registrar % con cantidad comprometida cero', p_resultado
        using errcode = '22023';
    end if;
    v_cantidad_accion := ceil(v_cantidad)::integer;
  end if;

  select c.costo_unitario, c.observado_at
    into v_costo_unitario, v_costo_observado_at
  from public.producto_costo_ultima_observacion c
  where c.producto_id = v_producto;

  v_anio := extract(year from v_fecha_operativa)::integer;
  v_trimestre := extract(quarter from v_fecha_operativa)::integer;

  insert into public.acciones_operativas(
    tipo, cantidad, producto_id, vencimiento_id, sucursal_id,
    usuario_id, trimestre, anio, observaciones,
    costo_unitario_sin_iva, costo_observado_at, valorizacion_metodo
  ) values (
    p_resultado, v_cantidad_accion, v_producto, p_vencimiento_id, v_sucursal,
    v_uid, v_trimestre, v_anio, nullif(btrim(coalesce(p_observaciones, '')), ''),
    v_costo_unitario, v_costo_observado_at,
    case when v_costo_unitario is not null then 'congelado_al_cierre' else null end
  )
  returning id into v_accion_id;

  update public.vencimientos
  set activo = false,
      updated_at = now()
  where id = p_vencimiento_id;

  return v_accion_id;
end;
$function$
