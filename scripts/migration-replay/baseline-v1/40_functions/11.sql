CREATE OR REPLACE FUNCTION public.completar_cod_art_producto_scanner(p_sucursal_id uuid, p_producto_id uuid, p_cod_art text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  SELECT noven_private.completar_cod_art_producto_scanner_impl(p_sucursal_id,p_producto_id,p_cod_art);
$function$

CREATE OR REPLACE FUNCTION public.completar_cod_art_producto_scanner_invoker_v1(p_sucursal_id uuid, p_producto_id uuid, p_cod_art text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := noven_private.scanner_org(p_sucursal_id);
  v_cod text := btrim(p_cod_art);
  v_cod_actual text;
  v_conflicto jsonb;
BEGIN
  IF v_cod !~ '^[0-9]{7}$' THEN
    RAISE EXCEPTION 'Código interno inválido' USING ERRCODE = '22023';
  END IF;

  SELECT p.cod_art
    INTO v_cod_actual
  FROM public.productos p
  WHERE p.id = p_producto_id
    AND p.organizacion_id = v_org;

  IF NOT FOUND
     OR NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id, p_producto_id) THEN
    RAISE EXCEPTION 'Producto fuera del alcance' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(COALESCE(v_cod_actual, '')), '') IS NOT NULL THEN
    RAISE EXCEPTION 'El producto ya tiene código interno; la corrección requiere el flujo de catálogo'
      USING ERRCODE = '42501';
  END IF;

  v_conflicto := public.buscar_conflicto_codigos_scanner(
    p_sucursal_id,
    v_cod,
    '',
    p_producto_id
  );
  IF v_conflicto IS NOT NULL THEN
    RAISE EXCEPTION 'Código interno ocupado por otro producto: %', v_conflicto::text
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.productos
  SET cod_art = v_cod,
      updated_at = now()
  WHERE id = p_producto_id
    AND organizacion_id = v_org
    AND NULLIF(btrim(COALESCE(cod_art, '')), '') IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El código interno fue completado por otra operación. Volvé a cargar el producto.'
      USING ERRCODE = '40001';
  END IF;

  RETURN noven_private.scanner_producto_json(p_producto_id, p_sucursal_id);
END;
$function$

