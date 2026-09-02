CREATE OR REPLACE VIEW public.v_problemas_economicos_historial WITH (security_invoker=true) AS
 SELECT id,
    organizacion_id,
    sucursal_id,
    vencimiento_id,
    producto_id,
    abierto_at,
    apertura_metodo,
    nivel_apertura,
    unidades_expuestas_apertura,
    dinero_en_riesgo_apertura,
    resuelto_at,
    resolucion,
    resolucion_fuente,
        CASE
            WHEN apertura_metodo = 'evento'::text THEN EXTRACT(epoch FROM COALESCE(resuelto_at, now()) - abierto_at)
            ELSE NULL::numeric
        END AS segundos_hasta_resolucion,
    nivel_actual,
    unidades_expuestas_actual,
    dinero_en_riesgo_actual
   FROM problemas_economicos_ciclos c;;
