CREATE OR REPLACE VIEW public.v_efectividad_rag_resumen WITH (security_invoker=true) AS
 SELECT organizacion_id,
    sucursal_id,
    familia_id,
    rag_porcentaje,
    count(*) AS casos,
    count(*) FILTER (WHERE velocidad_pre_rag IS NOT NULL AND dias_observados > 0::numeric) AS casos_con_comparacion_pre_post,
    count(DISTINCT operador_id) AS operadores_distintos,
    sum(unidades_expuestas_inicio) AS unidades_expuestas_inicio,
    sum(unidades_recuperadas_observadas) AS unidades_recuperadas_observadas,
    sum(valor_recuperado_atribuido_sin_iva) AS valor_recuperado_atribuido_sin_iva,
    sum(dias_observados) AS dias_observados,
        CASE
            WHEN sum(unidades_expuestas_inicio) > 0::numeric THEN sum(unidades_recuperadas_observadas) / sum(unidades_expuestas_inicio)
            ELSE NULL::numeric
        END AS proporcion_recuperada_observada,
        CASE
            WHEN sum(dias_observados) > 0::numeric THEN sum(unidades_recuperadas_observadas) / sum(dias_observados)
            ELSE NULL::numeric
        END AS velocidad_post_ponderada,
    avg(variacion_velocidad_vs_pre) FILTER (WHERE variacion_velocidad_vs_pre IS NOT NULL) AS variacion_velocidad_vs_pre_promedio,
    count(*) FILTER (WHERE respuesta_velocidad = 'mejoro'::text) AS casos_mejoro_velocidad,
    count(*) FILTER (WHERE tramos_con_entrada > 0) AS casos_con_entradas,
        CASE
            WHEN count(*) < 5 THEN 'insuficiente'::text
            WHEN count(*) < 15 THEN 'inicial'::text
            WHEN count(*) < 30 THEN 'moderada'::text
            ELSE 'alta'::text
        END AS madurez_evidencia,
        CASE
            WHEN count(*) >= 15 AND count(*) FILTER (WHERE velocidad_pre_rag IS NOT NULL AND dias_observados > 0::numeric) >= 8 THEN true
            ELSE false
        END AS habilita_recomendacion_historica
   FROM v_efectividad_intervencion_rag e
  GROUP BY organizacion_id, sucursal_id, familia_id, rag_porcentaje;;
