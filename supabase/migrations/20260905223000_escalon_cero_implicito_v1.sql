-- =============================================================================
-- NOVEN · EL ESCALÓN CERO IMPLÍCITO
--
-- EL DEFECTO
--
-- `instrumentar_sugerencia_rag_impl` calculaba `escalones_aplicados` como la
-- diferencia entre el escalón del descuento anterior y el del nuevo, y devolvía
-- NULL cuando no había intervención anterior:
--
--     CASE WHEN v_esc_desde IS NULL OR v_esc_hasta IS NULL THEN NULL ...
--
-- Que no haya intervención anterior NO es ausencia de escalón: es un escalón
-- cero implícito. El producto estaba sin descuento. Saltar de ahí al primer
-- escalón de la escala es un escalón aplicado, exactamente igual que pasar de
-- 20 a 30.
--
-- CUÁNTO SE PERDÍA, MEDIDO EN PRODUCCIÓN EL 2026-09-05
--
--   intervenciones que son la primera de su vencimiento   14 de 17
--   intervenciones posteriores a otra                      3
--
-- El 82% quedaba en NULL. Un promedio de escalones aplicados no habría
-- promediado las intervenciones: habría promediado las tres que tuvieron una
-- antes.
--
-- Y EL PRIMER DESCUENTO CASI NUNCA ES EL PRIMER ESCALÓN. Contra la escala
-- vigente de ORG001 (1→20, 2→30, 3→50, 4→70), esas 14 primeras se reparten:
--
--   20 %  ·  2 casos  ·  1 escalón desde cero
--   30 %  ·  6 casos  ·  2 escalones
--   50 %  ·  5 casos  ·  3 escalones
--   60 %  ·  1 caso   ·  no pertenece a la escala vigente
--
-- Sólo 2 de 14 arrancan en el primer escalón. Asumir "1" para toda primera
-- intervención habría subcontado en 12 de 14 casos. Por eso el cálculo es
-- `escalon_hasta - 0`, no la constante 1.
--
-- TRES SITUACIONES QUE NO SON LA MISMA, Y NO PUEDEN COMPARTIR VALOR
--
-- La regla de `ai/rules.md`: cuando un fallo o un caso raro produce el mismo
-- valor que una ausencia legítima, hay que separarlos antes de que alguien los
-- promedie juntos. Acá había TRES situaciones colapsadas en un solo NULL:
--
--   estado NULL              nadie instrumentó esta intervención. Son las 17
--                            filas anteriores a la reparación del grant (D-7):
--                            sin evidencia, que no es lo mismo que sin salto.
--   'medido'                 hay escalón de partida y de llegada. El número
--                            en `escalones_aplicados` significa algo.
--   'fuera_de_escala'        la organización TIENE escala y este porcentaje no
--                            está en ella. Es el 60% del histórico, de la
--                            escala anterior. Se excluye del promedio SABIENDO
--                            POR QUÉ se excluye.
--   'sin_escala'             la organización no tiene escala configurada. No
--                            es que el porcentaje esté fuera: es que no hay
--                            contra qué medirlo.
--
-- Las dos últimas se separan a propósito. Colapsarlas diría "este descuento es
-- raro" cuando lo que pasa es que falta configurar la organización — el mismo
-- error que D-8, donde un fallo de lectura se disfrazaba de configuración
-- ausente. Acá el riesgo es el inverso y la cura es la misma: un estado por
-- situación.
--
-- NO SE INTERPOLA NI SE REDONDEA AL VECINO. Tomar el escalón más cercano o el
-- inmediato inferior convertiría "no sé" en un número que después nadie
-- distingue de una medición real.
--
-- NO SE RECALCULA NADA HACIA ATRÁS. Las 17 intervenciones previas nunca se
-- instrumentaron; siguen con estado NULL, que es la verdad. D-7 sigue en pie.
--
-- NO SE EDITA LA MIGRACIÓN APLICADA: ésta es nueva y reemplaza la función.
-- =============================================================================

-- --- 1. El estado, separado del número --------------------------------------

ALTER TABLE public.intervenciones_rag
  ADD COLUMN IF NOT EXISTS escalones_estado text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.intervenciones_rag'::regclass
      AND conname = 'intervenciones_rag_escalones_estado_check'
  ) THEN
    ALTER TABLE public.intervenciones_rag
      ADD CONSTRAINT intervenciones_rag_escalones_estado_check
      CHECK (
        (escalones_estado IS NULL AND escalones_aplicados IS NULL)
        OR (escalones_estado = 'medido' AND escalones_aplicados IS NOT NULL)
        OR (escalones_estado IN ('fuera_de_escala', 'sin_escala')
            AND escalones_aplicados IS NULL)
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.intervenciones_rag.escalones_estado IS
  'Por qué escalones_aplicados vale lo que vale: NULL = no se instrumentó (anterior a la reparación de D-7); medido = el número es una medición; fuera_de_escala = la organización tiene escala y este porcentaje no está en ella, excluir del promedio; sin_escala = la organización no tiene escala configurada.';

COMMENT ON COLUMN public.intervenciones_rag.escalones_aplicados IS
  'Escalones que subió la intervención, contando el escalón cero implícito: sin intervención previa el producto estaba sin descuento, así que llegar al escalón N son N escalones. Sólo tiene sentido cuando escalones_estado = medido.';

-- --- 2. El cálculo ----------------------------------------------------------

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
  -- y eso es un punto de partida conocido —el escalón cero— no un dato que
  -- falta. Ésta es la línea que antes devolvía NULL para el 82% de los casos.
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

  IF NOT v_hay_escala THEN
    -- No hay contra qué medir. Distinto de un porcentaje raro.
    v_aplicados := NULL;
    v_estado    := 'sin_escala';
  ELSIF v_esc_desde IS NULL OR v_esc_hasta IS NULL THEN
    -- Hay escala y alguna de las dos puntas no está en ella. El 60% del
    -- histórico es de la escala anterior y cae acá.
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

-- El wrapper no cambia de firma y conserva su ACL, pero el REVOKE/GRANT se
-- repite porque `CREATE OR REPLACE FUNCTION` sobre la implementación no altera
-- sus permisos y dejarlo escrito hace explícito el patrón que #162 reparó: un
-- wrapper SECURITY INVOKER corre con los privilegios de quien llama.
REVOKE ALL ON FUNCTION noven_private.instrumentar_sugerencia_rag_impl(uuid, numeric, smallint, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.instrumentar_sugerencia_rag_impl(uuid, numeric, smallint, text)
  TO authenticated;
