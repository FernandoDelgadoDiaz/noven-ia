CREATE OR REPLACE VIEW public.v_resultado_operador_rag WITH (security_invoker=true) AS
 SELECT sucursal_id,
    operador_id,
    rag_porcentaje,
    atribucion_fuente,
    count(DISTINCT accion_id) AS casos,
    sum(unidades_vendidas_observadas) AS unidades_recuperadas_observadas
   FROM v_resultado_vencimiento_tramos t
  WHERE unidades_vendidas_observadas > 0::numeric AND operador_id IS NOT NULL
  GROUP BY sucursal_id, operador_id, rag_porcentaje, atribucion_fuente;;
