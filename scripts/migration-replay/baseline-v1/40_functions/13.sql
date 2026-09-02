CREATE OR REPLACE FUNCTION public.listar_mis_alertas_zonales_v1(p_sucursal_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT noven_private.listar_mis_alertas_zonales_v1_impl(p_sucursal_id); $function$

CREATE OR REPLACE FUNCTION public.listar_productos_pendientes_catalogo(p_usuario_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$ SELECT COALESCE(jsonb_agg(item ORDER BY last_detected_at DESC),'[]'::jsonb) FROM (SELECT jsonb_build_object('id',pp.id,'organizacion_id',pp.organizacion_id,'cod_art',pp.cod_art,'descripcion',pp.descripcion,'marca',pp.marca,'gramaje',pp.gramaje,'producto_id',pp.producto_id,'first_detected_at',pp.first_detected_at,'last_detected_at',pp.last_detected_at,'detecciones',count(DISTINCT d.importacion_id),'sucursales',COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id',s.id,'codigo',s.codigo,'nombre',s.nombre)),'[]'::jsonb)) item,pp.last_detected_at FROM public.productos_pendientes_catalogo pp JOIN public.producto_pendiente_detecciones d ON d.pendiente_id=pp.id JOIN public.sucursales s ON s.id=d.sucursal_id WHERE pp.estado='pendiente' AND EXISTS(SELECT 1 FROM public.usuario_accesos ua WHERE ua.usuario_id=p_usuario_id AND ua.organizacion_id=pp.organizacion_id AND ua.activo=true AND ua.rol<>'operador' AND (ua.rol='admin_organizacion' OR (ua.rol='gerente_zonal' AND ua.zona_id=s.zona_id) OR (ua.rol IN('gerente_sucursal','supervisor') AND ua.sucursal_id=s.id))) GROUP BY pp.id,pp.organizacion_id,pp.cod_art,pp.descripcion,pp.marca,pp.gramaje,pp.producto_id,pp.first_detected_at,pp.last_detected_at) q; $function$

CREATE OR REPLACE FUNCTION public.listar_productos_pendientes_catalogo_v2(p_usuario_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(item ORDER BY last_detected_at DESC),'[]'::jsonb)
  FROM (
    SELECT
      jsonb_build_object(
        'id',pp.id,
        'organizacion_id',pp.organizacion_id,
        'cod_art',pp.cod_art,
        'descripcion',pp.descripcion,
        'marca',pp.marca,
        'gramaje',pp.gramaje,
        'producto_id',pp.producto_id,
        'first_detected_at',pp.first_detected_at,
        'last_detected_at',pp.last_detected_at,
        'detecciones',count(DISTINCT d.importacion_id),
        'sucursales',COALESCE(
          jsonb_agg(DISTINCT jsonb_build_object('id',s.id,'codigo',s.codigo,'nombre',s.nombre)),
          '[]'::jsonb
        )
      ) AS item,
      pp.last_detected_at
    FROM public.productos_pendientes_catalogo pp
    JOIN public.producto_pendiente_detecciones d ON d.pendiente_id=pp.id
    JOIN public.sucursales s ON s.id=d.sucursal_id AND s.activa=true
    JOIN public.usuarios u ON u.id=p_usuario_id AND u.activo=true
    WHERE pp.estado='pendiente'
      AND EXISTS (
        SELECT 1
        FROM public.usuario_accesos ua
        WHERE ua.usuario_id=p_usuario_id
          AND ua.organizacion_id=pp.organizacion_id
          AND ua.activo=true
          AND (
            (ua.rol='gerente_zonal' AND ua.zona_id=s.zona_id)
            OR (
              ua.rol IN ('gerente_sucursal','supervisor')
              AND ua.sucursal_id=s.id
            )
          )
      )
    GROUP BY pp.id,pp.organizacion_id,pp.cod_art,pp.descripcion,pp.marca,
             pp.gramaje,pp.producto_id,pp.first_detected_at,pp.last_detected_at
  ) q;
$function$

CREATE OR REPLACE FUNCTION public.listar_resumen_radar_zonal_v1(p_zona_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT noven_private.listar_resumen_radar_zonal_v1_impl(p_zona_id); $function$

CREATE OR REPLACE FUNCTION public.modo_imagen_producto_operador(p_sucursal_id uuid, p_producto_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$
DECLARE v_imagen text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF;
  IF NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id,p_producto_id) THEN RETURN 'solo_lectura'; END IF;
  SELECT p.imagen_url INTO v_imagen FROM public.productos p WHERE p.id=p_producto_id;
  IF NOT FOUND THEN RETURN 'solo_lectura'; END IF;
  IF NULLIF(btrim(COALESCE(v_imagen,'')),'') IS NULL THEN RETURN 'agregar'; END IF;
  IF noven_private.puede_reemplazar_imagen_producto(p_sucursal_id,p_producto_id) THEN RETURN 'reemplazar'; END IF;
  RETURN 'solo_lectura';
END;
$function$

CREATE OR REPLACE FUNCTION public.notify_push_urgente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_nombre text;
  v_familia uuid;
  v_dias integer;
  v_webhook_secret text;
  v_fecha_operacional date;
BEGIN
  IF NEW.nivel_actual = 'urgente'
     AND NEW.nivel_actual IS DISTINCT FROM OLD.nivel_actual THEN

    SELECT p.descripcion, p.familia_id
      INTO v_nombre, v_familia
    FROM public.productos p
    WHERE p.id = NEW.producto_id;

    v_fecha_operacional := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    v_dias := NEW.fecha_vencimiento - v_fecha_operacional;

    SELECT ds.decrypted_secret
      INTO v_webhook_secret
    FROM vault.decrypted_secrets ds
    WHERE ds.name = 'noven_push_webhook_secret'
    LIMIT 1;

    IF v_webhook_secret IS NULL OR v_webhook_secret = '' THEN
      RAISE WARNING 'NoVen push secret no disponible; push omitido para vencimiento %', NEW.id;
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := 'https://noven-ia.netlify.app/.netlify/functions/enviar-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'vencimiento_id', NEW.id,
        'sucursal_id', NEW.sucursal_id,
        'producto_nombre', v_nombre,
        'dias_restantes', v_dias,
        'familia_id', v_familia
      )
    );
  END IF;

  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.obtener_invitacion_gestion_v1(p_actor_id uuid, p_invitacion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'noven_private'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT noven_private.puede_gestionar_invitacion_v1(p_actor_id,p_invitacion_id) THEN
    RAISE EXCEPTION 'Sin permiso para gestionar esta invitación' USING ERRCODE='42501';
  END IF;

  SELECT jsonb_build_object(
    'id',ia.id,
    'usuario_id',ia.usuario_id,
    'organizacion_id',ia.organizacion_id,
    'email',ia.email,
    'nombre',ia.nombre,
    'rol',ia.rol,
    'zona_id',ia.zona_id,
    'sucursal_id',ia.sucursal_id,
    'familias_ids',to_jsonb(ia.familias_ids),
    'canal',ia.canal,
    'estado',ia.estado,
    'created_at',ia.created_at,
    'expires_at',ia.expires_at
  ) INTO v_result
  FROM public.invitaciones_acceso ia
  WHERE ia.id=p_invitacion_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Invitación inexistente' USING ERRCODE='P0002';
  END IF;

  RETURN v_result;
END;
$function$
