CREATE OR REPLACE FUNCTION noven_private.marcar_escalamientos_respondidos_v1(p_vencimiento_id uuid, p_respondido_at timestamp with time zone, p_respondido_por uuid, p_tipo text, p_referencia text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actualizados integer := 0;
BEGIN
  IF p_vencimiento_id IS NULL OR p_respondido_at IS NULL THEN RETURN 0; END IF;
  IF p_tipo NOT IN ('control','nueva_intervencion','finalizacion_rag','cierre_terminal') THEN
    RAISE EXCEPTION 'Tipo de respuesta de escalamiento inválido: %', p_tipo;
  END IF;
  UPDATE public.rag_escalamientos e
  SET respondido_at = p_respondido_at,
      respondido_por = p_respondido_por,
      respuesta_tipo = p_tipo,
      respuesta_referencia = p_referencia
  WHERE e.vencimiento_id = p_vencimiento_id
    AND e.respondido_at IS NULL
    AND e.detectado_at < p_respondido_at;
  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  RETURN v_actualizados;
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.nivel_riesgo_vencimiento_zonal_v1(p_vencimiento_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_dias integer;
  v_dias_donacion integer;
  v_cantidad numeric;
  v_vmd numeric;
  v_dias_comerciales numeric;
  v_hay_riesgo boolean;
  v_hoy date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
BEGIN
  SELECT
    v.fecha_vencimiento - v_hoy,
    s.dias_donacion,
    v.cantidad,
    ps.venta_media_diaria
  INTO
    v_dias,
    v_dias_donacion,
    v_cantidad,
    v_vmd
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  JOIN public.producto_sucursal ps
    ON ps.producto_id = v.producto_id
   AND ps.sucursal_id = v.sucursal_id
   AND ps.organizacion_id = p.organizacion_id
  LEFT JOIN public.familias f
    ON f.id = p.familia_id
   AND f.organizacion_id = p.organizacion_id
  LEFT JOIN public.sectores s
    ON s.id = f.sector_id
   AND s.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true;

  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_dias_donacion IS NULL THEN RETURN NULL; END IF;
  IF v_dias <= 0 THEN RETURN 'decomiso'; END IF;
  IF v_dias <= v_dias_donacion THEN RETURN 'donacion'; END IF;

  v_dias_comerciales := GREATEST(v_dias - v_dias_donacion, 0);
  v_hay_riesgo := v_vmd <= 0 OR (v_cantidad / NULLIF(v_vmd, 0)) > v_dias_comerciales;

  IF v_dias <= 20 AND v_hay_riesgo THEN RETURN 'urgente'; END IF;
  IF v_dias <= 45 AND v_hay_riesgo THEN RETURN 'radar'; END IF;
  RETURN 'seguro';
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.nombre_actor_accion_visible(p_usuario_id uuid, p_sucursal_id uuid, p_producto_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_nombre text;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  IF NOT noven_private.puede_leer_producto_sucursal(p_sucursal_id,p_producto_id) THEN RETURN NULL; END IF;
  SELECT u.nombre INTO v_nombre FROM public.usuarios u WHERE u.id=p_usuario_id;
  RETURN v_nombre;
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.notificar_escalamiento_rag_async_v1(p_escalamiento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_webhook_secret text;
  v_request_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.rag_escalamientos e
    WHERE e.id = p_escalamiento_id
      AND e.push_solicitado_at IS NULL
  ) THEN
    RETURN;
  END IF;

  SELECT ds.decrypted_secret
    INTO v_webhook_secret
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'noven_push_webhook_secret'
  LIMIT 1;

  IF v_webhook_secret IS NULL OR v_webhook_secret = '' THEN
    RAISE WARNING 'Noven RAG: secreto de push no disponible para escalamiento %', p_escalamiento_id;
    RETURN;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := 'https://noven-ia.netlify.app/.netlify/functions/enviar-push-rag-escalamiento',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_webhook_secret
      ),
      body := jsonb_build_object('escalamiento_id', p_escalamiento_id)
    ) INTO v_request_id;

    UPDATE public.rag_escalamientos
    SET push_solicitado_at = now(),
        push_request_id = v_request_id
    WHERE id = p_escalamiento_id
      AND push_solicitado_at IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Noven RAG: no se pudo solicitar push para escalamiento %: %', p_escalamiento_id, SQLERRM;
  END;
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.notificar_radar_zonal_async_v1(p_alerta_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_webhook_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.alertas_zonales_destinos d WHERE d.alerta_id=p_alerta_id AND d.estado='pendiente' AND d.usuario_id IS NOT NULL AND d.notificada_at IS NULL) THEN RETURN; END IF;
  SELECT ds.decrypted_secret INTO v_webhook_secret FROM vault.decrypted_secrets ds WHERE ds.name='noven_push_webhook_secret' LIMIT 1;
  IF v_webhook_secret IS NULL OR v_webhook_secret='' THEN RAISE WARNING 'NoVen Radar Zonal: secreto de push no disponible para alerta %',p_alerta_id; RETURN; END IF;
  PERFORM net.http_post(url:='https://noven-ia.netlify.app/.netlify/functions/enviar-push-radar-zonal',headers:=jsonb_build_object('Content-Type','application/json','x-webhook-secret',v_webhook_secret),body:=jsonb_build_object('alerta_zonal_id',p_alerta_id));
END; $function$

CREATE OR REPLACE FUNCTION noven_private.persistir_detalle_0258_v1(p_importacion_id uuid, p_sucursal_id uuid, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_org_id uuid;
  v_aplicada_at timestamptz;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items debe ser un array JSON';
  END IF;

  SELECT i.organizacion_id, COALESCE(i.aplicada_at, now())
    INTO v_org_id, v_aplicada_at
  FROM public.importaciones i
  WHERE i.id = p_importacion_id
    AND i.sucursal_id = p_sucursal_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Importación 0258 inexistente o fuera de la sucursal';
  END IF;

  INSERT INTO public.importacion_0258_detalle (
    importacion_id, organizacion_id, sucursal_id, producto_id,
    cod_art, descripcion, marca, contenido, unidad_medida, bulto, dto_sec_fam,
    costo_unitario, costo_final, precio_sugerido, precio_venta,
    stock_transito, stock, per_ant_3, per_ant_2, per_ant_1, ultimo_periodo,
    venta_media_diaria, fila_origen, captured_at
  )
  SELECT
    p_importacion_id,
    v_org_id,
    p_sucursal_id,
    p.id,
    btrim(x.cod_art),
    NULLIF(btrim(x.descripcion), ''),
    NULLIF(btrim(x.marca), ''),
    NULLIF(btrim(x.contenido), ''),
    NULLIF(btrim(x.unidad_medida), ''),
    x.bulto,
    NULLIF(btrim(x.dto_sec_fam), ''),
    x.costo_unitario,
    x.costo_final,
    x.precio_sugerido,
    x.precio_venta,
    x.stock_transito,
    x.stock,
    x.per_ant_3,
    x.per_ant_2,
    x.per_ant_1,
    x.ultimo_periodo,
    x.venta_media_diaria,
    x.fila_origen,
    v_aplicada_at
  FROM jsonb_to_recordset(p_items) AS x(
    cod_art text,
    descripcion text,
    marca text,
    contenido text,
    unidad_medida text,
    bulto numeric,
    dto_sec_fam text,
    costo_unitario numeric,
    costo_final numeric,
    precio_sugerido numeric,
    precio_venta numeric,
    stock_transito numeric,
    stock numeric,
    per_ant_3 numeric,
    per_ant_2 numeric,
    per_ant_1 numeric,
    ultimo_periodo numeric,
    venta_media_diaria numeric,
    fila_origen integer
  )
  LEFT JOIN public.productos p
    ON p.organizacion_id = v_org_id
   AND p.cod_art = btrim(x.cod_art)
   AND p.activo = true
  ON CONFLICT (importacion_id, cod_art) DO UPDATE SET
    producto_id = EXCLUDED.producto_id,
    descripcion = EXCLUDED.descripcion,
    marca = EXCLUDED.marca,
    contenido = EXCLUDED.contenido,
    unidad_medida = EXCLUDED.unidad_medida,
    bulto = EXCLUDED.bulto,
    dto_sec_fam = EXCLUDED.dto_sec_fam,
    costo_unitario = EXCLUDED.costo_unitario,
    costo_final = EXCLUDED.costo_final,
    precio_sugerido = EXCLUDED.precio_sugerido,
    precio_venta = EXCLUDED.precio_venta,
    stock_transito = EXCLUDED.stock_transito,
    stock = EXCLUDED.stock,
    per_ant_3 = EXCLUDED.per_ant_3,
    per_ant_2 = EXCLUDED.per_ant_2,
    per_ant_1 = EXCLUDED.per_ant_1,
    ultimo_periodo = EXCLUDED.ultimo_periodo,
    venta_media_diaria = EXCLUDED.venta_media_diaria,
    fila_origen = EXCLUDED.fila_origen,
    captured_at = EXCLUDED.captured_at;

  UPDATE public.producto_snapshots ps
  SET stock_transito = d.stock_transito,
      per_ant_3 = d.per_ant_3,
      per_ant_2 = d.per_ant_2,
      per_ant_1 = d.per_ant_1,
      ultimo_periodo = d.ultimo_periodo,
      costo_unitario_observado = d.costo_unitario,
      costo_final_observado = d.costo_final,
      precio_sugerido = d.precio_sugerido,
      precio_venta = d.precio_venta
  FROM public.importacion_0258_detalle d
  WHERE ps.importacion_id = p_importacion_id
    AND d.importacion_id = p_importacion_id
    AND d.producto_id = ps.producto_id;

  UPDATE public.producto_sucursal psu
  SET stock_transito = d.stock_transito,
      per_ant_3 = d.per_ant_3,
      per_ant_2 = d.per_ant_2,
      per_ant_1 = d.per_ant_1,
      ultimo_periodo = d.ultimo_periodo,
      precio_sugerido = d.precio_sugerido,
      precio_venta = d.precio_venta,
      fecha_ultima_importacion_0258 = v_aplicada_at,
      updated_at = now()
  FROM public.importacion_0258_detalle d
  WHERE d.importacion_id = p_importacion_id
    AND d.producto_id = psu.producto_id
    AND psu.sucursal_id = p_sucursal_id
    AND EXISTS (
      SELECT 1
      FROM public.producto_snapshots snap
      WHERE snap.importacion_id = p_importacion_id
        AND snap.producto_id = d.producto_id
    );

  INSERT INTO public.producto_costo_observaciones (
    organizacion_id, producto_id, sucursal_fuente_id, importacion_id,
    costo_unitario, costo_final, observado_at
  )
  SELECT DISTINCT
    v_org_id, d.producto_id, p_sucursal_id, p_importacion_id,
    d.costo_unitario, d.costo_final, v_aplicada_at
  FROM public.importacion_0258_detalle d
  WHERE d.importacion_id = p_importacion_id
    AND d.producto_id IS NOT NULL
    AND (d.costo_unitario IS NOT NULL OR d.costo_final IS NOT NULL)
    AND EXISTS (
      SELECT 1
      FROM public.producto_snapshots snap
      WHERE snap.importacion_id = p_importacion_id
        AND snap.producto_id = d.producto_id
    )
  ON CONFLICT (importacion_id, producto_id) DO UPDATE SET
    costo_unitario = EXCLUDED.costo_unitario,
    costo_final = EXCLUDED.costo_final,
    observado_at = EXCLUDED.observado_at;

  INSERT INTO public.producto_costo_ultima_observacion (
    producto_id, organizacion_id, sucursal_fuente_id, importacion_id,
    costo_unitario, costo_final, observado_at, updated_at
  )
  SELECT
    o.producto_id, o.organizacion_id, o.sucursal_fuente_id, o.importacion_id,
    o.costo_unitario, o.costo_final, o.observado_at, now()
  FROM public.producto_costo_observaciones o
  WHERE o.importacion_id = p_importacion_id
  ON CONFLICT (producto_id) DO UPDATE SET
    organizacion_id = EXCLUDED.organizacion_id,
    sucursal_fuente_id = EXCLUDED.sucursal_fuente_id,
    importacion_id = EXCLUDED.importacion_id,
    costo_unitario = EXCLUDED.costo_unitario,
    costo_final = EXCLUDED.costo_final,
    observado_at = EXCLUDED.observado_at,
    updated_at = now()
  WHERE EXCLUDED.observado_at >= public.producto_costo_ultima_observacion.observado_at;
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.puede_actualizar_imagen_catalogo_storage(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT false;
$function$
