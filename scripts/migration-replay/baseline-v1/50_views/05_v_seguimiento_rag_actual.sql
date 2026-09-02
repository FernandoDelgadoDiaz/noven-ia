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
            WHEN (GREATEST(rag.cantidad_comprometida_al_aplicar - obs.cantidad_comprometida, 0::numeric) / NULLIF(EXTRACT(epoch FROM obs.observada_at - rag.aplicado_at) / 86400.0, 0::numeric)) >= (obs.cantidad_comprometida / GREATEST(v.fecha_vencimiento - op.hoy - s.dias_donacion, 1)::numeric) THEN 'efectivo'::text
            ELSE 'insuficiente'::text
        END AS estado_seguimiento_rag
   FROM vencimientos v
     JOIN productos p ON p.id = v.producto_id
     JOIN producto_sucursal ps ON ps.producto_id = v.producto_id AND ps.sucursal_id = v.sucursal_id AND ps.organizacion_id = p.organizacion_id
     LEFT JOIN familias f ON f.id = p.familia_id AND f.organizacion_id = p.organizacion_id
     LEFT JOIN sectores s ON s.id = f.sector_id AND s.organizacion_id = p.organizacion_id
     CROSS JOIN LATERAL ( SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date AS hoy) op
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
  WHERE v.activo = true AND s.dias_donacion IS NOT NULL;;
