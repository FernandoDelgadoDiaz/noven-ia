-- Permite finalizar una intervención RAG sin cerrar el vencimiento.
-- La intervención conserva su historia y deja de considerarse vigente.

ALTER TABLE public.intervenciones_rag
  ADD COLUMN IF NOT EXISTS finalizado_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalizado_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_finalizacion text,
  ADD COLUMN IF NOT EXISTS nota_finalizacion text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.intervenciones_rag'::regclass
      AND conname = 'intervenciones_rag_finalizado_por_fkey'
  ) THEN
    ALTER TABLE public.intervenciones_rag
      ADD CONSTRAINT intervenciones_rag_finalizado_por_fkey
      FOREIGN KEY (finalizado_por) REFERENCES public.usuarios(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.intervenciones_rag'::regclass
      AND conname = 'intervenciones_rag_motivo_finalizacion_check'
  ) THEN
    ALTER TABLE public.intervenciones_rag
      ADD CONSTRAINT intervenciones_rag_motivo_finalizacion_check
      CHECK (
        motivo_finalizacion IS NULL
        OR motivo_finalizacion IN ('reemplazado', 'oferta_centralizada', 'decision_comercial', 'otro')
      );
  END IF;
END;
$$;

-- El modelo previo guardaba cada cambio de porcentaje como una nueva fila sin
-- marcar cuál dejaba de estar vigente. Se reconstruye esa historia: todas las
-- intervenciones salvo la última de cada vencimiento quedan finalizadas cuando
-- comenzó la siguiente.
WITH ordenadas AS (
  SELECT
    id,
    lead(aplicado_at) OVER (
      PARTITION BY vencimiento_id
      ORDER BY aplicado_at, created_at, id
    ) AS siguiente_aplicado_at,
    lead(usuario_id) OVER (
      PARTITION BY vencimiento_id
      ORDER BY aplicado_at, created_at, id
    ) AS siguiente_usuario_id
  FROM public.intervenciones_rag
)
UPDATE public.intervenciones_rag r
SET
  finalizado_at = o.siguiente_aplicado_at,
  finalizado_por = o.siguiente_usuario_id,
  motivo_finalizacion = 'reemplazado'
FROM ordenadas o
WHERE r.id = o.id
  AND r.finalizado_at IS NULL
  AND o.siguiente_aplicado_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS intervenciones_rag_un_vigente_por_vencimiento_uidx
  ON public.intervenciones_rag(vencimiento_id)
  WHERE finalizado_at IS NULL;

