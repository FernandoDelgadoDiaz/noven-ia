CREATE OR REPLACE FUNCTION noven_private.trg_problema_economico_costo_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ DECLARE r record; BEGIN FOR r IN SELECT v.id FROM public.vencimientos v WHERE v.producto_id=NEW.producto_id AND v.activo=true LOOP PERFORM noven_private.sincronizar_problema_economico_v1(r.id,COALESCE(NEW.observado_at,now()),'costo_0258','evento'); END LOOP; RETURN NEW; END; $function$

CREATE OR REPLACE FUNCTION noven_private.trg_problema_economico_producto_sucursal_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ DECLARE r record; BEGIN FOR r IN SELECT v.id FROM public.vencimientos v WHERE v.producto_id=NEW.producto_id AND v.sucursal_id=NEW.sucursal_id AND v.activo=true LOOP PERFORM noven_private.sincronizar_problema_economico_v1(r.id,COALESCE(NEW.updated_at,now()),'producto_sucursal','evento'); END LOOP; RETURN NEW; END; $function$

CREATE OR REPLACE FUNCTION noven_private.trg_problema_economico_vencimiento_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN PERFORM noven_private.sincronizar_problema_economico_v1(NEW.id,COALESCE(NEW.updated_at,NEW.created_at,now()),'vencimiento','evento'); RETURN NEW; END; $function$

CREATE OR REPLACE FUNCTION noven_private.trigger_control_local_radar_zonal_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN IF NEW.activo=true THEN UPDATE public.alertas_zonales_destinos d SET estado='ya_controlado',respuesta_at=COALESCE(d.respuesta_at,now()),vencimiento_destino_id=NEW.id,updated_at=now() FROM public.alertas_zonales a WHERE a.id=d.alerta_id AND a.producto_id=NEW.producto_id AND d.sucursal_id=NEW.sucursal_id AND d.estado IN ('pendiente','revisar_despues','sin_responsable'); END IF; RETURN NEW; END; $function$

CREATE OR REPLACE FUNCTION noven_private.trigger_estado_producto_radar_zonal_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_source record;
BEGIN
  IF NEW.stock_actual<=0 THEN UPDATE public.alertas_zonales_destinos d SET estado='sin_stock',respuesta_at=COALESCE(d.respuesta_at,now()),updated_at=now() FROM public.alertas_zonales a WHERE a.id=d.alerta_id AND a.producto_id=NEW.producto_id AND d.sucursal_id=NEW.sucursal_id AND d.estado IN ('pendiente','revisar_despues','sin_responsable'); RETURN NEW; END IF;
  IF TG_OP='INSERT' OR OLD.stock_actual<=0 THEN
    FOR v_source IN SELECT v.id FROM public.vencimientos v JOIN public.sucursales so ON so.id=v.sucursal_id JOIN public.sucursales sd ON sd.id=NEW.sucursal_id WHERE v.producto_id=NEW.producto_id AND v.activo=true AND v.sucursal_id<>NEW.sucursal_id AND so.organizacion_id=NEW.organizacion_id AND sd.organizacion_id=NEW.organizacion_id AND so.zona_id=sd.zona_id
    LOOP PERFORM noven_private.generar_radar_zonal_v1(v_source.id); END LOOP;
  END IF; RETURN NEW;
END; $function$

CREATE OR REPLACE FUNCTION noven_private.trigger_generar_radar_zonal_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN IF NEW.activo=true THEN PERFORM noven_private.generar_radar_zonal_v1(NEW.id); END IF; RETURN NEW; END; $function$

CREATE OR REPLACE FUNCTION noven_private.upsert_stock_producto_sucursal_scanner(p_sucursal_id uuid, p_producto_id uuid, p_stock_actual integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ DECLARE v_uid uuid := (SELECT auth.uid()); v_org uuid; BEGIN IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF; IF p_stock_actual IS NULL OR p_stock_actual<0 THEN RAISE EXCEPTION 'Stock inválido' USING ERRCODE='22023'; END IF; SELECT s.organizacion_id INTO v_org FROM public.sucursales s JOIN public.productos p ON p.organizacion_id=s.organizacion_id AND p.id=p_producto_id WHERE s.id=p_sucursal_id AND s.activa=true; IF v_org IS NULL THEN RAISE EXCEPTION 'Producto/sucursal incompatibles o inexistentes' USING ERRCODE='P0002'; END IF; IF NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id,p_producto_id) THEN RAISE EXCEPTION 'Sin permiso para actualizar este producto en la sucursal' USING ERRCODE='42501'; END IF; INSERT INTO public.producto_sucursal(organizacion_id,producto_id,sucursal_id,stock_actual,venta_media_diaria) VALUES(v_org,p_producto_id,p_sucursal_id,p_stock_actual,0) ON CONFLICT(producto_id,sucursal_id) DO UPDATE SET stock_actual=EXCLUDED.stock_actual,updated_at=now(); END; $function$
