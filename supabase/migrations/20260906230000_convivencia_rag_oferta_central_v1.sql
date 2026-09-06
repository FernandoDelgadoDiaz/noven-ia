-- =============================================================================
-- NOVEN · BLOQUE C1 · CONVIVENCIA DE RAG Y OFERTA CENTRAL
--
-- LA OPERACIÓN REAL. La oferta central llega desde la cadena y la sucursal no la
-- decide. Si no alcanza, el gerente agrega un RAG encima: los dos precios están
-- vigentes al mismo tiempo en la góndola. Hoy el esquema lo prohíbe.
--
-- LO QUE HABÍA, Y POR QUÉ NO ALCANZA
--
-- `intervenciones_rag_un_vigente_por_vencimiento_uidx` es UNIQUE (vencimiento_id)
-- WHERE finalizado_at IS NULL — por vencimiento SOLO, desde el 2026-08-29. Con
-- ese índice no puede haber dos intervenciones vivas, sean del tipo que sean.
--
-- EL DEFECTO QUE EL ÍNDICE ESTABA TAPANDO, y que hay que arreglar ANTES de
-- levantarlo: `registrar_intervencion_rag_invoker_v1` finaliza TODAS las vivas
-- del vencimiento sin filtrar por tipo. Mientras el índice garantizaba que había
-- como mucho una, daba igual. Levantándolo sin tocar esa función, PONER UN RAG
-- ENCIMA DE UNA OFERTA CENTRAL LA CERRARÍA EN SILENCIO marcándola "reemplazado"
-- —justo el caso que la convivencia existe para permitir— y sin ningún síntoma.
--
-- Por eso el índice y los caminos de escritura van en la MISMA migración: dejar
-- el índice levantado un solo deploy sin las funciones acotadas abre esa ventana.
--
-- IMPACTO HOY: CERO. No existe ninguna intervención con tipo distinto de 'rag'
-- —las crea el bloque C2— así que ninguna consulta cambia de resultado. Es el
-- mismo perfil que el descuento no-venta del bloque B: seguro de aplicar y
-- peligroso de verificar, porque un error acá no da síntoma hasta que exista la
-- primera oferta central. Los contratos lo ejercitan con casos provocados.
--
-- LO QUE C1 NO HACE: no crea ofertas centrales, no toca la UI y no agrega la
-- RPC para declararlas. Eso es C2.
-- =============================================================================

-- --- 1. El invariante: una viva POR TIPO, no una por vencimiento -------------
--
-- Verificado antes de escribir esto: cero vencimientos con dos vivas del mismo
-- tipo, así que el índice nuevo se crea sin conflicto. Si alguna fila lo
-- violara, la migración fallaría acá y no dejaría el esquema a medias.
--
-- Se baja y se sube en la misma migración —que es una transacción— para que no
-- exista ningún instante sin invariante de unicidad.

DROP INDEX IF EXISTS public.intervenciones_rag_un_vigente_por_vencimiento_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS intervenciones_rag_un_vigente_por_tipo_uidx
  ON public.intervenciones_rag (vencimiento_id, tipo)
  WHERE finalizado_at IS NULL;

COMMENT ON INDEX public.intervenciones_rag_un_vigente_por_tipo_uidx IS
  'Una intervención viva por vencimiento Y POR TIPO: un RAG y una oferta central pueden convivir —los dos precios están en góndola— pero no dos RAG ni dos ofertas centrales.';

