-- NOVEN · PROBLEMAS ACTIVOS Y SEGUIMIENTO DE RESOLUCIÓN V1
--
-- Objetivo:
-- cerrar el hueco entre "Noven avisó" y "alguien actuó" sin agregar un
-- segundo sistema de tareas. El ledger existente de observaciones, RAG y
-- acciones terminales sigue siendo la fuente de verdad.
--
-- Reglas:
-- 1. Cada control posterior a un escalamiento marca respuesta operativa.
-- 2. Si ese nuevo control vuelve a confirmar RAG insuficiente/sin movimiento,
--    se crea un NUEVO escalamiento para esa nueva observación.
-- 3. Una nueva intervención RAG, su finalización o un cierre terminal también
--    responden los escalamiento abiertos.
-- 4. No hay spam por reintentos técnicos: el dedupe es por (rag_id,
--    observacion_id), es decir, como máximo un escalamiento por control físico.

BEGIN;

ALTER TABLE public.rag_escalamientos
  ADD COLUMN IF NOT EXISTS respondido_at timestamptz,
  ADD COLUMN IF NOT EXISTS respondido_por uuid,
  ADD COLUMN IF NOT EXISTS respuesta_tipo text,
  ADD COLUMN IF NOT EXISTS respuesta_referencia text;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rag_escalamientos_respuesta_tipo_check'
      AND conrelid = 'public.rag_escalamientos'::regclass
  ) THEN
    ALTER TABLE public.rag_escalamientos
      ADD CONSTRAINT rag_escalamientos_respuesta_tipo_check
      CHECK (
        respuesta_tipo IS NULL OR respuesta_tipo IN (
          'control',
          'nueva_intervencion',
          'finalizacion_rag',
          'cierre_terminal'
        )
      );
  END IF;
END
$do$;

ALTER TABLE public.rag_escalamientos
  DROP CONSTRAINT IF EXISTS rag_escalamientos_unico_por_intervencion;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rag_escalamientos_unico_por_control'
      AND conrelid = 'public.rag_escalamientos'::regclass
  ) THEN
    ALTER TABLE public.rag_escalamientos
      ADD CONSTRAINT rag_escalamientos_unico_por_control
      UNIQUE (rag_id, observacion_id);
  END IF;
END
$do$;

CREATE INDEX IF NOT EXISTS rag_escalamientos_abiertos_vencimiento_idx
  ON public.rag_escalamientos(vencimiento_id, detectado_at DESC)
  WHERE respondido_at IS NULL;

COMMENT ON COLUMN public.rag_escalamientos.respondido_at IS
  'Momento de la primera evidencia operativa posterior al escalamiento.';
COMMENT ON COLUMN public.rag_escalamientos.respondido_por IS
  'Usuario asociado a la primera evidencia operativa posterior, cuando existe.';
COMMENT ON COLUMN public.rag_escalamientos.respuesta_tipo IS
  'Tipo de evidencia que respondió el escalamiento: control, nueva_intervencion, finalizacion_rag o cierre_terminal.';

