CREATE OR REPLACE FUNCTION noven_private.vincular_ean_producto_scanner_impl(p_sucursal_id uuid, p_producto_id uuid, p_ean text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  RETURN public.vincular_ean_producto_scanner_invoker_v1(p_sucursal_id,p_producto_id,p_ean);
END;
$function$

CREATE OR REPLACE FUNCTION public.aceptar_invitacion_acceso_v1()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_uid uuid:=auth.uid(); v_email text; v_count integer;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='42501'; END IF;
 SELECT lower(btrim(u.email)) INTO v_email FROM auth.users u WHERE u.id=v_uid;
 IF v_email IS NULL OR v_email='' THEN RETURN 0; END IF;
 UPDATE public.invitaciones_acceso ia SET estado='anulada',anulada_at=COALESCE(ia.anulada_at,now()) WHERE ia.usuario_id=v_uid AND ia.estado='pendiente' AND ia.expires_at<=now();
 SELECT count(*) INTO v_count FROM public.invitaciones_acceso ia WHERE ia.usuario_id=v_uid AND lower(btrim(ia.email))=v_email AND ia.estado='pendiente' AND ia.expires_at>now();
 IF v_count=0 THEN RETURN 0; END IF;
 IF EXISTS(SELECT 1 FROM public.invitaciones_acceso ia CROSS JOIN LATERAL unnest(ia.familias_ids) fam(familia_id) JOIN public.usuario_familias_sucursal ufs ON ufs.sucursal_id=ia.sucursal_id AND ufs.familia_id=fam.familia_id AND ufs.activo=true AND ufs.usuario_id<>v_uid WHERE ia.usuario_id=v_uid AND lower(btrim(ia.email))=v_email AND ia.rol='operador' AND ia.estado='pendiente' AND ia.expires_at>now()) THEN RAISE EXCEPTION 'Una o más familias ya tienen otro operador responsable en esta sucursal' USING ERRCODE='23505'; END IF;
 UPDATE public.usuario_accesos ua SET activo=true,updated_at=now() WHERE ua.usuario_id=v_uid AND ua.activo=false AND EXISTS(SELECT 1 FROM public.invitaciones_acceso ia WHERE ia.usuario_id=ua.usuario_id AND lower(btrim(ia.email))=v_email AND ia.organizacion_id=ua.organizacion_id AND ia.rol=ua.rol AND ia.estado='pendiente' AND ia.expires_at>now() AND ((ia.rol='gerente_zonal' AND ia.zona_id=ua.zona_id AND ua.sucursal_id IS NULL) OR (ia.rol IN ('gerente_sucursal','supervisor','operador') AND ia.sucursal_id=ua.sucursal_id AND ua.zona_id IS NULL)));
 UPDATE public.usuario_familias_sucursal ufs SET activo=true,updated_at=now() WHERE ufs.usuario_id=v_uid AND ufs.activo=false AND EXISTS(SELECT 1 FROM public.invitaciones_acceso ia WHERE ia.usuario_id=ufs.usuario_id AND lower(btrim(ia.email))=v_email AND ia.organizacion_id=ufs.organizacion_id AND ia.sucursal_id=ufs.sucursal_id AND ia.rol='operador' AND ufs.familia_id=ANY(ia.familias_ids) AND ia.estado='pendiente' AND ia.expires_at>now());
 UPDATE public.usuarios SET activo=true WHERE id=v_uid;
 UPDATE public.invitaciones_acceso ia SET estado='aceptada',accepted_at=now() WHERE ia.usuario_id=v_uid AND lower(btrim(ia.email))=v_email AND ia.estado='pendiente' AND ia.expires_at>now();
 RETURN v_count;
END; $function$

CREATE OR REPLACE FUNCTION public.actualizar_imagen_producto_operador(p_sucursal_id uuid, p_producto_id uuid, p_imagen_url text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT noven_private.actualizar_imagen_producto_operador_impl(p_sucursal_id,p_producto_id,p_imagen_url); $function$

CREATE OR REPLACE FUNCTION public.actualizar_imagen_producto_operador_v2(p_sucursal_id uuid, p_producto_id uuid, p_imagen_url text, p_imagen_thumb_url text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT noven_private.actualizar_imagen_producto_operador_v2_impl(p_sucursal_id,p_producto_id,p_imagen_url,p_imagen_thumb_url);
$function$

CREATE OR REPLACE FUNCTION public.actualizar_stock_producto_sucursal_scanner(p_sucursal_id uuid, p_producto_id uuid, p_stock_actual integer)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$ SELECT noven_private.upsert_stock_producto_sucursal_scanner(p_sucursal_id,p_producto_id,p_stock_actual); $function$

CREATE OR REPLACE FUNCTION public.actualizar_vencimiento_operador(p_vencimiento_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT noven_private.actualizar_vencimiento_operador_impl(p_vencimiento_id,p_cantidad,p_fecha_vencimiento,p_lote); $function$

CREATE OR REPLACE FUNCTION public.actualizar_vencimiento_operador_invoker_v1(p_vencimiento_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_sucursal uuid;
  v_producto uuid;
  v_dias_donacion integer;
  v_obs_id bigint;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'La cantidad debe ser mayor a cero' USING ERRCODE = '22023'; END IF;
  IF p_fecha_vencimiento IS NULL THEN RAISE EXCEPTION 'La fecha de vencimiento es obligatoria' USING ERRCODE = '22023'; END IF;

  SELECT p.organizacion_id, v.sucursal_id, v.producto_id, sec.dias_donacion
    INTO v_org, v_sucursal, v_producto, v_dias_donacion
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  LEFT JOIN public.familias f ON f.id = p.familia_id AND f.organizacion_id = p.organizacion_id
  LEFT JOIN public.sectores sec ON sec.id = f.sector_id AND sec.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id AND v.activo = true;

  IF NOT FOUND THEN RAISE EXCEPTION 'Vencimiento activo no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN RAISE EXCEPTION 'Sin permiso para actualizar este vencimiento' USING ERRCODE = '42501'; END IF;
  IF v_dias_donacion IS NULL THEN RAISE EXCEPTION 'Este producto pertenece a un sector fuera del circuito de vencimientos configurado' USING ERRCODE = '22023'; END IF;

  UPDATE public.vencimientos SET cantidad=p_cantidad, fecha_vencimiento=p_fecha_vencimiento, lote=NULLIF(btrim(p_lote), '') WHERE id=p_vencimiento_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RAISE EXCEPTION 'La política de acceso impidió actualizar el vencimiento' USING ERRCODE = '42501'; END IF;

  INSERT INTO public.vencimiento_observaciones(organizacion_id, sucursal_id, producto_id, vencimiento_id, usuario_id, cantidad_comprometida, nota)
  VALUES (v_org, v_sucursal, v_producto, p_vencimiento_id, v_uid, p_cantidad, 'Control desde Scanner')
  RETURNING id INTO v_obs_id;

  RETURN v_obs_id;
END;
$function$