-- --- 2. Un RAG nuevo reemplaza al RAG anterior, no a la oferta central -------

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

  -- EL FILTRO POR TIPO ES EL ARREGLO. Sin `AND tipo = 'rag'` este UPDATE cierra
  -- también la oferta central vigente y la marca "reemplazado" — un cierre
  -- silencioso del caso que la convivencia existe para permitir.
  UPDATE public.intervenciones_rag
  SET
    finalizado_at = now(),
    finalizado_por = v_uid,
    motivo_finalizacion = 'reemplazado',
    nota_finalizacion = NULL
  WHERE vencimiento_id = p_vencimiento_id
    AND finalizado_at IS NULL
    AND tipo = 'rag';

  INSERT INTO public.intervenciones_rag(
    organizacion_id, sucursal_id, producto_id, vencimiento_id, usuario_id,
    tipo, porcentaje_descuento, cantidad_comprometida_al_aplicar,
    vmd_glaciar_al_aplicar, nota
  )
  VALUES(
    v_org, v_sucursal, v_producto, p_vencimiento_id, v_uid,
    'rag', p_porcentaje_descuento, v_cantidad, v_vmd, NULLIF(btrim(p_nota), '')
  )
  RETURNING id INTO v_rag_id;

  RETURN v_rag_id;
END;
$function$;

-- --- 3. La instrumentación mide el RAG, no la oferta central -----------------
--
-- Toma "la viva" del vencimiento. Con convivencia eso puede ser la oferta
-- central, y entonces la sugerencia de escalones —que sólo aplica al RAG— se
-- escribiría sobre la fila equivocada. Se acota a tipo='rag'.
--
-- La rama `no_aplica` del bloque A queda de todos modos, para el caso en que C2
-- instrumente una oferta central explícitamente.

CREATE OR REPLACE FUNCTION noven_private.instrumentar_sugerencia_rag_impl(
  p_vencimiento_id      uuid,
  p_cobertura           numeric,
  p_escalones_sugeridos smallint,
  p_origen              text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid        uuid := (SELECT auth.uid());
  v_rag        public.intervenciones_rag%ROWTYPE;
  v_anterior   numeric;
  v_esc_desde  smallint;
  v_esc_hasta  smallint;
  v_hay_escala boolean;
  v_aplicados  smallint;
  v_estado     text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_origen IS NULL OR p_origen NOT IN ('sugerida_aceptada', 'sugerida_rechazada', 'manual') THEN
    RAISE EXCEPTION 'Origen de sugerencia invalido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_rag
  FROM public.intervenciones_rag r
  WHERE r.vencimiento_id = p_vencimiento_id
    AND r.finalizado_at IS NULL
    AND r.tipo = 'rag'
  ORDER BY r.aplicado_at DESC, r.created_at DESC, r.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(v_rag.sucursal_id, v_rag.producto_id) THEN
    RAISE EXCEPTION 'Sin permiso sobre este producto' USING ERRCODE = '42501';
  END IF;

  IF v_rag.origen_sugerencia IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT r.porcentaje_descuento INTO v_anterior
  FROM public.intervenciones_rag r
  WHERE r.vencimiento_id = p_vencimiento_id
    AND r.tipo = 'rag'
    AND r.id <> v_rag.id
  ORDER BY r.aplicado_at DESC, r.created_at DESC, r.id DESC
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1 FROM public.rag_escala_descuento e
    WHERE e.organizacion_id = v_rag.organizacion_id
  ) INTO v_hay_escala;

  IF v_anterior IS NULL THEN
    v_esc_desde := 0;
  ELSE
    SELECT e.escalon INTO v_esc_desde
    FROM public.rag_escala_descuento e
    WHERE e.organizacion_id = v_rag.organizacion_id
      AND e.porcentaje = v_anterior;
  END IF;

  SELECT e.escalon INTO v_esc_hasta
  FROM public.rag_escala_descuento e
  WHERE e.organizacion_id = v_rag.organizacion_id
    AND e.porcentaje = v_rag.porcentaje_descuento;

  IF v_rag.tipo <> 'rag' THEN
    v_aplicados := NULL;
    v_estado    := 'no_aplica';
  ELSIF NOT v_hay_escala THEN
    v_aplicados := NULL;
    v_estado    := 'sin_escala';
  ELSIF v_esc_desde IS NULL OR v_esc_hasta IS NULL THEN
    v_aplicados := NULL;
    v_estado    := 'fuera_de_escala';
  ELSE
    v_aplicados := (v_esc_hasta - v_esc_desde)::smallint;
    v_estado    := 'medido';
  END IF;

  UPDATE public.intervenciones_rag
  SET cobertura_al_sugerir = p_cobertura,
      escalones_sugeridos  = p_escalones_sugeridos,
      escalones_aplicados  = v_aplicados,
      escalones_estado     = v_estado,
      origen_sugerencia    = p_origen
  WHERE id = v_rag.id;
