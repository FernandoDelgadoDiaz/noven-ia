CREATE OR REPLACE VIEW public.v_acciones_operativas_historial WITH (security_invoker=true) AS
 SELECT a.id,
    a.tipo,
    a.cantidad,
    a.created_at,
    a.observaciones,
    a.usuario_id,
    a.sucursal_id,
    a.producto_id,
    a.vencimiento_id,
    a.trimestre,
    a.anio,
    noven_private.nombre_actor_accion_visible(a.usuario_id, a.sucursal_id, a.producto_id) AS usuario_nombre,
    p.descripcion AS producto_descripcion,
    p.marca AS producto_marca,
    p.imagen_url AS producto_imagen_url,
    p.familia_id AS producto_familia_id,
    p.gramaje AS producto_gramaje,
    p.cod_art AS producto_cod_art,
    p.codigo_barras AS producto_codigo_barras,
    a.costo_unitario_sin_iva,
        CASE
            WHEN a.costo_unitario_sin_iva IS NULL THEN NULL::numeric
            ELSE a.cantidad::numeric * a.costo_unitario_sin_iva
        END AS valor_economico_sin_iva,
    a.costo_observado_at,
    a.valorizacion_metodo,
        CASE
            WHEN a.tipo = 'vendido'::text AND ciclo.tiene_evidencia THEN COALESCE(ciclo.unidades_recuperadas, 0::numeric)
            WHEN a.tipo = 'vendido'::text THEN a.cantidad::numeric
            ELSE 0::numeric
        END AS unidades_recuperadas,
        CASE
            WHEN a.tipo = ANY (ARRAY['donacion'::text, 'decomiso'::text]) THEN a.cantidad::numeric
            ELSE 0::numeric
        END AS unidades_perdidas,
        CASE
            WHEN a.costo_unitario_sin_iva IS NULL THEN NULL::numeric
            WHEN a.tipo = 'vendido'::text AND ciclo.tiene_evidencia THEN COALESCE(ciclo.unidades_recuperadas, 0::numeric) * a.costo_unitario_sin_iva
            WHEN a.tipo = 'vendido'::text THEN a.cantidad::numeric * a.costo_unitario_sin_iva
            ELSE 0::numeric
        END AS valor_recuperado_sin_iva,
        CASE
            WHEN a.costo_unitario_sin_iva IS NULL THEN NULL::numeric
            WHEN a.tipo = ANY (ARRAY['donacion'::text, 'decomiso'::text]) THEN a.cantidad::numeric * a.costo_unitario_sin_iva
            ELSE 0::numeric
        END AS valor_perdido_sin_iva,
    COALESCE(ciclo.tiene_evidencia, false) AS resultado_ciclo_completo,
    COALESCE(ciclo.tramos, '[]'::jsonb) AS tramos_resultado
   FROM acciones_operativas a
     JOIN productos p ON p.id = a.producto_id
     LEFT JOIN LATERAL ( SELECT count(*) > 0 AS tiene_evidencia,
            COALESCE(sum(t.unidades_vendidas_observadas), 0::numeric) AS unidades_recuperadas,
            jsonb_agg(jsonb_build_object('orden', t.tramo_orden, 'rag_porcentaje', t.rag_porcentaje, 'cantidad_inicio', t.cantidad_inicio, 'cantidad_fin', t.cantidad_fin, 'unidades_vendidas', t.unidades_vendidas_observadas, 'iniciado_at', t.iniciado_at, 'finalizado_at', t.finalizado_at, 'operador_id', t.operador_id, 'atribucion_fuente', t.atribucion_fuente) ORDER BY t.tramo_orden) AS tramos
           FROM v_resultado_vencimiento_tramos t
          WHERE t.accion_id = a.id) ciclo ON true;;
