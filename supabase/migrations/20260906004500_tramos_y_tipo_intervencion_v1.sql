-- =============================================================================
-- NOVEN · BLOQUE A · EL TRAMO Y EL TIPO DE INTERVENCIÓN
--
-- QUÉ RESUELVE
--
-- 1. Una intervención no tiene FIN. La vista de seguimiento sólo puede medir la
--    última intervención viva de cada vencimiento; todo lo anterior desaparece.
--    Medido en producción: de 17 tramos, 13 son medibles y 4 —los cerrados— son
--    INVISIBLES, y los cuatro tienen observaciones adentro. La evidencia existe
--    y el modelo no la alcanza.
--
-- 2. Una oferta centralizada no tiene DÓNDE VIVIR. Hoy sólo existe como
--    `motivo_finalizacion = 'oferta_centralizada'` —hay un caso real—, o sea
--    como la forma de TERMINAR un RAG. Un producto que entra en oferta central
--    sin haber tenido un RAG antes no se puede registrar. Es un estado que sólo
--    se alcanza de refilón.
--
-- LO QUE ESTA MIGRACIÓN NO HACE, Y ES DELIBERADO
--
-- No cambia ninguna cifra que el operador vea hoy. No toca
-- `v_seguimiento_rag_actual`, que es de donde salen los once campos de la
-- tarjeta. Medir cada tramo contra su propia ventana —y descontar las salidas
-- no-venta de 5a— es el bloque B, y ese sí mueve números visibles.
--
-- POR QUÉ UNA VISTA Y NO UNA TABLA DE TRAMOS
--
-- Un tramo es enteramente derivable de lo que ya está guardado:
--
--     inicio = aplicado_at
--     fin    = finalizado_at, o el inicio del tramo siguiente
--
-- Una tabla mantenida por trigger introduciría un SEGUNDO CAMINO DE ESCRITURA
-- que puede fallar sin síntoma, con nadie leyéndolo hasta que llegue B. Eso es
-- literalmente D-7. Una derivación no puede desincronizarse: es la misma verdad
-- leída de otra forma. Además no hay backfill que hacer —los 17 tramos existen
-- desde el momento en que la vista existe— ni migración de filas.
--
-- OJO CON EL NOMBRE: ya hay una `v_resultado_vencimiento_tramos` en el esquema,
-- con OTRA granularidad —intervalos entre eventos consecutivos, y sólo para
-- vencimientos que llegaron a una acción terminal—. Devuelve 59 filas y no la
-- lee nadie en `src/` ni en `netlify/`. No se toca. La de acá se llama
-- `v_intervencion_tramos` y su unidad es LA INTERVENCIÓN, no el intervalo entre
-- eventos.
-- =============================================================================

-- --- 1. El tipo de intervención ---------------------------------------------
--
-- `rag` es el default y las 17 filas existentes lo son: todas nacieron como
-- rebaja. No hay nada que migrar.

ALTER TABLE public.intervenciones_rag
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'rag';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.intervenciones_rag'::regclass
      AND conname = 'intervenciones_rag_tipo_check'
  ) THEN
    ALTER TABLE public.intervenciones_rag
      ADD CONSTRAINT intervenciones_rag_tipo_check
      CHECK (tipo IN ('rag', 'oferta_central'));
  END IF;
END
$$;

-- --- 2. El porcentaje pertenece al RAG, no a toda intervención ---------------
--
-- Una oferta central NO tiene porcentaje de descuento: el precio lo decide
-- otro. Ponerle 0 sería afirmar "descuento cero", que es falso y además
-- rompería el CHECK existente (`porcentaje > 0`). Ponerle cualquier otro número
-- sería inventarlo. Va NULL, y el CHECK condicionado al tipo impide las dos
-- combinaciones sin sentido: un RAG sin porcentaje y una oferta central con uno.