END;
$function$;

REVOKE ALL ON FUNCTION noven_private.instrumentar_sugerencia_rag_impl(uuid, numeric, smallint, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.instrumentar_sugerencia_rag_impl(uuid, numeric, smallint, text)
  TO authenticated;

-- --- 4. Los tramos se cierran DENTRO de su tipo ------------------------------
--
-- El `lead()` particionado sólo por vencimiento hacía que abrir una oferta
-- central cerrara el tramo del RAG. Particionando por (vencimiento, tipo), cada
-- tipo tiene su propia secuencia y los dos pueden estar abiertos a la vez.
--
-- `superpuesto` cambia de sentido y se vuelve más útil: ya no marca "otro tramo
-- del mismo tipo arrancó encima" —eso ahora lo impide el índice— sino
-- CONVIVENCIA REAL: este tramo comparte ventana con otro de OTRO tipo. Es el
-- caso 5 del relevamiento, y es la marca que le dice al motor histórico que la
-- medición de esa ventana NO ES ATRIBUIBLE a una sola intervención.

CREATE OR REPLACE VIEW public.v_intervencion_tramos AS
WITH ordenadas AS (
  SELECT
    r.id, r.vencimiento_id, r.organizacion_id, r.sucursal_id, r.producto_id,
    r.usuario_id, r.tipo, r.porcentaje_descuento,
    r.cantidad_comprometida_al_aplicar, r.aplicado_at, r.finalizado_at,
    r.motivo_finalizacion,
    r.cobertura_al_sugerir, r.escalones_sugeridos, r.escalones_aplicados,
    r.escalones_estado, r.origen_sugerencia,
    lead(r.aplicado_at) OVER w AS siguiente_inicio,
    row_number()        OVER w AS numero_tramo,
    count(*) OVER (PARTITION BY r.vencimiento_id, r.tipo) AS tramos_del_vencimiento
  FROM public.intervenciones_rag r
  WINDOW w AS (PARTITION BY r.vencimiento_id, r.tipo
               ORDER BY r.aplicado_at, r.created_at, r.id)
),
con_fin AS (
  SELECT o.*, LEAST(o.finalizado_at, o.siguiente_inicio) AS fin FROM ordenadas o
)
SELECT
  c.id                                AS intervencion_id,
  c.vencimiento_id,
  c.organizacion_id,
  c.sucursal_id,
  c.producto_id,
  c.usuario_id,
  c.tipo,
  c.porcentaje_descuento,
  c.cantidad_comprometida_al_aplicar  AS cantidad_al_iniciar,
  c.numero_tramo,
  c.tramos_del_vencimiento,
  c.aplicado_at                       AS inicio,
  c.fin,
  (c.fin IS NULL)                     AS abierto,
  -- CONVIVENCIA: existe un tramo de OTRO tipo cuya ventana se solapa con ésta.
  -- Dos intervalos [a1,a2) y [b1,b2) se solapan si a1 < b2 y b1 < a2. Un tramo
  -- abierto no tiene fin, así que su extremo es "infinito" a estos efectos —
  -- `coalesce` a 'infinity' evita tratar el NULL como "no se solapa", que sería
  -- justo al revés de la verdad.
  EXISTS (
    SELECT 1 FROM con_fin o2
    WHERE o2.vencimiento_id = c.vencimiento_id
      AND o2.tipo <> c.tipo
      AND c.aplicado_at  < COALESCE(o2.fin, 'infinity'::timestamptz)
      AND o2.aplicado_at < COALESCE(c.fin,  'infinity'::timestamptz)
  )                                   AS superpuesto,
  c.finalizado_at,
  c.motivo_finalizacion,
  c.cobertura_al_sugerir,
  c.escalones_sugeridos,
  c.escalones_aplicados,
  c.escalones_estado,
  c.origen_sugerencia
FROM con_fin c;

-- --- 5. El seguimiento deja de ocultar el segundo tramo ----------------------
--
-- La vista tomaba EL tramo abierto con `LIMIT 1`. Con convivencia hay dos y
-- elegía uno callando el otro: la tarjeta no podría mostrar los dos aunque
-- quisiera, porque la vista sólo entregaba uno.
--
-- QUÉ MIDE CUANDO CONVIVEN: UNA sola cobertura, la del EFECTO COMBINADO,
-- medida desde el arranque del PRIMER tramo abierto. No dos coberturas: los dos
-- precios actúan sobre el mismo stock al mismo tiempo y no hay forma de separar
-- qué unidad se fue por cuál. Dos números presentados por separado serían dos
-- cifras que no se pueden calcular, exhibidas como si se pudiera.
--
-- Y se marca `medicion_atribuible = false`. La medición sirve para el operador
-- —quiere saber si el producto se mueve— y NO sirve para el histórico, que
-- necesita atribuir el efecto a una intervención. Registrar sí, atribuir no.
--
-- `rag_porcentaje` sigue siendo el del RAG y no el de la oferta central, que no
-- tiene porcentaje propio. Con sólo una oferta central abierta queda NULL: hoy
-- el motor leería eso como `sin_rag` —"no hay intervención"— habiendo una. Ese
-- mapeo es del bloque C2; acá no puede dispararse porque nada crea ofertas
-- centrales todavía.
--
-- IMPACTO HOY: CERO. Con un solo tramo abierto, "el primero que abrió" es el
-- mismo que "el único", y las tres columnas nuevas dan 1 / false / true.

CREATE OR REPLACE VIEW public.v_seguimiento_rag_actual AS
SELECT
  v.id                                   AS vencimiento_id,
  p.organizacion_id,
  v.sucursal_id,
  v.producto_id,
  p.descripcion,
  p.familia_id,
  f.sector_id,
  s.nombre                               AS sector_nombre,
  s.dias_donacion,
  v.fecha_vencimiento,
  v.fecha_vencimiento - op.hoy           AS dias_hasta_vencimiento,
  GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0) AS dias_comerciales_restantes,
  ps.venta_media_diaria                  AS vmd_glaciar_actual,
  ps.fecha_ultima_importacion,
  tramo.intervencion_id                  AS rag_id,
  rag.porcentaje_descuento               AS rag_porcentaje,
  tramo.inicio                           AS rag_aplicado_at,
  tramo.cantidad_al_iniciar              AS cantidad_base_rag,
  r.vmd_glaciar_al_aplicar,
  obs.id                                 AS observacion_id,
  obs.observada_at,
  obs.cantidad_comprometida              AS cantidad_observada,
  COALESCE(obs.cantidad_comprometida, v.cantidad::numeric) AS cantidad_actual_estimacion,
  CASE
    WHEN tramo.intervencion_id IS NULL OR obs.id IS NULL THEN NULL::numeric
    ELSE GREATEST(
      GREATEST(tramo.cantidad_al_iniciar - obs.cantidad_comprometida, 0::numeric)
        - nv.unidades_no_venta, 0::numeric)
  END                                    AS unidades_vendidas_observadas,
  CASE
    WHEN tramo.intervencion_id IS NULL OR obs.id IS NULL OR obs.observada_at <= tramo.inicio THEN NULL::numeric
    ELSE EXTRACT(epoch FROM obs.observada_at - tramo.inicio) / 86400.0
  END                                    AS dias_observados,
  CASE
    WHEN tramo.intervencion_id IS NULL OR obs.id IS NULL OR obs.observada_at <= tramo.inicio THEN NULL::numeric
    ELSE GREATEST(
           GREATEST(tramo.cantidad_al_iniciar - obs.cantidad_comprometida, 0::numeric)
             - nv.unidades_no_venta, 0::numeric)
         / NULLIF(EXTRACT(epoch FROM obs.observada_at - tramo.inicio) / 86400.0, 0::numeric)
  END                                    AS velocidad_observada,
  CASE
    WHEN GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0) <= 0 THEN NULL::numeric
    ELSE COALESCE(obs.cantidad_comprometida, v.cantidad::numeric)
         / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0)::numeric
  END                                    AS velocidad_necesaria,
  CASE
    WHEN (v.fecha_vencimiento - op.hoy) <= 0 THEN 'decomiso'::text
    WHEN (v.fecha_vencimiento - op.hoy) <= s.dias_donacion THEN 'donacion'::text
    WHEN tramo.intervencion_id IS NULL THEN 'sin_rag'::text
    WHEN obs.id IS NULL OR obs.observada_at <= tramo.inicio THEN 'pendiente_control_operador'::text
    WHEN obs.cantidad_comprometida > tramo.cantidad_al_iniciar THEN 'dato_a_revisar'::text
    WHEN obs.cantidad_comprometida = 0::numeric THEN 'efectivo'::text
    WHEN NOT (
      (EXTRACT(epoch FROM obs.observada_at - tramo.inicio) / 86400.0)
      * COALESCE(
          CASE
            WHEN GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0) <= 0 THEN NULL::numeric
            ELSE COALESCE(obs.cantidad_comprometida, v.cantidad::numeric)
                 / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0)::numeric
          END, 0::numeric) >= 1
    ) THEN 'ventana_insuficiente'::text
    WHEN obs.cantidad_comprometida = tramo.cantidad_al_iniciar THEN 'sin_movimiento'::text
    WHEN (
      GREATEST(GREATEST(tramo.cantidad_al_iniciar - obs.cantidad_comprometida, 0::numeric)
               - nv.unidades_no_venta, 0::numeric)
      / NULLIF(EXTRACT(epoch FROM obs.observada_at - tramo.inicio) / 86400.0, 0::numeric)
    ) >= COALESCE(
           NULLIF(tramo.cantidad_al_iniciar
                  / NULLIF(GREATEST(v.fecha_vencimiento
                                    - (tramo.inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
                                    - s.dias_donacion, 0), 0)::numeric, 0::numeric),
           obs.cantidad_comprometida
             / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 1)::numeric)
    THEN 'efectivo'::text
    ELSE 'insuficiente'::text
  END                                    AS estado_seguimiento_rag,
  CASE
    WHEN tramo.intervencion_id IS NULL THEN NULL::numeric
    WHEN GREATEST(v.fecha_vencimiento
                  - (tramo.inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
                  - s.dias_donacion, 0) <= 0 THEN NULL::numeric
    ELSE tramo.cantidad_al_iniciar
         / GREATEST(v.fecha_vencimiento
                    - (tramo.inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
                    - s.dias_donacion, 0)::numeric
  END                                    AS velocidad_necesaria_al_aplicar,
  CASE
    WHEN tramo.intervencion_id IS NULL OR obs.id IS NULL OR obs.observada_at <= tramo.inicio THEN NULL::numeric
    WHEN GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0) <= 0 THEN NULL::numeric
    ELSE GREATEST(GREATEST(tramo.cantidad_al_iniciar - obs.cantidad_comprometida, 0::numeric)
                  - nv.unidades_no_venta, 0::numeric)
         / NULLIF(EXTRACT(epoch FROM obs.observada_at - tramo.inicio) / 86400.0, 0::numeric)
         / NULLIF(COALESCE(obs.cantidad_comprometida, v.cantidad::numeric)
                  / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0)::numeric, 0::numeric)
  END                                    AS cobertura,
  CASE
    WHEN tramo.intervencion_id IS NULL THEN NULL::numeric
    ELSE EXTRACT(epoch FROM op.ahora - tramo.inicio) / 86400.0
  END                                    AS dias_desde_ultimo_rag,
  CASE
    WHEN tramo.intervencion_id IS NULL OR obs.id IS NULL THEN NULL::numeric
    ELSE nv.unidades_no_venta
  END                                    AS unidades_no_venta_descontadas,
  CASE
    WHEN tramo.intervencion_id IS NULL OR obs.id IS NULL OR obs.observada_at <= tramo.inicio THEN NULL::boolean
    ELSE (EXTRACT(epoch FROM obs.observada_at - tramo.inicio) / 86400.0)
         * COALESCE(
             CASE
               WHEN GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0) <= 0 THEN NULL::numeric
               ELSE COALESCE(obs.cantidad_comprometida, v.cantidad::numeric)
                    / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0)::numeric
             END, 0::numeric) >= 1
  END                                    AS ventana_observable,

  -- --- COLUMNAS NUEVAS, AL FINAL ---------------------------------------------
  abiertas.cuantas                       AS intervenciones_abiertas,
  (oc.intervencion_id IS NOT NULL)       AS hay_oferta_central,
  -- Con más de una intervención viva el número mide el efecto combinado y NO se
  -- puede atribuir. El operador lo usa igual; el histórico tiene que excluirlo.
  (abiertas.cuantas <= 1)                AS medicion_atribuible
