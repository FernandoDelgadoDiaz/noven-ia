-- =============================================================================
-- NOVEN · SALIDAS DE STOCK QUE NO SON VENTA  (bloque 5a · modelo y captura)
--
-- EL PROBLEMA, MEDIDO EN PRODUCCIÓN
--
-- El motor lee toda caída de stock comprometido como venta. No siempre lo es.
-- Caso real: POSTRE DE MANI LA ANONIMA 3 (cod_art 1710102) pasó de 231 unidades
-- el 29-08 a 69 el 02-09. Son 162 unidades en cuatro días que NO se vendieron:
-- hubo una transferencia a otra sucursal. Con ese dato el motor calcula una
-- velocidad observada de 42,4 unidades/día cuando la real es ~0.
--
-- Contamina en dos lugares a la vez: la cobertura de hoy —que decide si se
-- sugiere subir un escalón— y la evidencia del motor histórico mañana. Un caso
-- registrado como "la oferta central movió 162 unidades en cuatro días" es peor
-- que no tener el caso.
--
-- POR QUÉ NO ES UN TIPO DE INTERVENCIÓN
--
-- Una transferencia no es algo que se hace para vender más. Es una salida de
-- stock que no fue venta. Pertenece al control que la observó, no al catálogo
-- de intervenciones.
--
-- POR QUÉ NO ES UN CAMPO NUMÉRICO QUE CARGA EL OPERADOR
--
-- Eran 162 unidades. Nadie las cuenta a mano, y un campo que pide "unidades no
-- vendidas desde el control previo" se llenaría con el acumulado o no se
-- llenaría. Quien carga está en la góndola con el teléfono en una mano.
--
-- El operador cuenta lo que hay, que es lo que sabe hacer. La cantidad la
-- deriva el servidor: es la diferencia contra el control anterior, que él no
-- tuvo que calcular. Lo único que responde es la CAUSA, con un botón.
--
-- ESTA MIGRACIÓN NO CAMBIA NINGÚN CÁLCULO
--
-- Agrega el lugar donde vive el dato y la vía para declararlo. El descuento en
-- la velocidad observada es el bloque siguiente y toca la vista, con sus
-- propios contratos de mutación. Separado a propósito: capturar es inofensivo,
-- descontar cambia números que hoy se muestran.
-- =============================================================================

-- --- 1. Dónde vive el dato ---------------------------------------------------
--
-- CUATRO ESTADOS, NO DOS. La diferencia entre ellos es lo que hace utilizable
-- el histórico:
--
--   respuesta IS NULL   nunca se preguntó — el control es anterior al campo, o
--                       la velocidad no fue anómala y no había nada que
--                       preguntar
--   'venta'             se preguntó y el operador confirmó que fue venta
--   'transferencia' …   se preguntó y declaró una causa distinta de la venta
--   'no_declarado'      se preguntó y no supo, o cerró sin responder
--
-- `no_declarado` NO es cero y NO es venta: es una ausencia declarada. El
-- histórico puede excluir los tramos que la contengan; tratarla como cero
-- inventaría una certeza que nadie dio.

