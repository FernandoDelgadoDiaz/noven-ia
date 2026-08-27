-- =============================================================================
-- NOVEN · POLÍTICA DE PERECEDEROS + HARDENING RADAR ZONAL V1
--
-- Reglas confirmadas de negocio:
--   * Lácteos, Fiambres/Fiambresía y Pastas: 2 días de donación.
--   * El resto de perecederos confirmados mantiene 2 días.
--   * Electro e Insumos quedan fuera del circuito de vencimientos/donación.
--   * Un sector sin política explícita NO debe heredar 10 días por defecto.
--
-- Además se agregan índices de cobertura para FK nuevas de Radar Zonal.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Política explícita por sector
-- -----------------------------------------------------------------------------
UPDATE public.sectores
SET dias_donacion = 2
WHERE organizacion_id = '10000000-0000-4000-8000-000000000001'::uuid
  AND upper(btrim(nombre)) IN (
    'LACTEOS', 'LÁCTEOS',
    'FIAMBRES', 'FIAMBRERIA', 'FIAMBRERÍA',
    'PASTAS',
    'VERDULERIA', 'VERDULERÍA',
    'CARNICERIA', 'CARNICERÍA',
    'PANADERIA', 'PANADERÍA',
    'ROTISERIA', 'ROTISERÍA'
  );

-- Sectores fuera del circuito operativo de vencimientos/donación.
UPDATE public.sectores
SET dias_donacion = NULL
WHERE organizacion_id = '10000000-0000-4000-8000-000000000001'::uuid
  AND upper(btrim(nombre)) IN ('ELECTRO', 'INSUMOS');

-- -----------------------------------------------------------------------------
-- 2. Motor general: NULL = sin política, por lo tanto no inferir ni alertar
-- -----------------------------------------------------------------------------
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
      s.dias_donacion,
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
        -- Sin política explícita = fuera del motor. No inferir 10 días.
        WHEN dias_donacion IS NULL THEN 'seguro'
        WHEN dias <= 0 THEN 'decomiso'
        WHEN dias <= dias_donacion THEN 'donacion'
        WHEN dias <= 20
         AND dias_stock > GREATEST(dias - dias_donacion, 0)
          THEN 'urgente'
        WHEN dias <= 45
         AND dias_stock > GREATEST(dias - dias_donacion, 0)
          THEN 'radar'
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
  'Recalcula riesgo con política explícita por sector. NULL significa sector fuera del circuito; no se infieren 10 días.';

-- -----------------------------------------------------------------------------
-- 3. Motor Radar Zonal: misma semántica que el motor general
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION noven_private.nivel_riesgo_vencimiento_zonal_v1(
  p_vencimiento_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dias integer;
  v_dias_donacion integer;
  v_cantidad numeric;
  v_vmd numeric;
  v_dias_comerciales numeric;
  v_hay_riesgo boolean;
BEGIN
  SELECT
    v.fecha_vencimiento - CURRENT_DATE,
    s.dias_donacion,
    v.cantidad,
    ps.venta_media_diaria
  INTO
    v_dias,
    v_dias_donacion,
    v_cantidad,
    v_vmd
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
  WHERE v.id = p_vencimiento_id
    AND v.activo = true;

  IF NOT FOUND THEN
    RETURN 'seguro';
  END IF;

  -- Electro, Insumos o cualquier sector todavía no configurado quedan fuera.
  IF v_dias_donacion IS NULL THEN
    RETURN 'seguro';
  END IF;

  IF v_dias <= 0 THEN
    RETURN 'decomiso';
  END IF;

  IF v_dias <= v_dias_donacion THEN
    RETURN 'donacion';
  END IF;

  v_dias_comerciales := GREATEST(v_dias - v_dias_donacion, 0);
  v_hay_riesgo := v_vmd <= 0
    OR (v_cantidad / NULLIF(v_vmd, 0)) > v_dias_comerciales;

  IF v_dias <= 20 AND v_hay_riesgo THEN
    RETURN 'urgente';
  END IF;

  IF v_dias <= 45 AND v_hay_riesgo THEN
    RETURN 'radar';
  END IF;

  RETURN 'seguro';
END;
$$;

REVOKE ALL ON FUNCTION noven_private.nivel_riesgo_vencimiento_zonal_v1(uuid)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION noven_private.nivel_riesgo_vencimiento_zonal_v1(uuid) IS
  'Nivel autoritativo de Radar Zonal. Usa únicamente política explícita de donación; NULL queda fuera del circuito.';

-- Recalcular niveles actuales después de corregir la política de Fiambres.
SELECT public.recalcular_niveles_vencimientos();

-- -----------------------------------------------------------------------------
-- 4. Índices de cobertura para FK de Radar Zonal
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS alertas_zonales_organizacion_idx
  ON public.alertas_zonales(organizacion_id);
CREATE INDEX IF NOT EXISTS alertas_zonales_zona_org_idx
  ON public.alertas_zonales(zona_id, organizacion_id);
CREATE INDEX IF NOT EXISTS alertas_zonales_producto_org_idx
  ON public.alertas_zonales(producto_id, organizacion_id);
CREATE INDEX IF NOT EXISTS alertas_zonales_familia_org_idx
  ON public.alertas_zonales(familia_id, organizacion_id);
CREATE INDEX IF NOT EXISTS alertas_zonales_sucursal_org_idx
  ON public.alertas_zonales(sucursal_origen_id, organizacion_id);
CREATE INDEX IF NOT EXISTS alertas_zonales_vencimiento_origen_idx
  ON public.alertas_zonales(vencimiento_origen_id);

CREATE INDEX IF NOT EXISTS alertas_zonales_destinos_organizacion_idx
  ON public.alertas_zonales_destinos(organizacion_id);
CREATE INDEX IF NOT EXISTS alertas_zonales_destinos_zona_org_idx
  ON public.alertas_zonales_destinos(zona_id, organizacion_id);
CREATE INDEX IF NOT EXISTS alertas_zonales_destinos_sucursal_org_idx
  ON public.alertas_zonales_destinos(sucursal_id, organizacion_id);
CREATE INDEX IF NOT EXISTS alertas_zonales_destinos_vencimiento_idx
  ON public.alertas_zonales_destinos(vencimiento_destino_id)
  WHERE vencimiento_destino_id IS NOT NULL;

COMMIT;
