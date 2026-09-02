CREATE OR REPLACE VIEW public.v_efectividad_intervencion_rag WITH (security_invoker=true) AS
 WITH post AS (
         SELECT t.rag_id,
            min(t.accion_id::text)::uuid AS accion_id,
            count(*) AS tramos_observados,
            sum(t.unidades_vendidas_observadas) AS unidades_recuperadas_observadas,
            sum(
                CASE
                    WHEN t.finalizado_at > t.iniciado_at THEN EXTRACT(epoch FROM t.finalizado_at - t.iniciado_at) / 86400.0
                    ELSE 0::numeric
                END) AS dias_observados,
            count(*) FILTER (WHERE t.cantidad_fin > t.cantidad_inicio) AS tramos_con_entrada
           FROM v_resultado_vencimiento_tramos t
          WHERE t.rag_id IS NOT NULL
          GROUP BY t.rag_id
        ), base AS (
         SELECT r.id AS rag_id,
            r.organizacion_id,
            r.sucursal_id,
            r.producto_id,
            p.familia_id,
            r.vencimiento_id,
            r.usuario_id AS operador_id,
            r.porcentaje_descuento::numeric AS rag_porcentaje,
            r.cantidad_comprometida_al_aplicar AS unidades_expuestas_inicio,
            r.vmd_glaciar_al_aplicar,
            r.aplicado_at,
            r.finalizado_at,
            r.motivo_finalizacion,
            post.accion_id,
            COALESCE(post.tramos_observados, 0::bigint) AS tramos_observados,
            COALESCE(post.unidades_recuperadas_observadas, 0::numeric) AS unidades_recuperadas_observadas,
            COALESCE(post.dias_observados, 0::numeric) AS dias_observados,
            COALESCE(post.tramos_con_entrada, 0::bigint) AS tramos_con_entrada
           FROM intervenciones_rag r
             JOIN productos p ON p.id = r.producto_id
             LEFT JOIN post ON post.rag_id = r.id
        ), pre AS (
         SELECT b_1.rag_id,
            anterior.observada_at AS pre_inicio_at,
            anterior.cantidad_comprometida AS pre_cantidad_inicio,
            ultima.observada_at AS pre_fin_at,
            ultima.cantidad_comprometida AS pre_cantidad_fin,
                CASE
                    WHEN anterior.observada_at IS NOT NULL AND ultima.observada_at > anterior.observada_at THEN GREATEST(anterior.cantidad_comprometida - ultima.cantidad_comprometida, 0::numeric) / NULLIF(EXTRACT(epoch FROM ultima.observada_at - anterior.observada_at) / 86400.0, 0::numeric)
                    ELSE NULL::numeric
                END AS velocidad_pre_rag
           FROM base b_1
             LEFT JOIN LATERAL ( SELECT o.id,
                    o.observada_at,
                    o.cantidad_comprometida
                   FROM vencimiento_observaciones o
                  WHERE o.vencimiento_id = b_1.vencimiento_id AND o.observada_at <= b_1.aplicado_at
                  ORDER BY o.observada_at DESC, o.id DESC
                 LIMIT 1) ultima ON true
             LEFT JOIN LATERAL ( SELECT o.id,
                    o.observada_at,
                    o.cantidad_comprometida
                   FROM vencimiento_observaciones o
                  WHERE o.vencimiento_id = b_1.vencimiento_id AND ultima.id IS NOT NULL AND ((ROW(o.observada_at, o.id) < ROW(ultima.observada_at, ultima.id)))
                  ORDER BY o.observada_at DESC, o.id DESC
                 LIMIT 1) anterior ON true
        )
 SELECT b.rag_id,
    b.organizacion_id,
    b.sucursal_id,
    b.producto_id,
    b.familia_id,
    b.vencimiento_id,
    b.operador_id,
    b.rag_porcentaje,
    b.aplicado_at,
    b.finalizado_at,
    b.motivo_finalizacion,
    b.unidades_expuestas_inicio,
    b.vmd_glaciar_al_aplicar,
    b.tramos_observados,
    b.dias_observados,
    b.unidades_recuperadas_observadas,
    b.tramos_con_entrada,
        CASE
            WHEN b.unidades_expuestas_inicio > 0::numeric THEN b.unidades_recuperadas_observadas / b.unidades_expuestas_inicio
            ELSE NULL::numeric
        END AS proporcion_recuperada_observada,
        CASE
            WHEN b.dias_observados > 0::numeric THEN b.unidades_recuperadas_observadas / b.dias_observados
            ELSE NULL::numeric
        END AS velocidad_post_rag,
    pre.pre_inicio_at,
    pre.pre_cantidad_inicio,
    pre.pre_fin_at,
    pre.pre_cantidad_fin,
    pre.velocidad_pre_rag,
        CASE
            WHEN pre.velocidad_pre_rag > 0::numeric AND b.dias_observados > 0::numeric THEN (b.unidades_recuperadas_observadas / b.dias_observados - pre.velocidad_pre_rag) / pre.velocidad_pre_rag
            ELSE NULL::numeric
        END AS variacion_velocidad_vs_pre,
        CASE
            WHEN pre.velocidad_pre_rag IS NULL THEN 'sin_base_previa'::text
            WHEN b.dias_observados <= 0::numeric THEN 'sin_observacion_posterior'::text
            WHEN (b.unidades_recuperadas_observadas / NULLIF(b.dias_observados, 0::numeric)) > pre.velocidad_pre_rag THEN 'mejoro'::text
            WHEN (b.unidades_recuperadas_observadas / NULLIF(b.dias_observados, 0::numeric)) = pre.velocidad_pre_rag THEN 'sin_cambio'::text
            ELSE 'empeoro'::text
        END AS respuesta_velocidad,
    a.tipo AS resultado_terminal,
    a.costo_unitario_sin_iva,
        CASE
            WHEN a.costo_unitario_sin_iva IS NOT NULL THEN b.unidades_recuperadas_observadas * a.costo_unitario_sin_iva
            ELSE NULL::numeric
        END AS valor_recuperado_atribuido_sin_iva
   FROM base b
     LEFT JOIN pre ON pre.rag_id = b.rag_id
     LEFT JOIN acciones_operativas a ON a.id = b.accion_id
  WHERE b.accion_id IS NOT NULL;;
