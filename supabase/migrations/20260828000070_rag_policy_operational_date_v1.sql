-- =============================================================================
-- NOVEN · RAG POLICY + OPERATIONAL DATE V1
--
-- Corrige una vista legacy que todavía infería NULL -> 10 y usaba CURRENT_DATE.
-- Regla autoritativa:
--   - sectores.dias_donacion es la única política;
--   - NULL significa fuera del circuito;
--   - la fecha operativa es America/Argentina/Buenos_Aires.
-- =============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.v_seguimiento_rag_actual
WITH (security_invoker = true)
AS
SELECT
  v.id AS vencimiento_id,
  p.organizacion_id,
  v.sucursal_id,
  v.producto_id,
  p.descripcion,
  p.familia_id,
  f.sector_id,
  s.nombre AS sector_nombre,
  s.dias_donacion,
  v.fecha_vencimiento,
  (v.fecha_vencimiento - op.hoy) AS dias_hasta_vencimiento,
  GREATEST((v.fecha_vencimiento - op.hoy) - s.dias_donacion, 0) AS dias_comerciales_restantes,
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
  COALESCE(obs.cantidad_comprometida, v.cantidad) AS cantidad_actual_estimacion,

  CASE
    WHEN rag.id IS NULL OR obs.id IS NULL THEN NULL
    ELSE GREATEST(rag.cantidad_comprometida_al_aplicar - obs.cantidad_comprometida, 0)
  END AS unidades_vendidas_observadas,

  CASE
    WHEN rag.id IS NULL OR obs.id IS NULL OR obs.observada_at <= rag.aplicado_at THEN NULL
    ELSE EXTRACT(EPOCH FROM (obs.observada_at - rag.aplicado_at)) / 86400.0
  END AS dias_observados,

  CASE
    WHEN rag.id IS NULL OR obs.id IS NULL OR obs.observada_at <= rag.aplicado_at THEN NULL
    ELSE GREATEST(rag.cantidad_comprometida_al_aplicar - obs.cantidad_comprometida, 0)
         / NULLIF(EXTRACT(EPOCH FROM (obs.observada_at - rag.aplicado_at)) / 86400.0, 0)
  END AS velocidad_observada,

  CASE
    WHEN GREATEST((v.fecha_vencimiento - op.hoy) - s.dias_donacion, 0) <= 0 THEN NULL
    ELSE COALESCE(obs.cantidad_comprometida, v.cantidad)
         / GREATEST((v.fecha_vencimiento - op.hoy) - s.dias_donacion, 0)::numeric
  END AS velocidad_necesaria,

  CASE
    WHEN (v.fecha_vencimiento - op.hoy) <= 0 THEN 'decomiso'
    WHEN (v.fecha_vencimiento - op.hoy) <= s.dias_donacion THEN 'donacion'
    WHEN rag.id IS NULL THEN 'sin_rag'
    WHEN obs.id IS NULL THEN
      CASE
        WHEN GREATEST((v.fecha_vencimiento - op.hoy) - s.dias_donacion, 0) > 0
         AND ps.venta_media_diaria >= (
           v.cantidad / GREATEST((v.fecha_vencimiento - op.hoy) - s.dias_donacion, 1)::numeric
         )
        THEN 'efectivo_por_vmd'
        ELSE 'pendiente_control_operador'
      END
    WHEN obs.cantidad_comprometida > rag.cantidad_comprometida_al_aplicar THEN 'dato_a_revisar'
    WHEN obs.cantidad_comprometida = 0 THEN 'efectivo'
    WHEN obs.cantidad_comprometida = rag.cantidad_comprometida_al_aplicar THEN 'sin_movimiento'
    WHEN obs.observada_at <= rag.aplicado_at THEN 'pendiente_control_operador'
    WHEN (
      GREATEST(rag.cantidad_comprometida_al_aplicar - obs.cantidad_comprometida, 0)
      / NULLIF(EXTRACT(EPOCH FROM (obs.observada_at - rag.aplicado_at)) / 86400.0, 0)
    ) >= (
      obs.cantidad_comprometida
      / GREATEST((v.fecha_vencimiento - op.hoy) - s.dias_donacion, 1)::numeric
    ) THEN 'efectivo'
    ELSE 'insuficiente'
  END AS estado_seguimiento_rag

FROM public.vencimientos v
JOIN public.productos p
  ON p.id = v.producto_id
JOIN public.producto_sucursal ps
  ON ps.producto_id = v.producto_id
 AND ps.sucursal_id = v.sucursal_id
 AND ps.organizacion_id = p.organizacion_id
LEFT JOIN public.familias f
  ON f.id = p.familia_id
 AND f.organizacion_id = p.organizacion_id
LEFT JOIN public.sectores s
  ON s.id = f.sector_id
 AND s.organizacion_id = p.organizacion_id
CROSS JOIN LATERAL (
  SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy
) op
LEFT JOIN LATERAL (
  SELECT r.*
  FROM public.intervenciones_rag r
  WHERE r.vencimiento_id = v.id
  ORDER BY r.aplicado_at DESC, r.created_at DESC
  LIMIT 1
) rag ON true
LEFT JOIN LATERAL (
  SELECT o.*
  FROM public.vencimiento_observaciones o
  WHERE o.vencimiento_id = v.id
    AND rag.id IS NOT NULL
    AND o.observada_at > rag.aplicado_at
  ORDER BY o.observada_at DESC, o.id DESC
  LIMIT 1
) obs ON true
WHERE v.activo = true
  AND s.dias_donacion IS NOT NULL;

REVOKE ALL ON TABLE public.v_seguimiento_rag_actual FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_seguimiento_rag_actual TO authenticated;

COMMENT ON VIEW public.v_seguimiento_rag_actual IS
  'Seguimiento RAG con security_invoker, política autoritativa de sectores y fecha operacional Argentina. Sectores con política NULL quedan fuera del circuito.';

COMMIT;