CREATE OR REPLACE FUNCTION noven_private.marcar_escalamientos_respondidos_v1(
  p_vencimiento_id uuid,
  p_respondido_at timestamptz,
  p_respondido_por uuid,
  p_tipo text,
  p_referencia text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actualizados integer := 0;
BEGIN
  IF p_vencimiento_id IS NULL OR p_respondido_at IS NULL THEN
    RETURN 0;
  END IF;

  IF p_tipo NOT IN ('control', 'nueva_intervencion', 'finalizacion_rag', 'cierre_terminal') THEN
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
$function$;

REVOKE ALL ON FUNCTION noven_private.marcar_escalamientos_respondidos_v1(uuid, timestamptz, uuid, text, text)
  FROM PUBLIC, anon, authenticated;

-- Reemplaza V1 para permitir un nuevo escalamiento cuando un NUEVO control
-- vuelve a confirmar que la misma intervención sigue sin responder.
CREATE OR REPLACE FUNCTION noven_private.registrar_escalamiento_rag_si_corresponde_v1(
  p_vencimiento_id uuid
)
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
  SELECT
    s.vencimiento_id,
    s.organizacion_id,
    s.sucursal_id,
    s.producto_id,
    s.rag_id,
    s.rag_porcentaje,
    s.observacion_id,
    s.cantidad_actual_estimacion,
    s.vmd_glaciar_actual,
    s.dias_comerciales_restantes,
    s.velocidad_observada,
    s.velocidad_necesaria,
    s.estado_seguimiento_rag
  INTO v_seg
  FROM public.v_seguimiento_rag_actual s
  WHERE s.vencimiento_id = p_vencimiento_id
    AND s.rag_id IS NOT NULL
    AND s.observacion_id IS NOT NULL
    AND s.estado_seguimiento_rag IN ('insuficiente', 'sin_movimiento')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT c.costo_unitario
    INTO v_costo
  FROM public.producto_costo_ultima_observacion c
  WHERE c.producto_id = v_seg.producto_id;

  v_unidades_expuestas := GREATEST(
    COALESCE(v_seg.cantidad_actual_estimacion, 0::numeric)
    - GREATEST(COALESCE(v_seg.vmd_glaciar_actual, 0::numeric), 0::numeric)
      * GREATEST(COALESCE(v_seg.dias_comerciales_restantes, 0), 0)::numeric,
    0::numeric
  );

  IF v_costo IS NOT NULL THEN
    v_dinero_en_riesgo := v_unidades_expuestas * v_costo;
  END IF;

  INSERT INTO public.rag_escalamientos(
    organizacion_id,
    sucursal_id,
    producto_id,
    vencimiento_id,
    rag_id,
    observacion_id,
    estado_seguimiento,
    rag_porcentaje,
    cantidad_actual,
    unidades_expuestas,
    velocidad_observada,
    velocidad_necesaria,
    costo_unitario_sin_iva,
    dinero_en_riesgo_sin_iva
  ) VALUES (
    v_seg.organizacion_id,
    v_seg.sucursal_id,
    v_seg.producto_id,
    v_seg.vencimiento_id,
    v_seg.rag_id,
    v_seg.observacion_id,
    v_seg.estado_seguimiento_rag,
    v_seg.rag_porcentaje,
    COALESCE(v_seg.cantidad_actual_estimacion, 0::numeric),
    v_unidades_expuestas,
    v_seg.velocidad_observada,
    v_seg.velocidad_necesaria,
    v_costo,
    v_dinero_en_riesgo
  )
  ON CONFLICT (rag_id, observacion_id) DO NOTHING
  RETURNING id INTO v_escalamiento_id;

  IF v_escalamiento_id IS NOT NULL THEN
    PERFORM noven_private.notificar_escalamiento_rag_async_v1(v_escalamiento_id);
  END IF;

  RETURN v_escalamiento_id;
END;
$function$;

REVOKE ALL ON FUNCTION noven_private.registrar_escalamiento_rag_si_corresponde_v1(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION noven_private.responder_escalamiento_por_observacion_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM noven_private.marcar_escalamientos_respondidos_v1(
    NEW.vencimiento_id,
    NEW.observada_at,
    NEW.usuario_id,
    'control',
    'observacion:' || NEW.id::text
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION noven_private.responder_escalamiento_por_observacion_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vencimiento_observaciones_respuesta_escalamiento_trg
  ON public.vencimiento_observaciones;
CREATE TRIGGER vencimiento_observaciones_respuesta_escalamiento_trg
AFTER INSERT ON public.vencimiento_observaciones
FOR EACH ROW
EXECUTE FUNCTION noven_private.responder_escalamiento_por_observacion_v1();

CREATE OR REPLACE FUNCTION noven_private.responder_escalamiento_por_rag_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM noven_private.marcar_escalamientos_respondidos_v1(
      NEW.vencimiento_id,
      COALESCE(NEW.aplicado_at, NEW.created_at, now()),
      NEW.usuario_id,
      'nueva_intervencion',
      'rag:' || NEW.id::text
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.finalizado_at IS NULL
    AND NEW.finalizado_at IS NOT NULL THEN
    PERFORM noven_private.marcar_escalamientos_respondidos_v1(
      NEW.vencimiento_id,
      NEW.finalizado_at,
      COALESCE(NEW.finalizado_por, NEW.usuario_id),
      'finalizacion_rag',
      'rag:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION noven_private.responder_escalamiento_por_rag_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS intervenciones_rag_respuesta_escalamiento_trg
  ON public.intervenciones_rag;
CREATE TRIGGER intervenciones_rag_respuesta_escalamiento_trg
AFTER INSERT OR UPDATE OF finalizado_at ON public.intervenciones_rag
FOR EACH ROW
EXECUTE FUNCTION noven_private.responder_escalamiento_por_rag_v1();

CREATE OR REPLACE FUNCTION noven_private.responder_escalamiento_por_cierre_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.tipo IN ('vendido', 'donacion', 'decomiso') THEN
    PERFORM noven_private.marcar_escalamientos_respondidos_v1(
      NEW.vencimiento_id,
      NEW.created_at,
      NEW.usuario_id,
      'cierre_terminal',
      'accion:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION noven_private.responder_escalamiento_por_cierre_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS acciones_operativas_respuesta_escalamiento_trg
  ON public.acciones_operativas;
CREATE TRIGGER acciones_operativas_respuesta_escalamiento_trg
AFTER INSERT ON public.acciones_operativas
FOR EACH ROW
EXECUTE FUNCTION noven_private.responder_escalamiento_por_cierre_v1();

COMMIT;