CREATE OR REPLACE FUNCTION public.crear_producto_scanner(p_sucursal_id uuid, p_cod_art text, p_ean text, p_descripcion text, p_marca text, p_categoria text, p_stock_actual integer, p_venta_media_diaria numeric, p_familia_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  SELECT noven_private.crear_producto_scanner_impl(p_sucursal_id,p_cod_art,p_ean,p_descripcion,p_marca,p_categoria,p_stock_actual,p_venta_media_diaria,p_familia_id);
$function$

CREATE OR REPLACE FUNCTION public.crear_producto_scanner_invoker_v1(p_sucursal_id uuid, p_cod_art text, p_ean text, p_descripcion text, p_marca text, p_categoria text, p_stock_actual integer, p_venta_media_diaria numeric, p_familia_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$ DECLARE v_org uuid := noven_private.scanner_org(p_sucursal_id); v_cod text := btrim(p_cod_art); v_ean text := btrim(p_ean); v_desc text := btrim(p_descripcion); v_conflicto jsonb; v_producto_id uuid; v_tipo text; BEGIN IF v_cod !~ '^[0-9]{7}$' THEN RAISE EXCEPTION 'Código interno inválido' USING ERRCODE='22023'; END IF; IF v_ean !~ '^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$' THEN RAISE EXCEPTION 'EAN inválido' USING ERRCODE='22023'; END IF; IF v_desc='' THEN RAISE EXCEPTION 'La descripción es obligatoria' USING ERRCODE='22023'; END IF; IF p_stock_actual IS NULL OR p_stock_actual<0 THEN RAISE EXCEPTION 'Stock inválido' USING ERRCODE='22023'; END IF; IF p_venta_media_diaria IS NULL OR p_venta_media_diaria<0 THEN RAISE EXCEPTION 'Venta media inválida' USING ERRCODE='22023'; END IF; IF p_familia_id IS NULL OR NOT noven_private.puede_ver_familia_sucursal(p_sucursal_id,p_familia_id) THEN RAISE EXCEPTION 'Familia obligatoria o fuera del alcance' USING ERRCODE='42501'; END IF; IF NOT EXISTS(SELECT 1 FROM public.familias f WHERE f.id=p_familia_id AND f.organizacion_id=v_org) THEN RAISE EXCEPTION 'La familia no pertenece a la organización' USING ERRCODE='23503'; END IF; v_conflicto:=public.buscar_conflicto_codigos_scanner(p_sucursal_id,v_cod,v_ean,NULL); IF v_conflicto IS NOT NULL THEN RAISE EXCEPTION 'Conflicto de códigos: %',v_conflicto::text USING ERRCODE='23505'; END IF; PERFORM set_config('noven.skip_legacy_bridge','1',true); INSERT INTO public.productos(cod_art,codigo_barras,descripcion,marca,categoria,stock_actual,venta_media_diaria,familia_id,activo,organizacion_id) VALUES(v_cod,v_ean,v_desc,NULLIF(btrim(COALESCE(p_marca,'')),''),NULLIF(btrim(COALESCE(p_categoria,'')),''),0,0,p_familia_id,true,v_org) RETURNING id INTO v_producto_id; v_tipo:=CASE length(v_ean) WHEN 8 THEN 'ean8' WHEN 12 THEN 'upca' WHEN 13 THEN 'ean13' WHEN 14 THEN 'gtin14' ELSE 'otro' END; INSERT INTO public.producto_codigos(organizacion_id,producto_id,codigo,tipo,es_principal,activo) VALUES(v_org,v_producto_id,v_ean,v_tipo,true,true); INSERT INTO public.producto_sucursal(organizacion_id,producto_id,sucursal_id,stock_actual,venta_media_diaria) VALUES(v_org,v_producto_id,p_sucursal_id,p_stock_actual,p_venta_media_diaria); RETURN noven_private.scanner_producto_json(v_producto_id,p_sucursal_id); END; $function$

CREATE OR REPLACE FUNCTION public.crear_vencimiento_operador(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT noven_private.crear_vencimiento_operador_impl(p_producto_id,p_sucursal_id,p_cantidad,p_fecha_vencimiento,p_lote); $function$

CREATE OR REPLACE FUNCTION public.crear_vencimiento_operador_invoker_v1(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_id uuid;
  v_dias_donacion integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'La cantidad debe ser mayor a cero' USING ERRCODE = '22023'; END IF;
  IF p_fecha_vencimiento IS NULL THEN RAISE EXCEPTION 'La fecha de vencimiento es obligatoria' USING ERRCODE = '22023'; END IF;

  SELECT p.organizacion_id, sec.dias_donacion INTO v_org, v_dias_donacion
  FROM public.productos p
  JOIN public.sucursales su ON su.id = p_sucursal_id AND su.organizacion_id = p.organizacion_id
  LEFT JOIN public.familias f ON f.id = p.familia_id AND f.organizacion_id = p.organizacion_id
  LEFT JOIN public.sectores sec ON sec.id = f.sector_id AND sec.organizacion_id = p.organizacion_id
  WHERE p.id = p_producto_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Producto/sucursal incompatibles o inexistentes' USING ERRCODE = 'P0002'; END IF;
  IF NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id, p_producto_id) THEN RAISE EXCEPTION 'Sin permiso para registrar este producto en la sucursal' USING ERRCODE = '42501'; END IF;
  IF v_dias_donacion IS NULL THEN RAISE EXCEPTION 'Este producto pertenece a un sector fuera del circuito de vencimientos configurado' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.vencimientos(producto_id, sucursal_id, usuario_id, cantidad, lote, fecha_vencimiento, fecha_carga, activo)
  VALUES (p_producto_id, p_sucursal_id, v_uid, p_cantidad, NULLIF(btrim(p_lote), ''), p_fecha_vencimiento, (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, true)
  RETURNING id INTO v_id;

  INSERT INTO public.vencimiento_observaciones(organizacion_id, sucursal_id, producto_id, vencimiento_id, usuario_id, cantidad_comprometida, observada_at, nota)
  VALUES (v_org, p_sucursal_id, p_producto_id, v_id, v_uid, p_cantidad, now(), 'Carga inicial');

  RETURN v_id;
END;
$function$

CREATE OR REPLACE FUNCTION public.fn_familia_exclusiva_operador()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rol      text;
  v_ocupante text;
BEGIN
  IF NEW.familia_id IS NULL OR NEW.usuario_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.familia_id IS NOT DISTINCT FROM OLD.familia_id
     AND NEW.usuario_id IS NOT DISTINCT FROM OLD.usuario_id THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('familia_exclusiva'),
    hashtext(NEW.familia_id::text)
  );

  SELECT rol INTO v_rol
  FROM public.usuarios
  WHERE id = NEW.usuario_id;

  IF v_rol IS DISTINCT FROM 'operador' THEN
    RETURN NEW;
  END IF;

  SELECT u.nombre INTO v_ocupante
  FROM public.usuario_familias uf
  JOIN public.usuarios u ON u.id = uf.usuario_id
  WHERE uf.familia_id  = NEW.familia_id
    AND uf.usuario_id <> NEW.usuario_id
    AND u.rol          = 'operador'
  LIMIT 1;

  IF v_ocupante IS NOT NULL THEN
    RAISE EXCEPTION
      USING errcode = '23505',
            message = format(
              'La familia ya esta asignada al operador %s. Una familia solo puede tener un operador.',
              v_ocupante
            );
  END IF;

  RETURN NEW;
END;
$function$
