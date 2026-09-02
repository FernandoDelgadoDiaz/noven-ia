SET check_function_bodies = false;

CREATE OR REPLACE FUNCTION noven_private.actualizar_imagen_producto_operador_impl(p_sucursal_id uuid, p_producto_id uuid, p_imagen_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ DECLARE v_uid uuid := (SELECT auth.uid()); BEGIN IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF; IF NULLIF(btrim(COALESCE(p_imagen_url,'')),'') IS NULL THEN RAISE EXCEPTION 'URL de imagen obligatoria' USING ERRCODE='22023'; END IF; IF NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id,p_producto_id) THEN RAISE EXCEPTION 'Sin permiso para modificar la imagen de este producto' USING ERRCODE='42501'; END IF; UPDATE public.productos p SET imagen_url=btrim(p_imagen_url),updated_at=pg_catalog.now() WHERE p.id=p_producto_id AND EXISTS(SELECT 1 FROM public.sucursales s WHERE s.id=p_sucursal_id AND s.organizacion_id=p.organizacion_id AND s.activa=true); IF NOT FOUND THEN RAISE EXCEPTION 'Producto/sucursal incompatibles o inexistentes' USING ERRCODE='P0002'; END IF; END; $function$

CREATE OR REPLACE FUNCTION noven_private.actualizar_imagen_producto_operador_v2_impl(p_sucursal_id uuid, p_producto_id uuid, p_imagen_url text, p_imagen_thumb_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_imagen_actual text;
  v_accion text;
  v_fragmento text;
  v_full_tail text;
  v_thumb_tail text;
  v_full_version uuid;
  v_thumb_version uuid;
  v_full_path text;
  v_thumb_path text;
  v_full_pos integer;
  v_thumb_pos integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000';
  END IF;

  IF NULLIF(pg_catalog.btrim(COALESCE(p_imagen_url,'')),'') IS NULL
     OR NULLIF(pg_catalog.btrim(COALESCE(p_imagen_thumb_url,'')),'') IS NULL THEN
    RAISE EXCEPTION 'Las URLs de imagen son obligatorias' USING ERRCODE='22023';
  END IF;

  SELECT p.organizacion_id, p.imagen_url
  INTO v_org, v_imagen_actual
  FROM public.productos p
  JOIN public.sucursales s
    ON s.id = p_sucursal_id
   AND s.organizacion_id = p.organizacion_id
   AND s.activa = true
  WHERE p.id = p_producto_id
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto/sucursal incompatibles o inexistentes' USING ERRCODE='P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id,p_producto_id) THEN
    RAISE EXCEPTION 'Sin permiso para gestionar la foto de este producto' USING ERRCODE='42501';
  END IF;

  v_accion := CASE
    WHEN NULLIF(pg_catalog.btrim(COALESCE(v_imagen_actual,'')),'') IS NULL THEN 'agregar'
    ELSE 'reemplazar'
  END;

  IF v_accion='reemplazar'
     AND NOT noven_private.puede_reemplazar_imagen_producto(p_sucursal_id,p_producto_id) THEN
    RAISE EXCEPTION 'La foto ya existe; el reemplazo requiere supervisor o gerencia' USING ERRCODE='42501';
  END IF;

  v_fragmento := '/productos-imagenes/' || v_org::text || '/productos/' || p_producto_id::text || '/';
  v_full_pos := pg_catalog.strpos(p_imagen_url, v_fragmento);
  v_thumb_pos := pg_catalog.strpos(p_imagen_thumb_url, v_fragmento);

  IF v_full_pos=0 OR v_thumb_pos=0 THEN
    RAISE EXCEPTION 'Ruta de imagen fuera del catálogo de la organización' USING ERRCODE='22023';
  END IF;

  v_full_tail := pg_catalog.split_part(
    pg_catalog.substr(p_imagen_url, v_full_pos + pg_catalog.length(v_fragmento)),
    '?',
    1
  );
  v_thumb_tail := pg_catalog.split_part(
    pg_catalog.substr(p_imagen_thumb_url, v_thumb_pos + pg_catalog.length(v_fragmento)),
    '?',
    1
  );

  IF pg_catalog.split_part(v_full_tail,'/',2) <> 'full.webp'
     OR pg_catalog.split_part(v_full_tail,'/',3) <> ''
     OR pg_catalog.split_part(v_thumb_tail,'/',2) <> 'thumb.webp'
     OR pg_catalog.split_part(v_thumb_tail,'/',3) <> '' THEN
    RAISE EXCEPTION 'La foto debe usar rutas versionadas full/thumb' USING ERRCODE='22023';
  END IF;

  BEGIN
    v_full_version := pg_catalog.split_part(v_full_tail,'/',1)::uuid;
    v_thumb_version := pg_catalog.split_part(v_thumb_tail,'/',1)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Versión de imagen inválida' USING ERRCODE='22023';
  END;

  IF v_full_version IS DISTINCT FROM v_thumb_version THEN
    RAISE EXCEPTION 'Full y miniatura deben pertenecer a la misma versión' USING ERRCODE='22023';
  END IF;

  v_full_path := v_org::text || '/productos/' || p_producto_id::text || '/' || v_full_version::text || '/full.webp';
  v_thumb_path := v_org::text || '/productos/' || p_producto_id::text || '/' || v_full_version::text || '/thumb.webp';

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id='productos-imagenes' AND o.name=v_full_path
  ) OR NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id='productos-imagenes' AND o.name=v_thumb_path
  ) THEN
    RAISE EXCEPTION 'La versión de imagen no está completa en Storage' USING ERRCODE='23514';
  END IF;

  UPDATE public.productos
  SET imagen_url=pg_catalog.btrim(p_imagen_url),
      imagen_thumb_url=pg_catalog.btrim(p_imagen_thumb_url),
      updated_at=pg_catalog.now()
  WHERE id=p_producto_id AND organizacion_id=v_org;

  INSERT INTO public.producto_imagen_cambios(
    organizacion_id,producto_id,sucursal_id,usuario_id,accion,imagen_url,imagen_thumb_url
  ) VALUES (
    v_org,p_producto_id,p_sucursal_id,v_uid,v_accion,
    pg_catalog.btrim(p_imagen_url),pg_catalog.btrim(p_imagen_thumb_url)
  );
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.actualizar_vencimiento_operador_impl(p_vencimiento_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF; RETURN public.actualizar_vencimiento_operador_invoker_v1(p_vencimiento_id,p_cantidad,p_fecha_vencimiento,p_lote); END; $function$

CREATE OR REPLACE FUNCTION noven_private.anular_vencimiento_carga_incorrecta_impl(p_vencimiento_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF; PERFORM public.anular_vencimiento_carga_incorrecta_invoker_v1(p_vencimiento_id,p_motivo); END; $function$

CREATE OR REPLACE FUNCTION noven_private.cerrar_vencimiento_operativo_impl(p_vencimiento_id uuid, p_resultado text, p_observaciones text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF; RETURN public.cerrar_vencimiento_operativo_invoker_v1(p_vencimiento_id,p_resultado,p_observaciones); END; $function$

CREATE OR REPLACE FUNCTION noven_private.completar_cod_art_producto_scanner_impl(p_sucursal_id uuid, p_producto_id uuid, p_cod_art text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  RETURN public.completar_cod_art_producto_scanner_invoker_v1(p_sucursal_id,p_producto_id,p_cod_art);
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.crear_producto_scanner_impl(p_sucursal_id uuid, p_cod_art text, p_ean text, p_descripcion text, p_marca text, p_categoria text, p_stock_actual integer, p_venta_media_diaria numeric, p_familia_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  RETURN public.crear_producto_scanner_invoker_v1(p_sucursal_id,p_cod_art,p_ean,p_descripcion,p_marca,p_categoria,p_stock_actual,p_venta_media_diaria,p_familia_id);
END;
$function$