CREATE OR REPLACE FUNCTION public.registrar_intervencion_rag_invoker_v1(
  p_vencimiento_id uuid,
  p_porcentaje_descuento numeric,
  p_nota text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_sucursal uuid;
  v_producto uuid;
  v_cantidad numeric;
  v_vmd numeric;
  v_rag_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000';
  END IF;

  IF p_porcentaje_descuento IS NULL OR p_porcentaje_descuento <= 0 OR p_porcentaje_descuento > 100 THEN
    RAISE EXCEPTION 'El porcentaje RAG debe ser mayor a 0 y menor o igual a 100' USING ERRCODE='22023';
  END IF;

  SELECT p.organizacion_id, v.sucursal_id, v.producto_id, v.cantidad, ps.venta_media_diaria
    INTO v_org, v_sucursal, v_producto, v_cantidad, v_vmd
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  JOIN public.producto_sucursal ps
    ON ps.producto_id = v.producto_id
   AND ps.sucursal_id = v.sucursal_id
   AND ps.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo/estado de sucursal no encontrado' USING ERRCODE='P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para registrar RAG sobre este producto' USING ERRCODE='42501';
  END IF;

  -- Un cambio de porcentaje termina la intervención anterior y abre una nueva.
  UPDATE public.intervenciones_rag
  SET
    finalizado_at = now(),
    finalizado_por = v_uid,
    motivo_finalizacion = 'reemplazado',
    nota_finalizacion = NULL
  WHERE vencimiento_id = p_vencimiento_id
    AND finalizado_at IS NULL;

  INSERT INTO public.intervenciones_rag(
    organizacion_id,
    sucursal_id,
    producto_id,
    vencimiento_id,
    usuario_id,
    porcentaje_descuento,
    cantidad_comprometida_al_aplicar,
    vmd_glaciar_al_aplicar,
    nota
  )
  VALUES(
    v_org,
    v_sucursal,
    v_producto,
    p_vencimiento_id,
    v_uid,
    p_porcentaje_descuento,
    v_cantidad,
    v_vmd,
    NULLIF(btrim(p_nota), '')
  )
  RETURNING id INTO v_rag_id;

  RETURN v_rag_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_control_vencimiento_dashboard_invoker_v1(
  p_vencimiento_id uuid,
  p_cantidad_comprometida numeric,
  p_fecha_vencimiento date,
  p_stock_actual integer,
  p_porcentaje_rag numeric DEFAULT NULL::numeric,
  p_nota text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_sucursal uuid;
  v_producto uuid;
  v_dias_donacion integer;
  v_obs_id bigint;
  v_rag_id uuid;
  v_finalizar_rag boolean := false;
  v_partes text[];
  v_motivo_finalizacion text;
  v_nota_finalizacion text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_cantidad_comprometida IS NULL OR p_cantidad_comprometida <= 0 THEN
    RAISE EXCEPTION 'La cantidad comprometida debe ser mayor a cero; use cierre vendido para cantidad cero' USING ERRCODE = '22023';
  END IF;

  IF p_fecha_vencimiento IS NULL THEN
    RAISE EXCEPTION 'La fecha de vencimiento es obligatoria' USING ERRCODE = '22023';
  END IF;

  IF p_stock_actual IS NULL OR p_stock_actual < 0 THEN
    RAISE EXCEPTION 'El stock total debe ser mayor o igual a cero' USING ERRCODE = '22023';
  END IF;

  IF p_porcentaje_rag IS NOT NULL AND (p_porcentaje_rag < 0 OR p_porcentaje_rag > 100) THEN
    RAISE EXCEPTION 'El porcentaje RAG debe estar entre 0 y 100' USING ERRCODE = '22023';
  END IF;

  IF p_porcentaje_rag = 0 THEN
    IF p_nota IS NULL OR p_nota NOT LIKE 'FINALIZAR_RAG|%' THEN
      RAISE EXCEPTION 'Para finalizar un RAG se requiere un motivo válido' USING ERRCODE = '22023';
    END IF;

    v_partes := string_to_array(p_nota, '|');
    v_motivo_finalizacion := NULLIF(btrim(v_partes[2]), '');
    IF array_length(v_partes, 1) >= 3 THEN
      v_nota_finalizacion := NULLIF(btrim(array_to_string(v_partes[3:array_length(v_partes, 1)], '|')), '');
    END IF;

    IF v_motivo_finalizacion IS NULL OR v_motivo_finalizacion NOT IN ('oferta_centralizada', 'decision_comercial', 'otro') THEN
      RAISE EXCEPTION 'Motivo de finalización RAG no válido' USING ERRCODE = '22023';
    END IF;

    v_finalizar_rag := true;
  END IF;

  SELECT v.sucursal_id, v.producto_id, sec.dias_donacion
    INTO v_sucursal, v_producto, v_dias_donacion
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  LEFT JOIN public.familias f ON f.id = p.familia_id AND f.organizacion_id = p.organizacion_id
  LEFT JOIN public.sectores sec ON sec.id = f.sector_id AND sec.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true
  FOR UPDATE OF v;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para controlar este vencimiento' USING ERRCODE = '42501';
  END IF;

  IF v_dias_donacion IS NULL THEN
    RAISE EXCEPTION 'Este producto pertenece a un sector fuera del circuito de vencimientos configurado' USING ERRCODE = '22023';
  END IF;

  UPDATE public.vencimientos
  SET fecha_vencimiento = p_fecha_vencimiento,
      updated_at = now()
  WHERE id = p_vencimiento_id;

  SELECT public.registrar_control_vencimiento(
    p_vencimiento_id,
    p_cantidad_comprometida,
    CASE WHEN v_finalizar_rag THEN NULL ELSE p_nota END
  ) INTO v_obs_id;

  IF v_finalizar_rag THEN
    UPDATE public.intervenciones_rag
    SET
      finalizado_at = now(),
      finalizado_por = v_uid,
      motivo_finalizacion = v_motivo_finalizacion,
      nota_finalizacion = v_nota_finalizacion
    WHERE id = (
      SELECT r.id
      FROM public.intervenciones_rag r
      WHERE r.vencimiento_id = p_vencimiento_id
        AND r.finalizado_at IS NULL
      ORDER BY r.aplicado_at DESC, r.created_at DESC, r.id DESC
      LIMIT 1
      FOR UPDATE
    )
    RETURNING id INTO v_rag_id;

    IF v_rag_id IS NULL THEN
      RAISE EXCEPTION 'No hay un RAG vigente para finalizar' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_porcentaje_rag IS NOT NULL THEN
    IF p_porcentaje_rag <= 0 THEN
      RAISE EXCEPTION 'El porcentaje RAG debe ser mayor a 0 y menor o igual a 100' USING ERRCODE = '22023';
    END IF;
    SELECT public.registrar_intervencion_rag(p_vencimiento_id, p_porcentaje_rag, p_nota)
      INTO v_rag_id;
  END IF;

  PERFORM public.actualizar_stock_producto_sucursal_scanner(v_sucursal, v_producto, p_stock_actual);

  RETURN jsonb_build_object(
    'observacion_id', v_obs_id,
    'intervencion_rag_id', v_rag_id,
    'rag_finalizado', v_finalizar_rag,
    'sucursal_id', v_sucursal,
    'producto_id', v_producto
  );
END;
$function$;

CREATE OR REPLACE VIEW public.v_seguimiento_rag_actual
WITH (security_invoker = true)
AS
SELECT
  v.id AS vencimiento_id,
  p.organizacion_id,
  v.sucursal_id,
  v.producto_id,
  p.descripcion,
  p.familia_id,
  f.sector_id,
  s.nombre AS sector_nombre,
  s.dias_donacion,
  v.fecha_vencimiento,
  v.fecha_vencimiento - op.hoy AS dias_hasta_vencimiento,
  GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0) AS dias_comerciales_restantes,
  ps.venta_media_diaria AS vmd_glaciar_actual,
  ps.fecha_ultima_importacion,
  rag.id AS rag_id,
  rag.porcentaje_descuento AS rag_porcentaje,
  rag.aplicado_at AS rag_aplicado_at,
  rag.cantidad_comprometida_al_aplicar AS cantidad_base_rag,
  rag.vmd_glaciar_al_aplicar,
  obs.id AS observacion_id,
  obs.observada_at,
  obs.cantidad_comprometida AS cantidad_observada,
  COALESCE(obs.cantidad_comprometida, v.cantidad::numeric) AS cantidad_actual_estimacion,
  CASE
    WHEN rag.id IS NULL OR obs.id IS NULL THEN NULL::numeric
    ELSE GREATEST(rag.cantidad_comprometida_al_aplicar - obs.cantidad_comprometida, 0::numeric)
  END AS unidades_vendidas_observadas,
  CASE
    WHEN rag.id IS NULL OR obs.id IS NULL OR obs.observada_at <= rag.aplicado_at THEN NULL::numeric
    ELSE EXTRACT(epoch FROM obs.observada_at - rag.aplicado_at) / 86400.0
  END AS dias_observados,
  CASE
    WHEN rag.id IS NULL OR obs.id IS NULL OR obs.observada_at <= rag.aplicado_at THEN NULL::numeric
    ELSE GREATEST(rag.cantidad_comprometida_al_aplicar - obs.cantidad_comprometida, 0::numeric)
      / NULLIF(EXTRACT(epoch FROM obs.observada_at - rag.aplicado_at) / 86400.0, 0::numeric)
  END AS velocidad_observada,
  CASE
    WHEN GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0) <= 0 THEN NULL::numeric
    ELSE COALESCE(obs.cantidad_comprometida, v.cantidad::numeric)
      / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0)::numeric
  END AS velocidad_necesaria,
  CASE
    WHEN (v.fecha_vencimiento - op.hoy) <= 0 THEN 'decomiso'::text
    WHEN (v.fecha_vencimiento - op.hoy) <= s.dias_donacion THEN 'donacion'::text
    WHEN rag.id IS NULL THEN 'sin_rag'::text
    WHEN obs.id IS NULL THEN
      CASE
        WHEN GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0) > 0
          AND ps.venta_media_diaria >= (v.cantidad::numeric / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 1)::numeric)
          THEN 'efectivo_por_vmd'::text
        ELSE 'pendiente_control_operador'::text
      END
    WHEN obs.cantidad_comprometida > rag.cantidad_comprometida_al_aplicar THEN 'dato_a_revisar'::text
    WHEN obs.cantidad_comprometida = 0::numeric THEN 'efectivo'::text
    WHEN obs.cantidad_comprometida = rag.cantidad_comprometida_al_aplicar THEN 'sin_movimiento'::text
    WHEN obs.observada_at <= rag.aplicado_at THEN 'pendiente_control_operador'::text
    WHEN (
      GREATEST(rag.cantidad_comprometida_al_aplicar - obs.cantidad_comprometida, 0::numeric)
      / NULLIF(EXTRACT(epoch FROM obs.observada_at - rag.aplicado_at) / 86400.0, 0::numeric)
    ) >= (
      obs.cantidad_comprometida
      / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 1)::numeric
    ) THEN 'efectivo'::text
    ELSE 'insuficiente'::text
  END AS estado_seguimiento_rag
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
CROSS JOIN LATERAL (
  SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy
) op
LEFT JOIN LATERAL (
  SELECT r.*
  FROM public.intervenciones_rag r
  WHERE r.vencimiento_id = v.id
    AND r.finalizado_at IS NULL
  ORDER BY r.aplicado_at DESC, r.created_at DESC, r.id DESC
  LIMIT 1
) rag ON true
LEFT JOIN LATERAL (
  SELECT o.*
  FROM public.vencimiento_observaciones o
  WHERE o.vencimiento_id = v.id
    AND rag.id IS NOT NULL
    AND o.observada_at > rag.aplicado_at
  ORDER BY o.observada_at DESC, o.id DESC
  LIMIT 1
) obs ON true
WHERE v.activo = true
  AND s.dias_donacion IS NOT NULL;

COMMENT ON COLUMN public.intervenciones_rag.finalizado_at IS 'Momento en que esta intervención RAG dejó de estar vigente sin cerrar necesariamente el vencimiento.';
COMMENT ON COLUMN public.intervenciones_rag.motivo_finalizacion IS 'Motivo normalizado de finalización: reemplazado, oferta_centralizada, decision_comercial u otro.';