ALTER TABLE public.intervenciones_rag
  ALTER COLUMN porcentaje_descuento DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.intervenciones_rag'::regclass
      AND conname = 'intervenciones_rag_porcentaje_segun_tipo_check'
  ) THEN
    ALTER TABLE public.intervenciones_rag
      ADD CONSTRAINT intervenciones_rag_porcentaje_segun_tipo_check
      CHECK (
        (tipo = 'rag'            AND porcentaje_descuento IS NOT NULL)
        OR (tipo = 'oferta_central' AND porcentaje_descuento IS NULL)
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.intervenciones_rag.tipo IS
  'Qué clase de intervención es: rag (rebaja con porcentaje propio) u oferta_central (el precio lo decide la cadena; sin porcentaje). Antes una oferta central sólo existía como motivo_finalizacion de un RAG, así que no se podía declarar sin un RAG previo.';

COMMENT ON COLUMN public.intervenciones_rag.porcentaje_descuento IS
  'Porcentaje de la rebaja. Obligatorio cuando tipo = rag; NULL cuando tipo = oferta_central, porque el precio lo decide la cadena y un cero sería afirmar descuento cero.';

-- --- 3. Los escalones no aplican a una oferta central ------------------------
--
-- Una oferta central no sube ni baja escalones: no está en la escala de
-- descuentos porque no tiene porcentaje propio. Sin este estado, la
-- instrumentación la marcaría `fuera_de_escala` —que significa "hay escala y
-- este porcentaje no está en ella"— y el motor histórico leería como anomalía
-- lo que es una intervención de otra naturaleza.
--
-- Es la regla de `ai/rules.md` aplicada antes de que el caso exista: "no
-- aplica" y "es raro" son situaciones distintas y no pueden compartir valor.
-- Hoy no hay ninguna oferta central —las crea el bloque C—, así que esto no
-- cambia ninguna fila: cierra el hueco antes de que se pueda caer en él.

ALTER TABLE public.intervenciones_rag
  DROP CONSTRAINT IF EXISTS intervenciones_rag_escalones_estado_check;

ALTER TABLE public.intervenciones_rag
  ADD CONSTRAINT intervenciones_rag_escalones_estado_check
  CHECK (
    (escalones_estado IS NULL AND escalones_aplicados IS NULL)
    OR (escalones_estado = 'medido' AND escalones_aplicados IS NOT NULL)
    OR (escalones_estado IN ('fuera_de_escala', 'sin_escala', 'no_aplica')
        AND escalones_aplicados IS NULL)
  );

COMMENT ON COLUMN public.intervenciones_rag.escalones_estado IS
  'Por qué escalones_aplicados vale lo que vale: NULL = no se instrumentó (anterior a la reparación de D-7); medido = el número es una medición; fuera_de_escala = la organización tiene escala y este porcentaje no está en ella; sin_escala = la organización no tiene escala configurada; no_aplica = la intervención no es un RAG y no recorre la escala.';

-- --- 4. El tramo ------------------------------------------------------------
--
-- Una fila por intervención. El FIN es lo único que faltaba, y sale de dos
-- fuentes: la finalización explícita, o el arranque de la intervención
-- siguiente. `LEAST` ignora los NULL, así que devuelve la más temprana de las
-- dos que exista, y NULL sólo cuando no hay ninguna — que es el tramo abierto.
--
-- UN TRAMO ABIERTO NO TERMINA EN EL VENCIMIENTO. Se mide hasta la última
-- observación, que es lo que ya hace el seguimiento actual. Cerrarlo en la
-- fecha de vencimiento sería medir contra algo que todavía no pasó.
--
-- SUPERPUESTO: REGISTRAR SÍ, ATRIBUIR NO. Si la siguiente intervención arrancó
-- mientras ésta seguía viva, el tramo se corta en ese arranque Y queda marcado.
-- La marca existe para que B pueda excluirlo del cálculo SABIENDO POR QUÉ, igual
-- que `fuera_de_escala`. Hoy son cero casos en producción; el modelo lo soporta
-- igual, porque el primero que aparezca no puede romper la medición en silencio.
--
-- ESTA VISTA NO MIDE NADA. Define la ventana; medir contra ella es el bloque B.
-- Por eso no hay acá ninguna velocidad, ninguna cobertura y ninguna duración:
-- una duración ya obligaría a decidir contra qué instante se cierra un tramo
-- abierto, y esa decisión es de B.

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
    count(*) OVER (PARTITION BY r.vencimiento_id) AS tramos_del_vencimiento
  FROM public.intervenciones_rag r
  WINDOW w AS (PARTITION BY r.vencimiento_id ORDER BY r.aplicado_at, r.created_at, r.id)
)
SELECT
  o.id                                AS intervencion_id,
  o.vencimiento_id,
  o.organizacion_id,
  o.sucursal_id,
  o.producto_id,
  o.usuario_id,
  o.tipo,
  o.porcentaje_descuento,
  o.cantidad_comprometida_al_aplicar  AS cantidad_al_iniciar,
  o.numero_tramo,
  o.tramos_del_vencimiento,
  o.aplicado_at                       AS inicio,
  LEAST(o.finalizado_at, o.siguiente_inicio)              AS fin,
  (LEAST(o.finalizado_at, o.siguiente_inicio) IS NULL)    AS abierto,
  (o.siguiente_inicio IS NOT NULL
   AND (o.finalizado_at IS NULL OR o.finalizado_at > o.siguiente_inicio)) AS superpuesto,
  o.finalizado_at,
  o.motivo_finalizacion,
  o.cobertura_al_sugerir,
  o.escalones_sugeridos,
  o.escalones_aplicados,
  o.escalones_estado,
  o.origen_sugerencia
