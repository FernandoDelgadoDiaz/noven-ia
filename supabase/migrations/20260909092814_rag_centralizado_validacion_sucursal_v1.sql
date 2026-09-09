-- =============================================================================
-- NOVEN · CIRCUITO RAG CENTRALIZADO · VALIDACION EN SUCURSAL V1
--
-- El browser sólo identifica el vencimiento. La implementación vuelve a
-- calcular la sugerencia vigente y materializa su evidencia desde fuentes del
-- servidor. Solicitar no modifica el RAG vigente ni abre un tramo.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION noven_private.solicitar_cambio_rag_impl(
  p_vencimiento_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid                         uuid := (SELECT auth.uid());
  v_organizacion_id             uuid;
  v_zona_id                     uuid;
  v_sucursal_id                 uuid;
  v_producto_id                 uuid;
  v_porcentaje_vigente          numeric(5,2);
  v_porcentaje_solicitado       numeric(5,2);
  v_cobertura                   numeric;
  v_velocidad_observada         numeric;
  v_velocidad_necesaria         numeric;
  v_dias_comerciales_restantes  integer;
  v_cantidad_comprometida       numeric;
  v_vmd_glaciar                 numeric;
  v_fecha_vencimiento           date;
  v_fin_accion                  date;
  v_producto_codigo             text;
  v_producto_descripcion        text;
  v_sector_nombre               text;
  v_familia_nombre              text;
  v_solicitud_id                uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  -- Serializa doble click y solicitudes simultáneas sobre el mismo vencimiento.
  SELECT p.organizacion_id, s.zona_id, v.sucursal_id, v.producto_id
  INTO v_organizacion_id, v_zona_id, v_sucursal_id, v_producto_id
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  JOIN public.sucursales s
    ON s.id = v.sucursal_id
   AND s.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true
    AND p.activo = true
    AND s.activa = true
  FOR UPDATE OF v;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = v_organizacion_id
     AND ua.sucursal_id = v_sucursal_id
     AND ua.zona_id IS NULL
     AND ua.rol IN ('gerente_sucursal', 'supervisor')
     AND ua.activo = true
    WHERE u.id = v_uid
      AND u.activo = true
  ) THEN
    RAISE EXCEPTION 'Sólo un gerente o supervisor de la sucursal puede validar la sugerencia'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotencia: una solicitud abierta conserva su identidad y su snapshot.
  SELECT s.id
  INTO v_solicitud_id
  FROM public.solicitudes_cambio_rag s
  JOIN LATERAL (
    SELECT e.tipo
    FROM public.solicitud_cambio_rag_eventos e
    WHERE e.solicitud_id = s.id
    ORDER BY e.id DESC
    LIMIT 1
  ) ultimo ON true
  WHERE s.vencimiento_id = p_vencimiento_id
    AND ultimo.tipo <> 'confirmada'
  ORDER BY s.creada_at DESC
  LIMIT 1;

  IF v_solicitud_id IS NOT NULL THEN
    RETURN v_solicitud_id;
  END IF;

  -- El próximo porcentaje se deriva de la escala autorizada. La RPC no acepta
  -- porcentaje, rol, alcance ni métricas provenientes del cliente.
  SELECT
    sg.rag_porcentaje,
    escala.porcentaje,
    sg.velocidad_observada / NULLIF(sg.velocidad_necesaria, 0),
    sg.velocidad_observada,
    sg.velocidad_necesaria,
    sg.dias_comerciales_restantes,
    sg.cantidad_actual_estimacion,
    sg.vmd_glaciar_actual,
    sg.fecha_vencimiento,
    sg.fecha_vencimiento - sg.dias_donacion,
    p.cod_art,
    p.descripcion,
    sg.sector_nombre,
    f.nombre
  INTO
    v_porcentaje_vigente,
    v_porcentaje_solicitado,
    v_cobertura,
    v_velocidad_observada,
    v_velocidad_necesaria,
    v_dias_comerciales_restantes,
    v_cantidad_comprometida,
    v_vmd_glaciar,
    v_fecha_vencimiento,
    v_fin_accion,
    v_producto_codigo,
    v_producto_descripcion,
    v_sector_nombre,
    v_familia_nombre
  FROM public.v_seguimiento_rag_actual sg
  JOIN public.productos p
    ON p.id = sg.producto_id
   AND p.organizacion_id = sg.organizacion_id
  JOIN public.familias f
    ON f.id = p.familia_id
   AND f.organizacion_id = sg.organizacion_id
  JOIN LATERAL (
    SELECT r.porcentaje
    FROM public.rag_escala_descuento r
    WHERE r.organizacion_id = sg.organizacion_id
      AND r.porcentaje > sg.rag_porcentaje
    ORDER BY r.porcentaje ASC
    LIMIT 1
  ) escala ON true
  WHERE sg.vencimiento_id = p_vencimiento_id
    AND sg.organizacion_id = v_organizacion_id
    AND sg.sucursal_id = v_sucursal_id
    AND sg.producto_id = v_producto_id
    AND sg.estado_seguimiento_rag IN ('insuficiente', 'sin_movimiento')
    AND sg.rag_porcentaje IS NOT NULL
    AND sg.velocidad_observada IS NOT NULL
    AND sg.velocidad_necesaria IS NOT NULL
    AND sg.velocidad_necesaria > 0
    AND sg.velocidad_observada < sg.velocidad_necesaria
    AND sg.dias_comerciales_restantes > 0
    AND sg.dias_observados IS NOT NULL
    AND sg.dias_observados * sg.velocidad_necesaria >= 1
    AND sg.dias_desde_ultimo_rag IS NOT NULL
    AND sg.dias_desde_ultimo_rag * sg.velocidad_necesaria >= 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay una sugerencia RAG vigente y validable para este producto'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.solicitudes_cambio_rag (
    organizacion_id,
    zona_id,
    sucursal_id,
    producto_id,
    vencimiento_id,
    solicitada_por,
    porcentaje_rag_vigente,
    porcentaje_solicitado,
    cobertura_al_sugerir,
    escalones_sugeridos,
    velocidad_observada,
    velocidad_necesaria,
    dias_comerciales_restantes,
    cantidad_comprometida,
    vmd_glaciar,
    fecha_vencimiento,
    fin_accion,
    producto_codigo,
    producto_descripcion,
    sector_nombre,
    familia_nombre
  ) VALUES (
    v_organizacion_id,
    v_zona_id,
    v_sucursal_id,
    v_producto_id,
    p_vencimiento_id,
    v_uid,
    v_porcentaje_vigente,
    v_porcentaje_solicitado,
    v_cobertura,
    1,
    v_velocidad_observada,
    v_velocidad_necesaria,
    v_dias_comerciales_restantes,
    v_cantidad_comprometida,
    v_vmd_glaciar,
    v_fecha_vencimiento,
    v_fin_accion,
    v_producto_codigo,
    v_producto_descripcion,
    v_sector_nombre,
    v_familia_nombre
  )
  RETURNING id INTO v_solicitud_id;

  INSERT INTO public.solicitud_cambio_rag_eventos (
    solicitud_id,
    tipo,
    actor_id
  ) VALUES (
    v_solicitud_id,
    'solicitada',
    v_uid
  );

  RETURN v_solicitud_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitar_cambio_rag(
  p_vencimiento_id uuid
)
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.solicitar_cambio_rag_impl(p_vencimiento_id);
$$;

