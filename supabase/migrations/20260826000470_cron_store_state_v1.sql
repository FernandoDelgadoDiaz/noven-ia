-- =============================================================================
-- MULTITENANT V1 · FASE 3D — cron de riesgo usa estado por sucursal
--
-- Reemplaza únicamente la FUENTE de venta_media_diaria:
--   antes: productos.venta_media_diaria (legacy/global)
--   ahora: producto_sucursal.venta_media_diaria (SKU × sucursal)
--
-- Los umbrales y la semántica del motor NO cambian en esta migración. Separar
-- multitenancy de una futura revisión del algoritmo reduce riesgo operativo.
-- =============================================================================

BEGIN;

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
      CASE
        WHEN ps.venta_media_diaria <= 0 THEN 2147483647
        ELSE floor(ve.cantidad::numeric / ps.venta_media_diaria)::int
      END AS dias_stock
    FROM public.vencimientos ve
    JOIN public.producto_sucursal ps
      ON ps.producto_id = ve.producto_id
     AND ps.sucursal_id = ve.sucursal_id
    WHERE ve.activo = true
  ),
  nivel AS (
    SELECT
      id,
      CASE
        WHEN dias <= 0                         THEN 'decomiso'
        WHEN dias <= 10                        THEN 'donacion'
        WHEN dias <= 20 AND dias_stock > dias THEN 'urgente'
        WHEN dias <= 45 AND dias_stock > dias THEN 'radar'
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

-- Es una función de infraestructura invocada por pg_cron, no una RPC de usuario.
REVOKE ALL ON FUNCTION public.recalcular_niveles_vencimientos()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.recalcular_niveles_vencimientos() IS
  'Recalcula niveles con VMD específica de la sucursal desde producto_sucursal. Umbrales legacy preservados.';

COMMIT;