ALTER TABLE public.vencimiento_observaciones
  ADD COLUMN IF NOT EXISTS no_venta_respuesta      text,
  ADD COLUMN IF NOT EXISTS unidades_no_venta       numeric,
  ADD COLUMN IF NOT EXISTS no_venta_declarada_at   timestamptz,
  ADD COLUMN IF NOT EXISTS no_venta_declarada_por  uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vencimiento_observaciones'::regclass
      AND conname = 'vencimiento_observaciones_no_venta_respuesta_check'
  ) THEN
    ALTER TABLE public.vencimiento_observaciones
      ADD CONSTRAINT vencimiento_observaciones_no_venta_respuesta_check
      CHECK (
        no_venta_respuesta IS NULL
        OR no_venta_respuesta IN (
          'venta', 'transferencia', 'rotura', 'decomiso_parcial', 'otro', 'no_declarado'
        )
      );
  END IF;

  -- Las unidades acompañan a la causa y sólo a la causa. Con 'venta' son cero
  -- —se confirmó que no hubo salida ajena—; con 'no_declarado' o sin preguntar
  -- son NULL, porque nadie las declaró.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vencimiento_observaciones'::regclass
      AND conname = 'vencimiento_observaciones_unidades_no_venta_check'
  ) THEN
    ALTER TABLE public.vencimiento_observaciones
      ADD CONSTRAINT vencimiento_observaciones_unidades_no_venta_check
      CHECK (
        (no_venta_respuesta IS NULL          AND unidades_no_venta IS NULL)
        OR (no_venta_respuesta = 'venta'         AND unidades_no_venta = 0)
        OR (no_venta_respuesta = 'no_declarado'  AND unidades_no_venta IS NULL)
        OR (no_venta_respuesta IN ('transferencia', 'rotura', 'decomiso_parcial', 'otro')
            AND unidades_no_venta IS NOT NULL AND unidades_no_venta > 0)
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.vencimiento_observaciones.no_venta_respuesta IS
  'Qué se declaró sobre la caída desde el control previo: NULL = no se preguntó; venta; una causa (transferencia, rotura, decomiso_parcial, otro); no_declarado = se preguntó y no se supo.';
COMMENT ON COLUMN public.vencimiento_observaciones.unidades_no_venta IS
  'Unidades que salieron por una causa distinta de la venta desde el control previo. La calcula el servidor, no el cliente. NULL cuando no se preguntó o no se declaró.';

-- --- 2. El umbral es política de cada organización ---------------------------
--
-- Cuántas veces la velocidad necesaria hay que superar para que la salida
-- amerite preguntar. Va por organización y no como constante del código, por lo
-- mismo que la escala de descuentos: una política comercial dentro del producto
-- obliga a un deploy para que la organización siguiente tenga otra.
--
-- El valor por defecto sale de medir los 109 controles registrados en
-- producción: con 10× dispara 1, que es la transferencia real conocida; con 20×
-- no dispara ninguno y se perdería justamente ese caso. Es un punto de partida
-- con evidencia, no un número elegido de memoria, y cada organización lo mueve
-- sin tocar código.

ALTER TABLE public.organizaciones
  ADD COLUMN IF NOT EXISTS umbral_salida_anomala numeric NOT NULL DEFAULT 10;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.organizaciones'::regclass
      AND conname = 'organizaciones_umbral_salida_anomala_check'
  ) THEN
    ALTER TABLE public.organizaciones
      ADD CONSTRAINT organizaciones_umbral_salida_anomala_check
      CHECK (umbral_salida_anomala > 1);
  END IF;
END
$$;

COMMENT ON COLUMN public.organizaciones.umbral_salida_anomala IS
  'Múltiplo de la velocidad necesaria a partir del cual una caída de stock amerita preguntar por su causa. Política de la organización.';

-- --- 3. El contexto de una caída, para decidir si se pregunta ----------------
--
-- Devuelve los insumos; NO decide. La decisión vive en
-- `src/lib/salidaAnomala.ts`, en una función pura y testeable, para no tener la
-- misma regla escrita en dos lenguajes y que se separen con el tiempo.
--
-- La cantidad de la caída sale de acá y nunca del cliente: es el número que el
-- operador no tuvo que calcular, y dejarlo del lado del browser lo volvería
-- falsificable y además cargaría al operador con la resta.

