CREATE OR REPLACE VIEW public.v_resultado_vencimiento_tramos WITH (security_invoker=true) AS
 WITH terminales AS (
         SELECT a.id AS accion_id,
            a.vencimiento_id,
            a.producto_id,
            a.sucursal_id,
            a.usuario_id AS usuario_cierre_id,
            a.tipo,
            a.created_at AS cierre_at,
                CASE
                    WHEN a.tipo = 'vendido'::text THEN 0::numeric
                    ELSE a.cantidad::numeric
                END AS cantidad_terminal
           FROM acciones_operativas a
          WHERE a.tipo = ANY (ARRAY['vendido'::text, 'donacion'::text, 'decomiso'::text])
        ), eventos AS (
         SELECT t.accion_id,
            t.vencimiento_id,
            t.producto_id,
            t.sucursal_id,
            o.observada_at AS evento_at,
            10 AS prioridad,
            'obs:'::text || o.id::text AS evento_key,
            o.cantidad_comprometida AS cantidad,
            o.usuario_id AS usuario_evento_id
           FROM terminales t
             JOIN vencimiento_observaciones o ON o.vencimiento_id = t.vencimiento_id AND o.observada_at <= t.cierre_at
        UNION ALL
         SELECT t.accion_id,
            t.vencimiento_id,
            t.producto_id,
            t.sucursal_id,
            r.aplicado_at,
            20,
            'rag:'::text || r.id::text,
            r.cantidad_comprometida_al_aplicar,
            r.usuario_id
           FROM terminales t
             JOIN intervenciones_rag r ON r.vencimiento_id = t.vencimiento_id AND r.aplicado_at <= t.cierre_at
        UNION ALL
         SELECT t.accion_id,
            t.vencimiento_id,
            t.producto_id,
            t.sucursal_id,
            t.cierre_at,
            30,
            'cierre:'::text || t.accion_id::text,
            t.cantidad_terminal,
            t.usuario_cierre_id
           FROM terminales t
        ), ordenados AS (
         SELECT e.accion_id,
            e.vencimiento_id,
            e.producto_id,
            e.sucursal_id,
            e.evento_at,
            e.prioridad,
            e.evento_key,
            e.cantidad,
            e.usuario_evento_id,
            lag(e.cantidad) OVER (PARTITION BY e.accion_id ORDER BY e.evento_at, e.prioridad, e.evento_key) AS cantidad_anterior,
            lag(e.evento_at) OVER (PARTITION BY e.accion_id ORDER BY e.evento_at, e.prioridad, e.evento_key) AS evento_anterior_at,
            lag(e.usuario_evento_id) OVER (PARTITION BY e.accion_id ORDER BY e.evento_at, e.prioridad, e.evento_key) AS usuario_anterior_id,
            row_number() OVER (PARTITION BY e.accion_id ORDER BY e.evento_at, e.prioridad, e.evento_key) AS evento_orden
           FROM eventos e
        ), intervalos AS (
         SELECT o.accion_id,
            o.vencimiento_id,
            o.producto_id,
            o.sucursal_id,
            o.evento_orden - 1 AS tramo_orden,
            rag.id AS rag_id,
            rag.porcentaje_descuento::numeric AS rag_porcentaje,
            o.cantidad_anterior AS cantidad_inicio,
            o.cantidad AS cantidad_fin,
            GREATEST(o.cantidad_anterior - o.cantidad, 0::numeric) AS unidades_vendidas_observadas,
            o.evento_anterior_at AS iniciado_at,
            o.evento_at AS finalizado_at,
            COALESCE(rag.usuario_id, o.usuario_anterior_id) AS operador_id,
                CASE
                    WHEN rag.id IS NOT NULL THEN 'rag'::text
                    ELSE 'observacion'::text
                END AS atribucion_fuente
           FROM ordenados o
             LEFT JOIN LATERAL ( SELECT r.id,
                    r.porcentaje_descuento,
                    r.usuario_id
                   FROM intervenciones_rag r
                  WHERE r.vencimiento_id = o.vencimiento_id AND o.evento_anterior_at IS NOT NULL AND r.aplicado_at <= o.evento_anterior_at AND (r.finalizado_at IS NULL OR r.finalizado_at > o.evento_anterior_at)
                  ORDER BY r.aplicado_at DESC, r.created_at DESC, r.id DESC
                 LIMIT 1) rag ON true
          WHERE o.cantidad_anterior IS NOT NULL
        )
 SELECT accion_id,
    vencimiento_id,
    producto_id,
    sucursal_id,
    tramo_orden,
    rag_id,
    rag_porcentaje,
    cantidad_inicio,
    cantidad_fin,
    unidades_vendidas_observadas,
    iniciado_at,
    finalizado_at,
    operador_id,
    atribucion_fuente
   FROM intervalos;;
