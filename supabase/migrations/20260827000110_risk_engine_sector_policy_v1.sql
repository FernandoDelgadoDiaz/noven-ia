-- =============================================================================
-- NOVEN · MOTOR DE RIESGO POR POLÍTICA DE SECTOR V1
--
-- Semántica de negocio:
--   - RADAR: <=45 días y la cantidad comprometida no se vendería antes del
--     retiro obligatorio por donación.
--   - URGENTE: <=20 días y el riesgo persiste.
--   - DONACIÓN: umbral del sector (2 o 10 días actualmente).
--   - DECOMISO: vencido.
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

  f.sector_id,
  s.nombre AS sector_nombre,
  s.dias_donacion,

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
 AND ps.organizacion_id = p.organizacion_id
LEFT JOIN public.familias f
  ON f.id = p.familia_id
 AND f.organizacion_id = p.organizacion_id
LEFT JOIN public.sectores s
  ON s.id = f.sector_id
 AND s.organizacion_id = p.organizacion_id;

REVOKE ALL ON TABLE public.v_vencimientos_operativos FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_vencimientos_operativos TO authenticated;

COMMENT ON VIEW public.v_vencimientos_operativos IS
  'Vencimientos + catálogo + estado por sucursal + política de donación del sector.';

CREATE OR REPLACE FUNCTION public.recalcular_niveles_vencimientos()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  filas integer;
BEGIN
  WITH calc AS (
    SELECT
      ve.id,
      (ve.fecha_vencimiento - CURRENT_DATE) AS dias,
      COALESCE(s.dias_donacion, 10) AS dias_donacion,
      CASE
        WHEN ps.venta_media_diaria <= 0 THEN 'Infinity'::float8
        ELSE ve.cantidad::float8 / ps.venta_media_diaria::float8
      END AS dias_stock
    FROM public.vencimientos ve
    JOIN public.productos p
      ON p.id = ve.producto_id
    JOIN public.producto_sucursal ps
      ON ps.producto_id = ve.producto_id
     AND ps.sucursal_id = ve.sucursal_id
     AND ps.organizacion_id = p.organizacion_id
    LEFT JOIN public.familias f
      ON f.id = p.familia_id
     AND f.organizacion_id = p.organizacion_id
    LEFT JOIN public.sectores s
      ON s.id = f.sector_id
     AND s.organizacion_id = p.organizacion_id
    WHERE ve.activo = true
  ),
  nivel AS (
    SELECT
      id,
      CASE
        WHEN dias <= 0 THEN 'decomiso'
        WHEN dias <= dias_donacion THEN 'donacion'
        WHEN dias <= 20 AND dias_stock > GREATEST(dias - dias_donacion, 0) THEN 'urgente'
        WHEN dias <= 45 AND dias_stock > GREATEST(dias - dias_donacion, 0) THEN 'radar'
        ELSE 'seguro'
      END AS nivel_calc
    FROM calc
  )
  UPDATE public.vencimientos v
  SET nivel_actual = n.nivel_calc
  FROM nivel n
  WHERE v.id = n.id
    AND v.nivel_actual IS DISTINCT FROM n.nivel_calc;

  GET DIAGNOSTICS filas = ROW_COUNT;
  RETURN filas;
END;
$$;

REVOKE ALL ON FUNCTION public.recalcular_niveles_vencimientos()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.recalcular_niveles_vencimientos() IS
  'Recalcula riesgo usando VMD por sucursal y ventana comercial hasta donación configurada por sector.';

COMMIT;
