-- =============================================================================
-- NOVEN · BLOQUE B · MEDIR CADA TRAMO CONTRA SU PROPIA VENTANA
--
-- ESTE ES EL BLOQUE QUE MUEVE CIFRAS VISIBLES. A definía la ventana sin tocar
-- ningún número; acá se mide contra ella, y el operador lo ve.
--
-- TRES CAMBIOS, CON RIESGOS MUY DISTINTOS
--
-- 1 · SE DESCUENTAN LAS SALIDAS QUE NO FUERON VENTA (bloque 5a). Una
--     transferencia a otra sucursal baja el stock igual que una venta, y hoy el
--     motor la lee como venta: calcula una velocidad que no ocurrió y declara
--     efectiva una intervención que no hizo nada.
--
--     IMPACTO HOY: CERO. No hay ninguna declaración cargada todavía. Eso vuelve
--     este cambio seguro de aplicar Y PELIGROSO DE VERIFICAR: un error acá no
--     da síntoma ahora y aparecería la primera vez que un operario declare una
--     transferencia, cuando ya nadie mire el PR. Por eso el contrato ejercita la
--     fórmula con declaraciones PROVOCADAS, no con las que existen.
--
-- 2 · SE AGREGA LA GUARDA DE VENTANA MÍNIMA. Un tramo de tres minutos no da un
--     número malo: da un número absurdo. En producción hay tres tramos cerrados
--     de menos de una hora —el operario cargó 30% y lo corrigió a 20% dos
--     minutos después—, y sobre esa ventana cualquier cociente es ruido.
--
--     La regla NO se inventa acá: es `ventanaObservable` de
--     `src/lib/ragCobertura.ts`, `dias × velocidad_necesaria >= 1`. Se adapta al
--     ritmo que el SKU necesita en vez de fijar un número de días igual para
--     todos. Un tramo sin ventana suficiente NO se mide y queda en un estado
--     PROPIO: "no se puede medir" y "se midió y dio cero" no comparten valor.
--
-- 3 · SE ELIMINA `efectivo_por_vmd`. Declaraba una intervención efectiva SIN
--     NINGUNA OBSERVACIÓN, comparando contra la venta media de Glaciar. Es
--     circular: la VMD describe cómo se movía el producto SIN intervención, así
--     que usarla para afirmar que la intervención funcionó dice que funcionó
--     porque se mueve como se movía antes. Es el mismo argumento por el que la
--     VMD ya se había descartado como referencia para detectar salidas anómalas,
--     y contradice el principio recién escrito: no medir contra un supuesto.
--
--     Hoy da cero casos. Se saca ahora, que no cuesta, y no cuando aparezca el
--     primero y haya que decidir con un caso real esperando.
--
-- LA MEDICIÓN ARRANCA EN `v_intervencion_tramos.inicio`, SEA CUAL SEA EL EVENTO
-- QUE LO PRODUZCA. Hoy ese inicio es el click que aplica el RAG. Cuando el
-- circuito de ejecución centralizada mueva el inicio a la confirmación en
-- góndola —ver `docs/CIRCUITO_RAG_CENTRALIZADO_V1.md`— esta vista no se entera.
-- Nada de acá asume que el tramo empieza cuando se decide el descuento.
--
-- EL CONTRATO DE COLUMNAS NO CAMBIA. Los cinco consumidores —dos modales, la
-- tarjeta, `analisis` y `problemas-activos`— siguen leyendo las mismas columnas
-- en el mismo orden. Se agregan dos al final.
-- =============================================================================

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
  tramo.porcentaje_descuento             AS rag_porcentaje,
  tramo.inicio                           AS rag_aplicado_at,
  tramo.cantidad_al_iniciar              AS cantidad_base_rag,
  r.vmd_glaciar_al_aplicar,
  obs.id                                 AS observacion_id,
  obs.observada_at,
  obs.cantidad_comprometida              AS cantidad_observada,
  COALESCE(obs.cantidad_comprometida, v.cantidad::numeric) AS cantidad_actual_estimacion,

  -- UNIDADES VENDIDAS, YA NETAS. La caída bruta menos lo que se declaró salida
  -- ajena a la venta. Sin esto una transferencia de 162 unidades se lee como
  -- 162 vendidas.
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

  -- EL ORDEN DE LAS RAMAS ES LA REGLA. La guarda de ventana va DESPUÉS de los
  -- desenlaces que no dependen del cociente —vendido todo, dato incoherente— y
  -- ANTES de cualquier juicio de velocidad, incluido `sin_movimiento`: sobre
  -- tres minutos, "no se movió nada" no es una observación, es la duración.
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

  -- --- COLUMNAS NUEVAS, AL FINAL ---------------------------------------------
  -- Cuántas unidades se descontaron por no ser venta. Se expone para que el
  -- número sea auditable: sin esto, una velocidad más baja no se distingue de
  -- un error de cálculo.
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
  END                                    AS ventana_observable

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
  -- EL TRAMO ABIERTO. Hay como mucho uno por vencimiento: sólo el último puede
  -- no tener sucesor. De acá sale el INICIO de la ventana, y de ningún otro lado.
  LEFT JOIN LATERAL (
    SELECT t.intervencion_id, t.porcentaje_descuento, t.inicio, t.cantidad_al_iniciar
    FROM public.v_intervencion_tramos t
    WHERE t.vencimiento_id = v.id AND t.abierto
    ORDER BY t.inicio DESC
    LIMIT 1
  ) tramo ON true
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
  -- Las salidas no-venta declaradas DENTRO de la ventana del tramo. Cada
  -- declaración vive en una observación, y cada observación cae en exactamente
  -- un tramo, así que no hay doble conteo posible.
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

-- `CREATE OR REPLACE VIEW` NO CONSERVA LAS RELOPTIONS DE LA VISTA. El ACL sí
-- sobrevive —está verificado por fingerprint—, pero `security_invoker` NO: el
-- reemplazo la devuelve al default, y una vista sin él evalúa RLS COMO SU DUEÑO.
-- Acá eso significa que cualquier usuario autenticado vería las filas de TODAS
-- las organizaciones a través de esta vista.
--
-- Lo cazó el verificador de exposición contra la base real. Es la distinción
-- exacta que faltaba en `ai/rules.md`: sobrevive el ACL, no la configuración.
ALTER VIEW public.v_seguimiento_rag_actual SET (security_invoker = true);

COMMENT ON VIEW public.v_seguimiento_rag_actual IS
  'Seguimiento del tramo ABIERTO de cada vencimiento, medido contra su propia ventana. Descuenta las salidas declaradas como no-venta (bloque 5a) y no mide tramos cuya ventana no alcanza para observar una unidad (ventanaObservable: dias x velocidad_necesaria >= 1). El inicio de la ventana sale de v_intervencion_tramos, no del click que aplica el RAG.';