-- El control continúa disponible para registrar stock, fecha y cantidad, pero
-- deja de ser una puerta lateral para abrir o modificar un RAG desde el browser.
CREATE OR REPLACE FUNCTION public.registrar_control_vencimiento_dashboard(
  p_vencimiento_id uuid,
  p_cantidad_comprometida numeric,
  p_fecha_vencimiento date,
  p_stock_actual integer,
  p_porcentaje_rag numeric DEFAULT NULL::numeric,
  p_nota text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_porcentaje_rag IS NOT NULL THEN
    RAISE EXCEPTION 'El RAG se gestiona mediante el circuito centralizado'
      USING ERRCODE = '42501';
  END IF;

  RETURN noven_private.registrar_control_vencimiento_dashboard_impl(
    p_vencimiento_id,
    p_cantidad_comprometida,
    p_fecha_vencimiento,
    p_stock_actual,
    NULL,
    p_nota
  );
END;
$$;

REVOKE ALL ON FUNCTION noven_private.solicitar_cambio_rag_impl(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.solicitar_cambio_rag(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.registrar_control_vencimiento_dashboard(uuid, numeric, date, integer, numeric, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- La instrumentación del flujo anterior deja de ser superficie browser. El
-- snapshot de la nueva solicitud se construye atómicamente en el servidor.
REVOKE ALL ON FUNCTION public.instrumentar_sugerencia_rag(uuid, numeric, smallint, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION noven_private.instrumentar_sugerencia_rag_impl(uuid, numeric, smallint, text)
  FROM PUBLIC, anon, authenticated;

-- El wrapper INVOKER necesita ejecutar la implementación, que vive fuera de
-- los esquemas expuestos. La autorización efectiva se vuelve a resolver dentro
-- del DEFINER contra usuario_accesos y el vencimiento bloqueado.
GRANT EXECUTE ON FUNCTION noven_private.solicitar_cambio_rag_impl(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.solicitar_cambio_rag(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_control_vencimiento_dashboard(uuid, numeric, date, integer, numeric, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.solicitar_cambio_rag(uuid) IS
  'Valida la sugerencia RAG vigente para un vencimiento. Deriva porcentaje y evidencia server-side; no abre intervención.';

COMMIT;