FROM vencimientos v
  JOIN productos p ON p.id = v.producto_id
  JOIN producto_sucursal ps
    ON ps.producto_id = v.producto_id AND ps.sucursal_id = v.sucursal_id
   AND ps.organizacion_id = p.organizacion_id
  LEFT JOIN familias f ON f.id = p.familia_id AND f.organizacion_id = p.organizacion_id
  LEFT JOIN sectores s ON s.id = f.sector_id AND s.organizacion_id = p.organizacion_id
  CROSS JOIN LATERAL (
    SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy, now() AS ahora
  ) op
  -- LA VENTANA ARRANCA EN EL PRIMER TRAMO ABIERTO, no en el último. Con dos
  -- precios vigentes el efecto que se observa empezó cuando empezó el primero;
  -- medir desde el segundo descartaría los días en que el primero ya actuaba.
  LEFT JOIN LATERAL (
    SELECT t.intervencion_id, t.inicio, t.cantidad_al_iniciar
    FROM public.v_intervencion_tramos t
    WHERE t.vencimiento_id = v.id AND t.abierto
    ORDER BY t.inicio ASC
    LIMIT 1
  ) tramo ON true
  LEFT JOIN LATERAL (
    SELECT t.porcentaje_descuento
    FROM public.v_intervencion_tramos t
    WHERE t.vencimiento_id = v.id AND t.abierto AND t.tipo = 'rag'
    ORDER BY t.inicio DESC
    LIMIT 1
  ) rag ON true
  LEFT JOIN LATERAL (
    SELECT t.intervencion_id
    FROM public.v_intervencion_tramos t
    WHERE t.vencimiento_id = v.id AND t.abierto AND t.tipo = 'oferta_central'
    LIMIT 1
  ) oc ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::smallint AS cuantas
    FROM public.v_intervencion_tramos t
    WHERE t.vencimiento_id = v.id AND t.abierto
  ) abiertas ON true
  LEFT JOIN intervenciones_rag r ON r.id = tramo.intervencion_id
  LEFT JOIN LATERAL (
    SELECT o.id, o.cantidad_comprometida, o.observada_at
    FROM vencimiento_observaciones o
    WHERE o.vencimiento_id = v.id
      AND tramo.intervencion_id IS NOT NULL
      AND o.observada_at > tramo.inicio
    ORDER BY o.observada_at DESC, o.id DESC
    LIMIT 1
  ) obs ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(x.unidades_no_venta), 0::numeric) AS unidades_no_venta
    FROM vencimiento_observaciones x
    WHERE x.vencimiento_id = v.id
      AND tramo.intervencion_id IS NOT NULL
      AND obs.id IS NOT NULL
      AND x.observada_at > tramo.inicio
      AND x.observada_at <= obs.observada_at
      AND x.unidades_no_venta IS NOT NULL
  ) nv ON true
WHERE v.activo = true AND s.dias_donacion IS NOT NULL;

-- CREATE OR REPLACE VIEW no conserva las reloptions: sin esto la vista evaluaría
-- RLS como su dueño. Es la lección del bloque B, aplicada sin repetir el error.
ALTER VIEW public.v_seguimiento_rag_actual SET (security_invoker = true);
