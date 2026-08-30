-- NOVEN · ESCALAMIENTO SIMULTÁNEO DE RAG INSUFICIENTE V1
--
-- Decisión de producto:
-- cuando una intervención RAG vigente demuestra respuesta insuficiente,
-- Noven no espera una cadena secuencial Operador -> Gerencia. Registra un
-- escalamiento único por intervención y solicita aviso simultáneo al operador
-- responsable de la familia y a la gerencia de la sucursal.
--
-- El disparo se evalúa al final de la transacción que registra una observación.
-- Esto evita falsos positivos cuando esa misma operación finaliza/cierra el RAG
-- o reemplaza la intervención por un nuevo porcentaje.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rag_escalamientos (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id            uuid        NOT NULL REFERENCES public.organizaciones(id) ON DELETE RESTRICT,
  sucursal_id                uuid        NOT NULL,
  producto_id                uuid        NOT NULL,
  vencimiento_id             uuid        NOT NULL,
  rag_id                     uuid        NOT NULL REFERENCES public.intervenciones_rag(id) ON DELETE RESTRICT,
  observacion_id             bigint      NOT NULL REFERENCES public.vencimiento_observaciones(id) ON DELETE RESTRICT,
  estado_seguimiento         text        NOT NULL CHECK (estado_seguimiento IN ('insuficiente', 'sin_movimiento')),
  rag_porcentaje             numeric(5,2) NOT NULL,
  cantidad_actual            numeric     NOT NULL CHECK (cantidad_actual >= 0),
  unidades_expuestas         numeric     NOT NULL CHECK (unidades_expuestas >= 0),
  velocidad_observada        numeric,
  velocidad_necesaria        numeric,
  costo_unitario_sin_iva     numeric,
  dinero_en_riesgo_sin_iva   numeric,
  detectado_at               timestamptz NOT NULL DEFAULT now(),
  push_solicitado_at         timestamptz,
  push_request_id            bigint,
  push_procesado_at          timestamptz,
  push_destinatarios         integer,
  push_enviados              integer,

  CONSTRAINT rag_escalamientos_unico_por_intervencion UNIQUE (rag_id),
  CONSTRAINT rag_escalamientos_sucursal_org_fk
    FOREIGN KEY (sucursal_id, organizacion_id)
    REFERENCES public.sucursales(id, organizacion_id)
    ON DELETE RESTRICT,
  CONSTRAINT rag_escalamientos_producto_org_fk
    FOREIGN KEY (producto_id, organizacion_id)
    REFERENCES public.productos(id, organizacion_id)
    ON DELETE RESTRICT,
  CONSTRAINT rag_escalamientos_vencimiento_scope_fk
    FOREIGN KEY (vencimiento_id, producto_id, sucursal_id)
    REFERENCES public.vencimientos(id, producto_id, sucursal_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS rag_escalamientos_sucursal_fecha_idx
  ON public.rag_escalamientos(sucursal_id, detectado_at DESC);
CREATE INDEX IF NOT EXISTS rag_escalamientos_vencimiento_fecha_idx
  ON public.rag_escalamientos(vencimiento_id, detectado_at DESC);

ALTER TABLE public.rag_escalamientos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rag_escalamientos FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.rag_escalamientos IS
  'Ledger server-only de escalamiento simultáneo cuando un RAG vigente resulta insuficiente. Un evento máximo por rag_id; no implica causalidad econométrica.';

-- Solicita el Web Push en forma asíncrona. El secreto permanece en Vault y un
-- fallo de infraestructura de push nunca debe impedir el control operativo.
CREATE OR REPLACE FUNCTION noven_private.notificar_escalamiento_rag_async_v1(
  p_escalamiento_id uuid
)
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
$function$;

REVOKE ALL ON FUNCTION noven_private.notificar_escalamiento_rag_async_v1(uuid)
  FROM PUBLIC, anon, authenticated;

-- Evalúa el estado consolidado una vez que la operación dejó persistido su
-- resultado final. Sólo crea evento con observación posterior al RAG y con
-- estado insuficiente/sin movimiento. El UNIQUE(rag_id) evita spam por controles
-- repetidos de la misma intervención.
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
  ON CONFLICT (rag_id) DO NOTHING
  RETURNING id INTO v_escalamiento_id;

  IF v_escalamiento_id IS NOT NULL THEN
    PERFORM noven_private.notificar_escalamiento_rag_async_v1(v_escalamiento_id);
  END IF;

  RETURN v_escalamiento_id;
END;
$function$;

REVOKE ALL ON FUNCTION noven_private.registrar_escalamiento_rag_si_corresponde_v1(uuid)
  FROM PUBLIC, anon, authenticated;

-- Constraint trigger diferido: se ejecuta al cierre de la transacción. Por eso
-- un cierre vendido, una finalización explícita o un reemplazo de RAG ya son
-- visibles y no generan una alerta falsa sobre una intervención que dejó de
-- estar vigente dentro de esa misma operación.
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
    -- El control físico/económico nunca debe fallar porque falló el subsistema
    -- de escalamiento. El warning deja rastro técnico para observabilidad DB.
    RAISE WARNING 'Noven RAG: evaluación de escalamiento falló para vencimiento %: %', NEW.vencimiento_id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION noven_private.evaluar_escalamiento_rag_observacion_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vencimiento_observaciones_escalamiento_rag_ct
  ON public.vencimiento_observaciones;

CREATE CONSTRAINT TRIGGER vencimiento_observaciones_escalamiento_rag_ct
AFTER INSERT ON public.vencimiento_observaciones
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION noven_private.evaluar_escalamiento_rag_observacion_v1();

COMMIT;