CREATE OR REPLACE FUNCTION noven_private.contexto_salida_control_impl(p_observacion_id bigint)
RETURNS TABLE (
  observacion_id        bigint,
  vencimiento_id        uuid,
  cantidad_previa       numeric,
  cantidad_actual       numeric,
  bajada                numeric,
  dias                  numeric,
  velocidad_necesaria   numeric,
  umbral                numeric,
  ya_declarada          boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH actual AS (
    SELECT o.id, o.vencimiento_id, o.sucursal_id, o.producto_id,
           o.organizacion_id, o.cantidad_comprometida, o.observada_at,
           o.no_venta_respuesta
    FROM public.vencimiento_observaciones o
    WHERE o.id = p_observacion_id
  ),
  previa AS (
    SELECT o.cantidad_comprometida, o.observada_at
    FROM public.vencimiento_observaciones o, actual a
    WHERE o.vencimiento_id = a.vencimiento_id
      AND o.observada_at < a.observada_at
    ORDER BY o.observada_at DESC, o.id DESC
    LIMIT 1
  )
  SELECT a.id,
         a.vencimiento_id,
         p.cantidad_comprometida,
         a.cantidad_comprometida,
         p.cantidad_comprometida - a.cantidad_comprometida,
         EXTRACT(epoch FROM a.observada_at - p.observada_at) / 86400.0,
         sg.velocidad_necesaria,
         org.umbral_salida_anomala,
         a.no_venta_respuesta IS NOT NULL
  FROM actual a
  LEFT JOIN previa p ON true
  LEFT JOIN public.v_seguimiento_rag_actual sg ON sg.vencimiento_id = a.vencimiento_id
  JOIN public.organizaciones org ON org.id = a.organizacion_id
  WHERE noven_private.puede_leer_producto_sucursal(a.sucursal_id, a.producto_id);
$function$;

CREATE OR REPLACE FUNCTION public.contexto_salida_control(p_observacion_id bigint)
RETURNS TABLE (
  observacion_id        bigint,
  vencimiento_id        uuid,
  cantidad_previa       numeric,
  cantidad_actual       numeric,
  bajada                numeric,
  dias                  numeric,
  velocidad_necesaria   numeric,
  umbral                numeric,
  ya_declarada          boolean
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM noven_private.contexto_salida_control_impl(p_observacion_id);
$$;

-- El wrapper público es SECURITY INVOKER, así que corre con los privilegios de
-- quien llama. Para que `authenticated` pueda usarlo necesita EXECUTE sobre la
-- implementación: revocárselo deja la RPC inutilizable y el error recién
-- aparece en runtime.
--
-- El aislamiento no lo da este GRANT sino que `noven_private` no está entre los
-- esquemas expuestos por PostgREST: nadie puede llamar a la implementación por
-- HTTP. Es el mismo patrón de las trece RPC que ya funcionan en producción.
REVOKE ALL ON FUNCTION noven_private.contexto_salida_control_impl(bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.contexto_salida_control_impl(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.contexto_salida_control(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contexto_salida_control(bigint) TO authenticated;

-- --- 4. Declarar la causa ----------------------------------------------------
--
-- El cliente manda la RESPUESTA, nunca la cantidad. El servidor la deriva del
-- control previo. Si el browser pudiera mandarla, el dato dejaría de ser
-- confiable justo en el registro que existe para limpiar el histórico.
--
-- Se permite re-declarar. Un operador que toca el botón equivocado en la
-- góndola quedaría con el dato mal para siempre, y eso es peor que perder la
-- primera respuesta: `no_venta_declarada_at` y `_por` dejan asentado quién y
-- cuándo fue la última.

CREATE OR REPLACE FUNCTION noven_private.declarar_salida_no_venta_impl(
  p_observacion_id bigint,
  p_respuesta      text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid       uuid := (SELECT auth.uid());
  v_ctx       record;
  v_unidades  numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_respuesta IS NULL OR p_respuesta NOT IN (
    'venta', 'transferencia', 'rotura', 'decomiso_parcial', 'otro', 'no_declarado'
  ) THEN
    RAISE EXCEPTION 'Respuesta inválida: %', p_respuesta USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ctx
  FROM noven_private.contexto_salida_control_impl(p_observacion_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Control no encontrado o sin permiso' USING ERRCODE = '42501';
  END IF;

  -- Sin control previo no hay caída que atribuir. Declarar una causa acá sería
  -- afirmar sobre una diferencia que no existe.
  IF v_ctx.cantidad_previa IS NULL THEN
    RAISE EXCEPTION 'El control no tiene uno previo contra el cual comparar'
      USING ERRCODE = '22023';
  END IF;

  v_unidades := CASE
    WHEN p_respuesta = 'venta' THEN 0
    WHEN p_respuesta = 'no_declarado' THEN NULL
    ELSE GREATEST(v_ctx.bajada, 0)
  END;

  -- Una causa distinta de la venta exige que haya habido una caída real.
  IF p_respuesta NOT IN ('venta', 'no_declarado') AND COALESCE(v_unidades, 0) <= 0 THEN
    RAISE EXCEPTION 'No hubo caída de stock que atribuir a %', p_respuesta
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.vencimiento_observaciones
     SET no_venta_respuesta     = p_respuesta,
         unidades_no_venta      = v_unidades,
         no_venta_declarada_at  = now(),
         no_venta_declarada_por = v_uid
   WHERE id = p_observacion_id;

  RETURN v_unidades;
END;
$function$;

CREATE OR REPLACE FUNCTION public.declarar_salida_no_venta(
  p_observacion_id bigint,
  p_respuesta      text
)
RETURNS numeric
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.declarar_salida_no_venta_impl(p_observacion_id, p_respuesta);
$$;

REVOKE ALL ON FUNCTION noven_private.declarar_salida_no_venta_impl(bigint, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.declarar_salida_no_venta_impl(bigint, text) TO authenticated;
REVOKE ALL ON FUNCTION public.declarar_salida_no_venta(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.declarar_salida_no_venta(bigint, text) TO authenticated;