FROM ordenadas o;

COMMENT ON VIEW public.v_intervencion_tramos IS
  'Un tramo por intervención, con su inicio y su fin derivados. El fin es la finalización explícita o el arranque del tramo siguiente; NULL significa abierto. No mide nada: definir la ventana es de acá, medir contra ella es del bloque B. Distinta de v_resultado_vencimiento_tramos, cuya unidad es el intervalo entre eventos.';

-- `security_invoker` no es negociable: sin él la vista evalúa RLS como su dueño
-- y el aislamiento multitenant deja de existir para quien la consulte.
ALTER VIEW public.v_intervencion_tramos SET (security_invoker = true);

REVOKE ALL ON TABLE public.v_intervencion_tramos FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_intervencion_tramos TO authenticated;

-- --- 5. Que algo produzca `no_aplica` ---------------------------------------
--
-- Un estado permitido por el CHECK y que nadie escribe nunca es peor que no
-- tenerlo: parece cubierto y no lo está. La instrumentación tiene que
-- reconocer la oferta central y marcarla como lo que es.
--
-- Es la ÚNICA rama que cambia. El resto del cuerpo queda igual que en
-- `20260905223000`: el escalón cero, `fuera_de_escala` y `sin_escala` se
-- comportan idéntico, y ninguna fila existente cambia porque hoy no hay
-- ninguna intervención con tipo distinto de `rag`.

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
    AND r.id <> v_rag.id
  ORDER BY r.aplicado_at DESC, r.created_at DESC, r.id DESC
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1 FROM public.rag_escala_descuento e
    WHERE e.organizacion_id = v_rag.organizacion_id
  ) INTO v_hay_escala;

  -- EL ESCALÓN CERO. Sin intervención previa el producto estaba sin descuento,
  -- y eso es un punto de partida conocido, no un dato que falta.
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
    -- LA RAMA NUEVA. Una oferta central no recorre la escala: no tiene
    -- porcentaje propio. No es un porcentaje raro, es otra naturaleza.
    v_aplicados := NULL;
    v_estado    := 'no_aplica';
  ELSIF NOT v_hay_escala THEN
    v_aplicados := NULL;
    v_estado    := 'sin_escala';
  ELSIF v_esc_desde IS NULL OR v_esc_hasta IS NULL THEN
    v_aplicados := NULL;
    v_estado    := 'fuera_de_escala';
  ELSE
    -- Puede ser negativo: bajar de escalón también es un movimiento medido.
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

-- `CREATE OR REPLACE FUNCTION` conserva el ACL, así que esto es un no-op
-- deliberado: deja el patrón a la vista en el archivo donde se reemplaza la
-- función. Reemplazarla nunca repara un grant equivocado ni rompe uno correcto.
REVOKE ALL ON FUNCTION noven_private.instrumentar_sugerencia_rag_impl(uuid, numeric, smallint, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.instrumentar_sugerencia_rag_impl(uuid, numeric, smallint, text)
  TO authenticated;
