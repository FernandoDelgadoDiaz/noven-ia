-- =============================================================================
-- NOVEN · RAG · ESCALA, INSTRUMENTACIÓN Y COBERTURA V1
--
-- Esquema para el motor de reacción inmediata (Capa A). Sólo esquema: la lógica
-- de decisión vive en código determinístico y llega en un PR posterior.
--
-- Tres cosas, en orden de riesgo creciente:
--
--   1. `rag_escala_descuento`: la escala de porcentajes autorizados, POR
--      ORGANIZACIÓN. No es una constante del producto.
--   2. Cuatro columnas de instrumentación en `intervenciones_rag`.
--   3. Extensión de `v_seguimiento_rag_actual` con las magnitudes de cobertura
--      — y una CORRECCIÓN de comportamiento que se detalla abajo.
--
-- =============================================================================
-- ⚠️  CAMBIO DE COMPORTAMIENTO EN `estado_seguimiento_rag`
-- =============================================================================
--
-- Hasta esta migración, la vista juzgaba si un RAG funcionó comparando la
-- velocidad observada contra la velocidad necesaria DE HOY:
--
--     velocidad_observada >= cantidad_observada / dias_comerciales_restantes(hoy)
--
-- Eso sesga el histórico. La necesaria sube sola a medida que la ventana
-- comercial se achica, así que un RAG que durante su ventana venía cumpliendo
-- pasa a figurar como `insuficiente` sin que haya cambiado nada de su
-- desempeño. En seis meses, el histórico diría que casi todos los RAG fallaron.
--
-- Esta migración separa las dos preguntas, que son distintas:
--
--   · ¿el RAG funcionó?      → contra `velocidad_necesaria_al_aplicar`, la que
--                              regía cuando se aplicó y contra la que se lo
--                              fijó. Es la única comparación justa.
--   · ¿cuánto hay que subir? → contra `velocidad_necesaria` (la de hoy), porque
--                              la decisión de hoy se toma con la ventana de hoy.
--
-- QUÉ CAMBIA EN LA PRÁCTICA: casos que hoy figuran `insuficiente` sólo por el
-- paso del tiempo van a pasar a `efectivo`. Eso afecta al badge del Dashboard,
-- a `problemas-activos` y al push de escalamiento. Es el efecto buscado.
--
-- NO cambia: los umbrales 45/20, la política 2/10, `dias_donacion`, el Radar
-- Zonal, ni la detección de riesgo. No toca datos ni borra historia RAG.
-- =============================================================================

BEGIN;

-- --- 1. Escala de descuentos autorizados, por organización -------------------
--
-- La escala 10/20/…/70 es política de La Anónima, no una regla universal de
-- NoVen. Modelarla como constante del producto la volvería imposible de
-- cambiar para la organización siguiente sin tocar código.
--
-- Una organización sin escala cargada NO recibe sugerencias. Eso es
-- deliberado: `docs/RISK_AND_RAG_RULES_V1.md` §7 prohíbe inventar un
-- porcentaje sin evidencia suficiente, y una escala ausente es exactamente eso.
-- Nunca hay un default hardcodeado.

CREATE TABLE IF NOT EXISTS public.rag_escala_descuento (
  organizacion_id uuid NOT NULL
    REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  escalon         smallint NOT NULL,
  porcentaje      numeric  NOT NULL,
  creado_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rag_escala_descuento_pk PRIMARY KEY (organizacion_id, escalon),
  CONSTRAINT rag_escala_escalon_positivo CHECK (escalon >= 1),
  CONSTRAINT rag_escala_porcentaje_valido CHECK (porcentaje > 0 AND porcentaje <= 100),
  -- Un mismo porcentaje no puede ocupar dos escalones: haría ambiguo "subir uno".
  CONSTRAINT rag_escala_porcentaje_unico UNIQUE (organizacion_id, porcentaje)
);

COMMENT ON TABLE public.rag_escala_descuento IS
  'Escala de porcentajes RAG autorizados por organización. El motor de sugerencia nunca propone un valor fuera de esta escala. Sin filas para una organización, no sugiere.';

ALTER TABLE public.rag_escala_descuento ENABLE ROW LEVEL SECURITY;

-- Clase `lectura_tenant`: lectura acotada a la organización del usuario.
REVOKE ALL ON TABLE public.rag_escala_descuento FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.rag_escala_descuento TO authenticated;

