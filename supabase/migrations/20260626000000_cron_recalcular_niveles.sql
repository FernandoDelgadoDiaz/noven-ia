-- ============================================================
-- 20260626000000_cron_recalcular_niveles.sql
-- Recalcula server-side el nivel_actual de los vencimientos activos.
--
-- Motivo (F5/PASO 7): la detección de transición a 'urgente' vivía solo en
-- el frontend (useVencimientos), así que el push solo se disparaba cuando
-- alguien abría la app. Esta función recalcula el nivel para TODOS los
-- vencimientos activos; cuando uno transiciona a 'urgente', el trigger
-- trg_notify_push_urgente (AFTER UPDATE OF nivel_actual) dispara el push.
--
-- La lógica es espejo de src/lib/riesgo.ts (umbrales 45/20/10/0 + cobertura).
-- Si cambian los umbrales, actualizar en AMBOS lugares.
--
-- El CREATE EXTENSION pg_cron y el cron.schedule se aplican por separado
-- (infra; pg_cron no existe en un `supabase db reset` local). Acá vive solo
-- la función, que es la fuente de verdad reproducible.
-- ============================================================

CREATE OR REPLACE FUNCTION recalcular_niveles_vencimientos() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  filas integer;
BEGIN
  WITH calc AS (
    SELECT
      ve.id,
      (ve.fecha_vencimiento - CURRENT_DATE) AS dias,
      -- diasStock: Infinity (2147483647) si no hay rotación; floor(cant/venta) si la hay
      CASE WHEN p.venta_media_diaria <= 0 THEN 2147483647
           ELSE floor(ve.cantidad::numeric / p.venta_media_diaria)::int END AS dias_stock
    FROM vencimientos ve
    JOIN productos p ON p.id = ve.producto_id
    WHERE ve.activo = true
  ),
  nivel AS (
    SELECT id,
      CASE
        WHEN dias <= 0                            THEN 'decomiso'
        WHEN dias <= 10                           THEN 'donacion'
        WHEN dias <= 20 AND dias_stock > dias     THEN 'urgente'
        WHEN dias <= 45 AND dias_stock > dias     THEN 'radar'
        ELSE 'seguro'
      END AS nivel_calc
    FROM calc
  )
  UPDATE vencimientos v
  SET nivel_actual = n.nivel_calc
  FROM nivel n
  WHERE v.id = n.id
    AND v.nivel_actual IS DISTINCT FROM n.nivel_calc;

  GET DIAGNOSTICS filas = ROW_COUNT;
  RETURN filas;
END;
$$;
