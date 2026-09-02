CREATE OR REPLACE FUNCTION noven_private.crear_vencimiento_operador_impl(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF; RETURN public.crear_vencimiento_operador_invoker_v1(p_producto_id,p_sucursal_id,p_cantidad,p_fecha_vencimiento,p_lote); END; $function$

CREATE OR REPLACE FUNCTION noven_private.es_administrador_jerarquia_v1(p_actor_id uuid, p_organizacion_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION noven_private.evaluar_escalamiento_rag_observacion_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  BEGIN
    PERFORM noven_private.registrar_escalamiento_rag_si_corresponde_v1(NEW.vencimiento_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Noven RAG: evaluación de escalamiento falló para vencimiento %: %', NEW.vencimiento_id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.freeze_legacy_producto_estado_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_otro_cambio boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Un producto global nuevo no nace con estado de ninguna sucursal.
    NEW.stock_actual := 0;
    NEW.venta_media_diaria := 0;
    RETURN NEW;
  END IF;

  v_otro_cambio :=
    (to_jsonb(NEW) - ARRAY['stock_actual','venta_media_diaria','updated_at'])
      IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['stock_actual','venta_media_diaria','updated_at']);

  -- Cualquier writer legacy que todavía intente espejar la 091 queda inerte.
  NEW.stock_actual := OLD.stock_actual;
  NEW.venta_media_diaria := OLD.venta_media_diaria;

  -- Si la sentencia sólo intentaba tocar el espejo legacy, tampoco debe fingir
  -- una modificación de identidad global mediante updated_at.
  IF NOT v_otro_cambio THEN
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.generar_radar_zonal_v1(p_vencimiento_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_org uuid;
  v_zona uuid;
  v_producto uuid;
  v_familia uuid;
  v_sucursal_origen uuid;
  v_fecha date;
  v_nivel text;
  v_alerta_id uuid;
BEGIN
  SELECT p.organizacion_id, s.zona_id, v.producto_id, p.familia_id, v.sucursal_id, v.fecha_vencimiento
  INTO v_org, v_zona, v_producto, v_familia, v_sucursal_origen, v_fecha
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  JOIN public.sucursales s ON s.id = v.sucursal_id AND s.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id AND v.activo = true;

  IF NOT FOUND OR v_familia IS NULL THEN RETURN NULL; END IF;

  v_nivel := noven_private.nivel_riesgo_vencimiento_zonal_v1(p_vencimiento_id);
  IF v_nivel IS NULL OR v_nivel = 'seguro' THEN RETURN NULL; END IF;

  INSERT INTO public.alertas_zonales(
    organizacion_id, zona_id, producto_id, familia_id, sucursal_origen_id,
    vencimiento_origen_id, fecha_vencimiento, nivel_origen, last_detected_at
  )
  VALUES(
    v_org, v_zona, v_producto, v_familia, v_sucursal_origen,
    p_vencimiento_id, v_fecha, v_nivel, now()
  )
  ON CONFLICT(zona_id, producto_id, fecha_vencimiento) DO UPDATE
  SET last_detected_at = now(),
      nivel_origen = CASE
        WHEN public.alertas_zonales.nivel_origen = 'decomiso' THEN 'decomiso'
        WHEN EXCLUDED.nivel_origen = 'decomiso' THEN 'decomiso'
        WHEN public.alertas_zonales.nivel_origen = 'donacion' THEN 'donacion'
        WHEN EXCLUDED.nivel_origen = 'donacion' THEN 'donacion'
        WHEN public.alertas_zonales.nivel_origen = 'urgente' THEN 'urgente'
        WHEN EXCLUDED.nivel_origen = 'urgente' THEN 'urgente'
        ELSE 'radar'
      END
  RETURNING id INTO v_alerta_id;

  INSERT INTO public.alertas_zonales_destinos(
    alerta_id, organizacion_id, zona_id, sucursal_id, usuario_id,
    stock_snapshot, stock_actualizado_at, estado, respuesta_at, vencimiento_destino_id
  )
  SELECT
    v_alerta_id,
    v_org,
    v_zona,
    sd.id,
    ufs.usuario_id,
    ps.stock_actual,
    ps.fecha_ultima_importacion,
    CASE
      WHEN vc.id IS NOT NULL THEN 'ya_controlado'
      WHEN ufs.usuario_id IS NULL OR ua.id IS NULL THEN 'sin_responsable'
      ELSE 'pendiente'
    END,
    CASE WHEN vc.id IS NOT NULL THEN now() ELSE NULL END,
    vc.id
  FROM public.sucursales sd
  JOIN public.producto_sucursal ps
    ON ps.sucursal_id = sd.id
   AND ps.organizacion_id = v_org
   AND ps.producto_id = v_producto
   AND ps.stock_actual > 0
  LEFT JOIN LATERAL (
    SELECT vx.id
    FROM public.vencimientos vx
    WHERE vx.sucursal_id = sd.id
      AND vx.producto_id = v_producto
      AND vx.activo = true
    ORDER BY vx.created_at DESC NULLS LAST, vx.id
    LIMIT 1
  ) vc ON true
  LEFT JOIN public.usuario_familias_sucursal ufs
    ON ufs.sucursal_id = sd.id
   AND ufs.organizacion_id = v_org
   AND ufs.familia_id = v_familia
   AND ufs.activo = true
  LEFT JOIN public.usuario_accesos ua
    ON ua.usuario_id = ufs.usuario_id
   AND ua.organizacion_id = v_org
   AND ua.sucursal_id = sd.id
   AND ua.rol = 'operador'
   AND ua.activo = true
  WHERE sd.organizacion_id = v_org
    AND sd.zona_id = v_zona
    AND sd.activa = true
    AND sd.id <> v_sucursal_origen
  ON CONFLICT(alerta_id, sucursal_id) DO UPDATE
  SET stock_snapshot = EXCLUDED.stock_snapshot,
      stock_actualizado_at = EXCLUDED.stock_actualizado_at,
      usuario_id = COALESCE(EXCLUDED.usuario_id, public.alertas_zonales_destinos.usuario_id),
      estado = CASE
        WHEN public.alertas_zonales_destinos.estado IN (
          'misma_fecha', 'otra_fecha', 'no_lo_tengo', 'ya_controlado', 'cerrada'
        ) THEN public.alertas_zonales_destinos.estado
        WHEN EXCLUDED.vencimiento_destino_id IS NOT NULL THEN 'ya_controlado'
        WHEN EXCLUDED.usuario_id IS NOT NULL THEN 'pendiente'
        ELSE 'sin_responsable'
      END,
      respuesta_at = CASE
        WHEN EXCLUDED.vencimiento_destino_id IS NOT NULL THEN now()
        ELSE public.alertas_zonales_destinos.respuesta_at
      END,
      vencimiento_destino_id = COALESCE(
        EXCLUDED.vencimiento_destino_id,
        public.alertas_zonales_destinos.vencimiento_destino_id
      );

  PERFORM noven_private.notificar_radar_zonal_async_v1(v_alerta_id);
  RETURN v_alerta_id;
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl(p_sucursal_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'destino_id', d.id,
        'alerta_id', a.id,
        'estado', d.estado,
        'producto_id', a.producto_id,
        'cod_art', p.cod_art,
        'codigo_barras', p.codigo_barras,
        'descripcion', p.descripcion,
        'marca', p.marca,
        'gramaje', p.gramaje,
        'imagen_thumb_url', p.imagen_thumb_url,
        'familia_id', a.familia_id,
        'fecha_vencimiento', a.fecha_vencimiento,
        'nivel_origen', a.nivel_origen,
        'sucursal_origen_id', a.sucursal_origen_id,
        'sucursal_origen_codigo', so.codigo,
        'sucursal_origen_nombre', so.nombre,
        'sucursal_destino_id', d.sucursal_id,
        'sucursal_destino_codigo', sd.codigo,
        'stock_snapshot', d.stock_snapshot,
        'stock_actual', COALESCE(ps.stock_actual, d.stock_snapshot),
        'stock_actualizado_at', COALESCE(ps.fecha_ultima_importacion, d.stock_actualizado_at),
        'created_at', d.created_at
      ) AS item,
      d.created_at
    FROM public.alertas_zonales_destinos d
    JOIN public.alertas_zonales a ON a.id = d.alerta_id
    JOIN public.productos p ON p.id = a.producto_id
    JOIN public.sucursales so ON so.id = a.sucursal_origen_id
    JOIN public.sucursales sd ON sd.id = d.sucursal_id
    LEFT JOIN public.producto_sucursal ps
      ON ps.producto_id = a.producto_id
     AND ps.sucursal_id = d.sucursal_id
     AND ps.organizacion_id = d.organizacion_id
    WHERE d.usuario_id = v_uid
      AND d.estado IN ('pendiente','revisar_despues')
      AND (p_sucursal_id IS NULL OR d.sucursal_id = p_sucursal_id)
      AND EXISTS (
        SELECT 1
        FROM public.usuarios u
        JOIN public.usuario_accesos ua
          ON ua.usuario_id = u.id
         AND ua.organizacion_id = d.organizacion_id
         AND ua.sucursal_id = d.sucursal_id
         AND ua.rol = 'operador'
         AND ua.activo = true
        JOIN public.usuario_familias_sucursal ufs
          ON ufs.usuario_id = u.id
         AND ufs.organizacion_id = d.organizacion_id
         AND ufs.sucursal_id = d.sucursal_id
         AND ufs.familia_id = a.familia_id
         AND ufs.activo = true
        WHERE u.id = v_uid
          AND u.activo = true
      )
  ) q;

  RETURN v_result;
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.listar_resumen_radar_zonal_v1_impl(p_zona_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
