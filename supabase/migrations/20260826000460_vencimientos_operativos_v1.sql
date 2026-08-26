-- =============================================================================
-- MULTITENANT V1 · FASE 3C — contrato operativo de vencimientos
--
-- Une:
--   vencimiento (local) + catálogo (global por organización) + estado SKU/store.
--
-- El frontend futuro debe consumir esta vista en lugar de pedir
-- `vencimientos -> productos.stock_actual/venta_media_diaria`, porque esos dos
-- campos legacy pertenecen únicamente a la transición de 091.
-- =============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.v_vencimientos_operativos
WITH (security_invoker = true)
AS
SELECT
  v.id,
  v.producto_id,
  v.sucursal_id,
  v.usuario_id,
  v.cantidad,
  v.lote,
  v.fecha_vencimiento,
  v.fecha_carga,
  v.activo,
  v.created_at,
  v.updated_at,
  v.nivel_actual,

  p.organizacion_id,
  p.cod_art,
  p.codigo_barras,
  p.descripcion,
  p.marca,
  p.gramaje,
  p.categoria,
  p.proveedor,
  p.sector,
  p.precio_costo,
  p.imagen_url,
  p.familia_id,
  p.activo AS producto_activo,
  p.created_at AS producto_created_at,
  p.updated_at AS producto_updated_at,

  ps.stock_actual,
  ps.venta_media_diaria,
  ps.fecha_ultima_importacion,
  ps.updated_at AS estado_updated_at
FROM public.vencimientos v
JOIN public.productos p
  ON p.id = v.producto_id
JOIN public.producto_sucursal ps
  ON ps.producto_id = v.producto_id
 AND ps.sucursal_id = v.sucursal_id
 AND ps.organizacion_id = p.organizacion_id;

REVOKE ALL ON TABLE public.v_vencimientos_operativos FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_vencimientos_operativos TO authenticated;

COMMENT ON VIEW public.v_vencimientos_operativos IS
  'Vencimientos con catálogo global y stock/VMD de la sucursal exacta; contrato objetivo para frontend multitenant.';

COMMIT;
