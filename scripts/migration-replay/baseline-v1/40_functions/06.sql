CREATE OR REPLACE FUNCTION noven_private.responder_escalamiento_por_rag_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM noven_private.marcar_escalamientos_respondidos_v1(NEW.vencimiento_id,COALESCE(NEW.aplicado_at,NEW.created_at,now()),NEW.usuario_id,'nueva_intervencion','rag:' || NEW.id::text);
  ELSIF TG_OP = 'UPDATE' AND OLD.finalizado_at IS NULL AND NEW.finalizado_at IS NOT NULL THEN
    PERFORM noven_private.marcar_escalamientos_respondidos_v1(NEW.vencimiento_id,NEW.finalizado_at,COALESCE(NEW.finalizado_por,NEW.usuario_id),'finalizacion_rag','rag:' || NEW.id::text);
  END IF;
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.scanner_org(p_sucursal_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$ DECLARE v_uid uuid := (SELECT auth.uid()); v_org uuid; BEGIN IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF; IF NOT noven_private.tiene_acceso_sucursal(p_sucursal_id) THEN RAISE EXCEPTION 'Sin acceso a la sucursal' USING ERRCODE='42501'; END IF; SELECT organizacion_id INTO v_org FROM public.sucursales WHERE id=p_sucursal_id AND activa=true; IF v_org IS NULL THEN RAISE EXCEPTION 'Sucursal activa no encontrada' USING ERRCODE='P0002'; END IF; RETURN v_org; END; $function$

CREATE OR REPLACE FUNCTION noven_private.scanner_producto_json(p_producto_id uuid, p_sucursal_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'id', p.id,
    'cod_art', p.cod_art,
    'codigo_barras', COALESCE((
      SELECT pc.codigo
      FROM public.producto_codigos pc
      WHERE pc.producto_id = p.id
        AND pc.organizacion_id = p.organizacion_id
        AND pc.activo = true
      ORDER BY pc.es_principal DESC, pc.created_at ASC
      LIMIT 1
    ), p.codigo_barras),
    'descripcion', p.descripcion,
    'marca', p.marca,
    'gramaje', p.gramaje,
    'categoria', p.categoria,
    'proveedor', p.proveedor,
    'sector', COALESCE(sec.nombre, p.sector),
    'dias_donacion', sec.dias_donacion,
    'venta_media_diaria', COALESCE(ps.venta_media_diaria, 0),
    'stock_actual', COALESCE(ps.stock_actual, 0),
    'precio_costo', p.precio_costo,
    'imagen_url', p.imagen_url,
    'imagen_thumb_url', p.imagen_thumb_url,
    'familia_id', p.familia_id,
    'activo', p.activo,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'organizacion_id', p.organizacion_id
  )
  FROM public.productos p
  LEFT JOIN public.producto_sucursal ps
    ON ps.producto_id = p.id
   AND ps.sucursal_id = p_sucursal_id
   AND ps.organizacion_id = p.organizacion_id
  LEFT JOIN public.familias f
    ON f.id = p.familia_id
   AND f.organizacion_id = p.organizacion_id
  LEFT JOIN public.sectores sec
    ON sec.id = f.sector_id
   AND sec.organizacion_id = p.organizacion_id
  WHERE p.id = p_producto_id;
$function$

CREATE OR REPLACE FUNCTION noven_private.sincronizar_problema_economico_v1(p_vencimiento_id uuid, p_evento_at timestamp with time zone DEFAULT now(), p_fuente text DEFAULT 'evento'::text, p_apertura_metodo text DEFAULT 'evento'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid(); v_org uuid; v_sucursal uuid; v_producto uuid; v_activo boolean; v_cantidad numeric; v_fecha_vencimiento date; v_vmd numeric; v_dias_donacion integer; v_costo numeric;
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', p_evento_at))::date; v_dias integer; v_dias_comerciales integer; v_dias_stock numeric; v_nivel text; v_expuestas numeric := 0; v_dinero numeric;
  v_terminal record; v_anulacion record; v_resolucion text; v_resuelto_at timestamptz; v_resuelto_por uuid;
BEGIN
  IF p_apertura_metodo NOT IN ('evento', 'backfill_actual') THEN RAISE EXCEPTION 'Método de apertura inválido: %', p_apertura_metodo USING ERRCODE = '22023'; END IF;
  SELECT p.organizacion_id,v.sucursal_id,v.producto_id,v.activo,v.cantidad::numeric,v.fecha_vencimiento,COALESCE(ps.venta_media_diaria,0)::numeric,s.dias_donacion,c.costo_unitario::numeric
  INTO v_org,v_sucursal,v_producto,v_activo,v_cantidad,v_fecha_vencimiento,v_vmd,v_dias_donacion,v_costo
  FROM public.vencimientos v JOIN public.productos p ON p.id=v.producto_id
  LEFT JOIN public.producto_sucursal ps ON ps.producto_id=v.producto_id AND ps.sucursal_id=v.sucursal_id AND ps.organizacion_id=p.organizacion_id
  LEFT JOIN public.familias f ON f.id=p.familia_id AND f.organizacion_id=p.organizacion_id
  LEFT JOIN public.sectores s ON s.id=f.sector_id AND s.organizacion_id=p.organizacion_id
  LEFT JOIN public.producto_costo_ultima_observacion c ON c.producto_id=v.producto_id WHERE v.id=p_vencimiento_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT v_activo THEN
    SELECT a.tipo,COALESCE(a.fecha,a.created_at) evento_at,a.usuario_id INTO v_terminal FROM public.acciones_operativas a WHERE a.vencimiento_id=p_vencimiento_id AND a.tipo IN ('vendido','donacion','decomiso') ORDER BY COALESCE(a.fecha,a.created_at) DESC,a.created_at DESC LIMIT 1;
    IF FOUND THEN v_resolucion:=v_terminal.tipo; v_resuelto_at:=COALESCE(v_terminal.evento_at,p_evento_at); v_resuelto_por:=v_terminal.usuario_id;
    ELSE
      SELECT o.observada_at evento_at,o.usuario_id INTO v_anulacion FROM public.vencimiento_observaciones o WHERE o.vencimiento_id=p_vencimiento_id AND o.nota ILIKE 'ANULACIÓN DE CARGA:%' ORDER BY o.observada_at DESC,o.id DESC LIMIT 1;
      IF FOUND THEN v_resolucion:='anulado'; v_resuelto_at:=COALESCE(v_anulacion.evento_at,p_evento_at); v_resuelto_por:=v_anulacion.usuario_id;
      ELSE v_resolucion:='inactivo_sin_resultado'; v_resuelto_at:=p_evento_at; v_resuelto_por:=v_actor; END IF;
    END IF;
    UPDATE public.problemas_economicos_ciclos SET resuelto_at=v_resuelto_at,resuelto_por=v_resuelto_por,resolucion=v_resolucion,resolucion_fuente=p_fuente,ultimo_estado_at=p_evento_at,ultimo_actor=v_actor,ultima_fuente=p_fuente,updated_at=now() WHERE vencimiento_id=p_vencimiento_id AND resuelto_at IS NULL;
    RETURN;
  END IF;
  IF v_dias_donacion IS NULL THEN
    UPDATE public.problemas_economicos_ciclos SET resuelto_at=p_evento_at,resuelto_por=v_actor,resolucion='fuera_circuito',resolucion_fuente=p_fuente,ultimo_estado_at=p_evento_at,ultimo_actor=v_actor,ultima_fuente=p_fuente,updated_at=now() WHERE vencimiento_id=p_vencimiento_id AND resuelto_at IS NULL; RETURN;
  END IF;
  v_dias:=v_fecha_vencimiento-v_hoy; v_dias_comerciales:=GREATEST(v_dias-v_dias_donacion,0); v_dias_stock:=CASE WHEN v_vmd<=0 THEN 'Infinity'::numeric ELSE v_cantidad/v_vmd END;
  IF v_dias<=0 THEN v_nivel:='decomiso'; v_expuestas:=GREATEST(v_cantidad,0);
  ELSIF v_dias<=v_dias_donacion THEN v_nivel:='donacion'; v_expuestas:=GREATEST(v_cantidad,0);
  ELSIF v_dias<=20 AND v_dias_stock>v_dias_comerciales THEN v_nivel:='urgente'; v_expuestas:=GREATEST(v_cantidad-GREATEST(v_vmd,0)*v_dias_comerciales,0);
  ELSIF v_dias<=45 AND v_dias_stock>v_dias_comerciales THEN v_nivel:='radar'; v_expuestas:=GREATEST(v_cantidad-GREATEST(v_vmd,0)*v_dias_comerciales,0);
  ELSE v_nivel:='seguro'; v_expuestas:=0; END IF;
  v_dinero:=CASE WHEN v_costo IS NULL THEN NULL ELSE v_expuestas*v_costo END;
  IF v_nivel='seguro' THEN
    UPDATE public.problemas_economicos_ciclos SET resuelto_at=p_evento_at,resuelto_por=v_actor,resolucion='vuelto_seguro',resolucion_fuente=p_fuente,ultimo_estado_at=p_evento_at,ultimo_actor=v_actor,ultima_fuente=p_fuente,nivel_actual='seguro',cantidad_actual=GREATEST(v_cantidad,0),unidades_expuestas_actual=0,costo_unitario_sin_iva_actual=v_costo,dinero_en_riesgo_actual=0,updated_at=now() WHERE vencimiento_id=p_vencimiento_id AND resuelto_at IS NULL; RETURN;
  END IF;
  INSERT INTO public.problemas_economicos_ciclos(organizacion_id,sucursal_id,vencimiento_id,producto_id,abierto_at,abierto_por,apertura_fuente,apertura_metodo,nivel_apertura,cantidad_apertura,unidades_expuestas_apertura,costo_unitario_sin_iva_apertura,dinero_en_riesgo_apertura,ultimo_estado_at,ultimo_actor,ultima_fuente,nivel_actual,cantidad_actual,unidades_expuestas_actual,costo_unitario_sin_iva_actual,dinero_en_riesgo_actual)
  VALUES(v_org,v_sucursal,p_vencimiento_id,v_producto,p_evento_at,v_actor,p_fuente,p_apertura_metodo,v_nivel,GREATEST(v_cantidad,0),v_expuestas,v_costo,v_dinero,p_evento_at,v_actor,p_fuente,v_nivel,GREATEST(v_cantidad,0),v_expuestas,v_costo,v_dinero)
  ON CONFLICT (vencimiento_id) WHERE resuelto_at IS NULL DO UPDATE SET producto_id=EXCLUDED.producto_id,ultimo_estado_at=EXCLUDED.ultimo_estado_at,ultimo_actor=EXCLUDED.ultimo_actor,ultima_fuente=EXCLUDED.ultima_fuente,nivel_actual=EXCLUDED.nivel_actual,cantidad_actual=EXCLUDED.cantidad_actual,unidades_expuestas_actual=EXCLUDED.unidades_expuestas_actual,costo_unitario_sin_iva_actual=EXCLUDED.costo_unitario_sin_iva_actual,dinero_en_riesgo_actual=EXCLUDED.dinero_en_riesgo_actual,updated_at=now();
END; $function$

CREATE OR REPLACE FUNCTION noven_private.tiene_acceso_organizacion(p_organizacion_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = p_organizacion_id
     AND ua.activo = true
    WHERE u.id = (SELECT auth.uid())
      AND u.activo = true
  );
$function$

CREATE OR REPLACE FUNCTION noven_private.tiene_acceso_sucursal(p_sucursal_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.sucursales s ON s.id = p_sucursal_id
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = s.organizacion_id
     AND ua.activo = true
    WHERE u.id = (SELECT auth.uid())
      AND u.activo = true
      AND (
        (ua.rol = 'gerente_zonal' AND ua.zona_id = s.zona_id)
        OR (
          ua.rol IN ('gerente_sucursal', 'supervisor', 'operador')
          AND ua.sucursal_id = s.id
        )
      )
  );
$function$

CREATE OR REPLACE FUNCTION noven_private.tiene_acceso_zona(p_zona_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.zonas z ON z.id = p_zona_id
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = z.organizacion_id
     AND ua.activo = true
    WHERE u.id = (SELECT auth.uid())
      AND u.activo = true
      AND (
        (ua.rol = 'gerente_zonal' AND ua.zona_id = z.id)
        OR (
          ua.rol IN ('gerente_sucursal', 'supervisor', 'operador')
          AND EXISTS (
            SELECT 1
            FROM public.sucursales s
            WHERE s.id = ua.sucursal_id
              AND s.zona_id = z.id
              AND s.activa = true
          )
        )
      )
  );
$function$