CREATE POLICY rag_escala_descuento_select_scope
  ON public.rag_escala_descuento
  FOR SELECT
  TO authenticated
  USING (noven_private.tiene_acceso_organizacion(organizacion_id));

-- La escala NO se siembra desde esta migración, a propósito.
--
-- Un INSERT acá metería la política comercial de un retailer concreto dentro
-- del producto: todo deployment futuro lo correría e impondría la escala de La
-- Anónima a organizaciones que nunca la eligieron. Y una vez aplicada la
-- migración ya no se puede sacar sin borrar datos.
--
-- La escala de cada organización se carga como OPERACIÓN DE DATOS, acotada a
-- esa organización. Procedimiento en `docs/RISK_AND_RAG_RULES_V1.md`.

-- --- 2. Instrumentación por intervención ------------------------------------
--
-- Sin esto no se puede confrontar la regla contra lo que realmente pasó, que es
-- el insumo del motor histórico. Cuesta una migración chica ahora y seis meses
-- de evidencia perdida si se posterga.
--
-- Todas nullable a propósito: las 16 intervenciones históricas no tienen estos
-- datos, y ponerles un default sería afirmar algo que no sabemos. NULL acá
-- significa "no instrumentada", que es la verdad.

ALTER TABLE public.intervenciones_rag
  ADD COLUMN IF NOT EXISTS cobertura_al_sugerir numeric,
  ADD COLUMN IF NOT EXISTS escalones_sugeridos  smallint,
  ADD COLUMN IF NOT EXISTS escalones_aplicados  smallint,
  ADD COLUMN IF NOT EXISTS origen_sugerencia    text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'intervenciones_rag_origen_sugerencia_valido'
  ) THEN
    ALTER TABLE public.intervenciones_rag
      ADD CONSTRAINT intervenciones_rag_origen_sugerencia_valido
      CHECK (origen_sugerencia IS NULL OR origen_sugerencia IN (
        'sugerida_aceptada',   -- se aplicó exactamente el porcentaje sugerido
        'sugerida_rechazada',  -- había sugerencia y se eligió otro porcentaje
        'manual'               -- no había sugerencia vigente
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.intervenciones_rag.cobertura_al_sugerir IS
  'velocidad_observada / velocidad_necesaria al momento de emitir la sugerencia. NULL si la intervención no fue instrumentada.';
COMMENT ON COLUMN public.intervenciones_rag.escalones_sugeridos IS
  'Escalones que el motor propuso subir. NULL si no hubo sugerencia.';
COMMENT ON COLUMN public.intervenciones_rag.escalones_aplicados IS
  'Escalones que el usuario efectivamente subió. Puede diferir de los sugeridos.';
COMMENT ON COLUMN public.intervenciones_rag.origen_sugerencia IS
  'sugerida_aceptada | sugerida_rechazada | manual. NULL en intervenciones previas a la instrumentación.';

-- --- 2b. Escribir la instrumentación -----------------------------------------
--
-- Columnas que nadie llena son decoración. Esto las llena.
--
-- Va como RPC dedicada y ADITIVA en vez de extender
-- `registrar_control_vencimiento_dashboard`: agregarle parámetros con default
-- crearía una segunda función del mismo nombre y las llamadas existentes
-- pasarían a ser ambiguas, obligando a dropear la firma que hoy usa
-- producción. Una función nueva no toca nada de lo que ya funciona.
--
-- Sigue el patrón del repositorio: wrapper público SECURITY INVOKER sobre un
-- impl SECURITY DEFINER en `noven_private`, porque `authenticated` sólo tiene
-- SELECT sobre `intervenciones_rag` y no debe tener más.
--
-- `escalones_aplicados` se calcula EN EL SERVIDOR contra la escala de la
-- organización, no lo informa el cliente: es el dato con el que después se va a
-- confrontar la regla contra la realidad, y no debería depender de que el
-- browser lo calcule bien.

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
  v_uid       uuid := (SELECT auth.uid());
  v_rag       public.intervenciones_rag%ROWTYPE;
  v_anterior  numeric;
  v_esc_desde smallint;
  v_esc_hasta smallint;
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

  -- La instrumentacion se escribe UNA vez. Si ya la tiene, no se pisa: es
  -- evidencia historica, no un campo de estado.
  IF v_rag.origen_sugerencia IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT r.porcentaje_descuento INTO v_anterior
  FROM public.intervenciones_rag r
  WHERE r.vencimiento_id = p_vencimiento_id
    AND r.id <> v_rag.id
  ORDER BY r.aplicado_at DESC, r.created_at DESC, r.id DESC
  LIMIT 1;

  SELECT e.escalon INTO v_esc_desde
  FROM public.rag_escala_descuento e
  WHERE e.organizacion_id = v_rag.organizacion_id AND e.porcentaje = v_anterior;

  SELECT e.escalon INTO v_esc_hasta
  FROM public.rag_escala_descuento e
  WHERE e.organizacion_id = v_rag.organizacion_id AND e.porcentaje = v_rag.porcentaje_descuento;

  UPDATE public.intervenciones_rag
  SET cobertura_al_sugerir = p_cobertura,
      escalones_sugeridos  = p_escalones_sugeridos,
      escalones_aplicados  = CASE
                               WHEN v_esc_desde IS NULL OR v_esc_hasta IS NULL THEN NULL
                               ELSE (v_esc_hasta - v_esc_desde)::smallint
                             END,
      origen_sugerencia    = p_origen
  WHERE id = v_rag.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.instrumentar_sugerencia_rag(
  p_vencimiento_id      uuid,
  p_cobertura           numeric DEFAULT NULL,
  p_escalones_sugeridos smallint DEFAULT NULL,
  p_origen              text DEFAULT 'manual'
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.instrumentar_sugerencia_rag_impl(
    p_vencimiento_id, p_cobertura, p_escalones_sugeridos, p_origen
  );
$$;

REVOKE ALL ON FUNCTION noven_private.instrumentar_sugerencia_rag_impl(uuid, numeric, smallint, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instrumentar_sugerencia_rag(uuid, numeric, smallint, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.instrumentar_sugerencia_rag(uuid, numeric, smallint, text)
  TO authenticated;

-- --- 3. La vista expone las magnitudes de cobertura --------------------------

CREATE OR REPLACE VIEW public.v_seguimiento_rag_actual WITH (security_invoker=true) AS
 SELECT v.id AS vencimiento_id,
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
            ELSE GREATEST(rag.cantidad_comprometida_al_aplicar - obs.cantidad_comprometida, 0::numeric) / NULLIF(EXTRACT(epoch FROM obs.observada_at - rag.aplicado_at) / 86400.0, 0::numeric)
        END AS velocidad_observada,
        CASE
            WHEN GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0) <= 0 THEN NULL::numeric
            ELSE COALESCE(obs.cantidad_comprometida, v.cantidad::numeric) / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0)::numeric
        END AS velocidad_necesaria,

    -- CAMBIADO · El juicio usa la necesaria de la ventana observada, no la de hoy.
        CASE
            WHEN (v.fecha_vencimiento - op.hoy) <= 0 THEN 'decomiso'::text
            WHEN (v.fecha_vencimiento - op.hoy) <= s.dias_donacion THEN 'donacion'::text
            WHEN rag.id IS NULL THEN 'sin_rag'::text
            WHEN obs.id IS NULL THEN
            CASE
                WHEN GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0) > 0 AND ps.venta_media_diaria >= (v.cantidad::numeric / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 1)::numeric) THEN 'efectivo_por_vmd'::text
                ELSE 'pendiente_control_operador'::text
            END
            WHEN obs.cantidad_comprometida > rag.cantidad_comprometida_al_aplicar THEN 'dato_a_revisar'::text
            WHEN obs.cantidad_comprometida = 0::numeric THEN 'efectivo'::text
            WHEN obs.cantidad_comprometida = rag.cantidad_comprometida_al_aplicar THEN 'sin_movimiento'::text
            WHEN obs.observada_at <= rag.aplicado_at THEN 'pendiente_control_operador'::text
            WHEN (GREATEST(rag.cantidad_comprometida_al_aplicar - obs.cantidad_comprometida, 0::numeric) / NULLIF(EXTRACT(epoch FROM obs.observada_at - rag.aplicado_at) / 86400.0, 0::numeric))
                 >= COALESCE(
                      NULLIF(rag.cantidad_comprometida_al_aplicar
                             / NULLIF(GREATEST(v.fecha_vencimiento - (rag.aplicado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - s.dias_donacion, 0), 0)::numeric, 0),
                      -- Si la ventana ya estaba cerrada al aplicar, no hay
                      -- estándar histórico contra el cual juzgar: se cae a la
                      -- necesaria de hoy en vez de dar por bueno cualquier ritmo.
                      obs.cantidad_comprometida / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 1)::numeric
                    ) THEN 'efectivo'::text
            ELSE 'insuficiente'::text
        END AS estado_seguimiento_rag,

    -- NUEVO · La necesaria que regía cuando se aplicó el RAG.
    --
    -- Se reconstruye con la ventana comercial de ESE día y el stock comprometido
    -- de ESE momento, que es contra lo que la intervención se fijó. Es la
    -- comparación justa para juzgar si funcionó.
        CASE
            WHEN rag.id IS NULL THEN NULL::numeric
            WHEN GREATEST(v.fecha_vencimiento - (rag.aplicado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - s.dias_donacion, 0) <= 0 THEN NULL::numeric
            ELSE rag.cantidad_comprometida_al_aplicar
                 / GREATEST(v.fecha_vencimiento - (rag.aplicado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - s.dias_donacion, 0)::numeric
        END AS velocidad_necesaria_al_aplicar,

    -- NUEVO · Cobertura: qué fracción del ritmo requerido HOY se está logrando.
    -- Adimensional. Es la magnitud que decide cuántos escalones subir.
        CASE
            WHEN rag.id IS NULL OR obs.id IS NULL OR obs.observada_at <= rag.aplicado_at THEN NULL::numeric
            WHEN GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0) <= 0 THEN NULL::numeric
            ELSE (GREATEST(rag.cantidad_comprometida_al_aplicar - obs.cantidad_comprometida, 0::numeric) / NULLIF(EXTRACT(epoch FROM obs.observada_at - rag.aplicado_at) / 86400.0, 0::numeric))
                 / NULLIF(COALESCE(obs.cantidad_comprometida, v.cantidad::numeric) / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 0)::numeric, 0::numeric)
        END AS cobertura,

    -- NUEVO · Días desde el último cambio de RAG. Insumo del enfriamiento: sin
    -- esto se sugiere 30 el lunes y 40 el martes sin haberle dado chance al 30.
        CASE
            WHEN rag.id IS NULL THEN NULL::numeric
            ELSE EXTRACT(epoch FROM op.ahora - rag.aplicado_at) / 86400.0
        END AS dias_desde_ultimo_rag
   FROM vencimientos v
     JOIN productos p ON p.id = v.producto_id
     JOIN producto_sucursal ps ON ps.producto_id = v.producto_id AND ps.sucursal_id = v.sucursal_id AND ps.organizacion_id = p.organizacion_id
     LEFT JOIN familias f ON f.id = p.familia_id AND f.organizacion_id = p.organizacion_id
     LEFT JOIN sectores s ON s.id = f.sector_id AND s.organizacion_id = p.organizacion_id
     CROSS JOIN LATERAL ( SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date AS hoy,
                                 now() AS ahora) op
     LEFT JOIN LATERAL ( SELECT r.id,
            r.organizacion_id,
            r.sucursal_id,
            r.producto_id,
            r.vencimiento_id,
            r.usuario_id,
            r.porcentaje_descuento,
            r.cantidad_comprometida_al_aplicar,
            r.vmd_glaciar_al_aplicar,
            r.aplicado_at,
            r.nota,
            r.created_at,
            r.finalizado_at,
            r.finalizado_por,
            r.motivo_finalizacion,
            r.nota_finalizacion
           FROM intervenciones_rag r
          WHERE r.vencimiento_id = v.id AND r.finalizado_at IS NULL
          ORDER BY r.aplicado_at DESC, r.created_at DESC, r.id DESC
         LIMIT 1) rag ON true
     LEFT JOIN LATERAL ( SELECT o.id,
            o.organizacion_id,
            o.sucursal_id,
            o.producto_id,
            o.vencimiento_id,
            o.usuario_id,
            o.cantidad_comprometida,
            o.observada_at,
            o.nota,
            o.created_at
           FROM vencimiento_observaciones o
          WHERE o.vencimiento_id = v.id AND rag.id IS NOT NULL AND o.observada_at > rag.aplicado_at
          ORDER BY o.observada_at DESC, o.id DESC
         LIMIT 1) obs ON true
  WHERE v.activo = true AND s.dias_donacion IS NOT NULL;

COMMIT;
