CREATE OR REPLACE VIEW public.v_efectividad_rag_operador WITH (security_invoker=true) AS
 SELECT organizacion_id,
    sucursal_id,
    operador_id,
    familia_id,
    rag_porcentaje,
    count(*) AS casos,
    sum(unidades_recuperadas_observadas) AS unidades_recuperadas_observadas,
    sum(valor_recuperado_atribuido_sin_iva) AS valor_recuperado_atribuido_sin_iva,
    avg(variacion_velocidad_vs_pre) FILTER (WHERE variacion_velocidad_vs_pre IS NOT NULL) AS variacion_velocidad_vs_pre_promedio
   FROM v_efectividad_intervencion_rag e
  WHERE operador_id IS NOT NULL
  GROUP BY organizacion_id, sucursal_id, operador_id, familia_id, rag_porcentaje;;
