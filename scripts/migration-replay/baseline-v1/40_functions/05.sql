CREATE OR REPLACE FUNCTION noven_private.registrar_control_vencimiento_dashboard_impl(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_fecha_vencimiento date, p_stock_actual integer, p_porcentaje_rag numeric DEFAULT NULL::numeric, p_nota text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF; RETURN public.registrar_control_vencimiento_dashboard_invoker_v1(p_vencimiento_id,p_cantidad_comprometida,p_fecha_vencimiento,p_stock_actual,p_porcentaje_rag,p_nota); END; $function$

CREATE OR REPLACE FUNCTION noven_private.registrar_control_vencimiento_impl(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_nota text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF; RETURN public.registrar_control_vencimiento_invoker_v1(p_vencimiento_id,p_cantidad_comprometida,p_nota); END; $function$

CREATE OR REPLACE FUNCTION noven_private.registrar_escalamiento_rag_si_corresponde_v1(p_vencimiento_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_seg record;
  v_costo numeric;
  v_unidades_expuestas numeric;
  v_dinero_en_riesgo numeric;
  v_escalamiento_id uuid;
BEGIN
  SELECT s.vencimiento_id,s.organizacion_id,s.sucursal_id,s.producto_id,s.rag_id,s.rag_porcentaje,s.observacion_id,
         s.cantidad_actual_estimacion,s.vmd_glaciar_actual,s.dias_comerciales_restantes,s.velocidad_observada,
         s.velocidad_necesaria,s.estado_seguimiento_rag
  INTO v_seg
  FROM public.v_seguimiento_rag_actual s
  WHERE s.vencimiento_id = p_vencimiento_id
    AND s.rag_id IS NOT NULL
    AND s.observacion_id IS NOT NULL
    AND s.estado_seguimiento_rag IN ('insuficiente','sin_movimiento')
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT c.costo_unitario INTO v_costo
  FROM public.producto_costo_ultima_observacion c
  WHERE c.producto_id = v_seg.producto_id;

  v_unidades_expuestas := GREATEST(
    COALESCE(v_seg.cantidad_actual_estimacion,0::numeric)
    - GREATEST(COALESCE(v_seg.vmd_glaciar_actual,0::numeric),0::numeric)
      * GREATEST(COALESCE(v_seg.dias_comerciales_restantes,0),0)::numeric,
    0::numeric
  );
  IF v_costo IS NOT NULL THEN v_dinero_en_riesgo := v_unidades_expuestas * v_costo; END IF;

  INSERT INTO public.rag_escalamientos(
    organizacion_id,sucursal_id,producto_id,vencimiento_id,rag_id,observacion_id,estado_seguimiento,
    rag_porcentaje,cantidad_actual,unidades_expuestas,velocidad_observada,velocidad_necesaria,
    costo_unitario_sin_iva,dinero_en_riesgo_sin_iva
  ) VALUES (
    v_seg.organizacion_id,v_seg.sucursal_id,v_seg.producto_id,v_seg.vencimiento_id,v_seg.rag_id,v_seg.observacion_id,
    v_seg.estado_seguimiento_rag,v_seg.rag_porcentaje,COALESCE(v_seg.cantidad_actual_estimacion,0::numeric),
    v_unidades_expuestas,v_seg.velocidad_observada,v_seg.velocidad_necesaria,v_costo,v_dinero_en_riesgo
  )
  ON CONFLICT (rag_id, observacion_id) DO NOTHING
  RETURNING id INTO v_escalamiento_id;

  IF v_escalamiento_id IS NOT NULL THEN
    PERFORM noven_private.notificar_escalamiento_rag_async_v1(v_escalamiento_id);
  END IF;
  RETURN v_escalamiento_id;
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.registrar_intervencion_rag_impl(p_vencimiento_id uuid, p_porcentaje_descuento numeric, p_nota text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000'; END IF; RETURN public.registrar_intervencion_rag_invoker_v1(p_vencimiento_id,p_porcentaje_descuento,p_nota); END; $function$

CREATE OR REPLACE FUNCTION noven_private.responder_alerta_zonal_v1_impl(p_destino_id uuid, p_respuesta text, p_cantidad integer DEFAULT NULL::integer, p_fecha_otra date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_dest public.alertas_zonales_destinos%ROWTYPE;
  v_alerta public.alertas_zonales%ROWTYPE;
  v_vencimiento_existente uuid;
  v_vencimiento_nuevo uuid;
  v_fecha date;
  v_estado text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_respuesta NOT IN ('misma_fecha','otra_fecha','no_lo_tengo','revisar_despues') THEN
    RAISE EXCEPTION 'Respuesta de Radar Zonal inválida' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_dest
  FROM public.alertas_zonales_destinos
  WHERE id = p_destino_id
  FOR UPDATE;

  IF v_dest.id IS NULL THEN
    RAISE EXCEPTION 'Alerta zonal inexistente' USING ERRCODE = 'P0002';
  END IF;

  IF v_dest.usuario_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'La alerta no está asignada a este operador' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_alerta
  FROM public.alertas_zonales
  WHERE id = v_dest.alerta_id;

  IF v_alerta.id IS NULL THEN
    RAISE EXCEPTION 'Alerta zonal inexistente' USING ERRCODE = 'P0002';
  END IF;

  -- La asignación histórica no alcanza: el operador debe conservar HOY su
  -- cuenta, acceso local y familia responsable. Este gate ocurre antes de
  -- cualquier retorno o UPDATE, incluso para no_lo_tengo/revisar_despues.
  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = v_dest.organizacion_id
     AND ua.sucursal_id = v_dest.sucursal_id
     AND ua.rol = 'operador'
     AND ua.activo = true
    JOIN public.usuario_familias_sucursal ufs
      ON ufs.usuario_id = u.id
     AND ufs.organizacion_id = v_dest.organizacion_id
     AND ufs.sucursal_id = v_dest.sucursal_id
     AND ufs.familia_id = v_alerta.familia_id
     AND ufs.activo = true
    WHERE u.id = v_uid
      AND u.activo = true
  ) THEN
    RAISE EXCEPTION 'Ya no tenés responsabilidad activa sobre esta familia en la sucursal'
      USING ERRCODE = '42501';
  END IF;

  IF v_dest.estado NOT IN ('pendiente','revisar_despues') THEN
    RETURN jsonb_build_object('estado', v_dest.estado, 'ya_resuelta', true);
  END IF;

  IF p_respuesta = 'revisar_despues' THEN
    UPDATE public.alertas_zonales_destinos
    SET estado = 'revisar_despues', updated_at = now()
    WHERE id = p_destino_id;
    RETURN jsonb_build_object('estado', 'revisar_despues');
  END IF;

  IF p_respuesta = 'no_lo_tengo' THEN
    UPDATE public.alertas_zonales_destinos
    SET estado = 'no_lo_tengo', respuesta_at = now(), updated_at = now()
    WHERE id = p_destino_id;
    RETURN jsonb_build_object('estado', 'no_lo_tengo');
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad comprometida debe ser mayor a cero' USING ERRCODE = '22023';
  END IF;

  IF p_respuesta = 'otra_fecha' AND p_fecha_otra IS NULL THEN
    RAISE EXCEPTION 'La nueva fecha de vencimiento es obligatoria' USING ERRCODE = '22023';
  END IF;

  v_fecha := CASE
    WHEN p_respuesta = 'misma_fecha' THEN v_alerta.fecha_vencimiento
    ELSE p_fecha_otra
  END;

  SELECT v.id INTO v_vencimiento_existente
  FROM public.vencimientos v
  WHERE v.producto_id = v_alerta.producto_id
    AND v.sucursal_id = v_dest.sucursal_id
    AND v.activo = true
  ORDER BY v.created_at DESC NULLS LAST, v.id
  LIMIT 1;

  IF v_vencimiento_existente IS NOT NULL THEN
    UPDATE public.alertas_zonales_destinos
    SET estado = 'ya_controlado',
        respuesta_at = now(),
        vencimiento_destino_id = v_vencimiento_existente,
        updated_at = now()
    WHERE id = p_destino_id;

    RETURN jsonb_build_object(
      'estado', 'ya_controlado',
      'vencimiento_id', v_vencimiento_existente,
      'ya_resuelta', true
    );
  END IF;

  SELECT noven_private.crear_vencimiento_operador_impl(
    v_alerta.producto_id,
    v_dest.sucursal_id,
    p_cantidad,
    v_fecha,
    NULL
  ) INTO v_vencimiento_nuevo;

  v_estado := CASE
    WHEN v_fecha = v_alerta.fecha_vencimiento THEN 'misma_fecha'
    ELSE 'otra_fecha'
  END;

  UPDATE public.alertas_zonales_destinos
  SET estado = v_estado,
      respuesta_at = now(),
      cantidad_confirmada = p_cantidad,
      fecha_confirmada = v_fecha,
      vencimiento_destino_id = v_vencimiento_nuevo,
      updated_at = now()
  WHERE id = p_destino_id;

  RETURN jsonb_build_object(
    'estado', v_estado,
    'vencimiento_id', v_vencimiento_nuevo,
    'fecha_vencimiento', v_fecha,
    'cantidad', p_cantidad
  );
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.responder_escalamiento_por_cierre_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.tipo IN ('vendido','donacion','decomiso') THEN
    PERFORM noven_private.marcar_escalamientos_respondidos_v1(NEW.vencimiento_id,NEW.created_at,NEW.usuario_id,'cierre_terminal','accion:' || NEW.id::text);
  END IF;
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION noven_private.responder_escalamiento_por_observacion_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM noven_private.marcar_escalamientos_respondidos_v1(NEW.vencimiento_id,NEW.observada_at,NEW.usuario_id,'control','observacion:' || NEW.id::text);
  RETURN NEW;
END;
$function$
