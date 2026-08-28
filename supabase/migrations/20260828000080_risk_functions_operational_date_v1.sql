-- =============================================================================
-- NOVEN · RISK FUNCTIONS OPERATIONAL DATE V1
--
-- Cierra residuos de la política legacy:
-- - CURRENT_DATE se reemplaza por fecha operacional Argentina.
-- - dias_donacion NULL significa fuera del circuito, nunca "seguro" inferido.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION noven_private.nivel_riesgo_vencimiento_zonal_v1(
  p_vencimiento_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_dias integer;
  v_dias_donacion integer;
  v_cantidad numeric;
  v_vmd numeric;
  v_dias_comerciales numeric;
  v_hay_riesgo boolean;
  v_hoy date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
BEGIN
  SELECT
    v.fecha_vencimiento - v_hoy,
    s.dias_donacion,
    v.cantidad,
    ps.venta_media_diaria
  INTO
    v_dias,
    v_dias_donacion,
    v_cantidad,
    v_vmd
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
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

  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_dias_donacion IS NULL THEN RETURN NULL; END IF;
  IF v_dias <= 0 THEN RETURN 'decomiso'; END IF;
  IF v_dias <= v_dias_donacion THEN RETURN 'donacion'; END IF;

  v_dias_comerciales := GREATEST(v_dias - v_dias_donacion, 0);
  v_hay_riesgo := v_vmd <= 0 OR (v_cantidad / NULLIF(v_vmd, 0)) > v_dias_comerciales;

  IF v_dias <= 20 AND v_hay_riesgo THEN RETURN 'urgente'; END IF;
  IF v_dias <= 45 AND v_hay_riesgo THEN RETURN 'radar'; END IF;
  RETURN 'seguro';
END;
$$;

COMMENT ON FUNCTION noven_private.nivel_riesgo_vencimiento_zonal_v1(uuid) IS
  'Calcula riesgo zonal con fecha operacional Argentina; devuelve NULL para vencimientos fuera del circuito.';

CREATE OR REPLACE FUNCTION noven_private.generar_radar_zonal_v1(
  p_vencimiento_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_org uuid;
  v_zona uuid;
  v_producto uuid;
  v_familia uuid;
  v_sucursal_origen uuid;
  v_fecha date;
  v_nivel text;
  v_alerta_id uuid;
BEGIN
  SELECT p.organizacion_id, s.zona_id, v.producto_id, p.familia_id, v.sucursal_id, v.fecha_vencimiento
  INTO v_org, v_zona, v_producto, v_familia, v_sucursal_origen, v_fecha
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  JOIN public.sucursales s ON s.id = v.sucursal_id AND s.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id AND v.activo = true;

  IF NOT FOUND OR v_familia IS NULL THEN RETURN NULL; END IF;

  v_nivel := noven_private.nivel_riesgo_vencimiento_zonal_v1(p_vencimiento_id);
  IF v_nivel IS NULL OR v_nivel = 'seguro' THEN RETURN NULL; END IF;

  INSERT INTO public.alertas_zonales(
    organizacion_id, zona_id, producto_id, familia_id, sucursal_origen_id,
    vencimiento_origen_id, fecha_vencimiento, nivel_origen, last_detected_at
  )
  VALUES(
    v_org, v_zona, v_producto, v_familia, v_sucursal_origen,
    p_vencimiento_id, v_fecha, v_nivel, now()
  )
  ON CONFLICT(zona_id, producto_id, fecha_vencimiento) DO UPDATE
  SET last_detected_at = now(),
      nivel_origen = CASE
        WHEN public.alertas_zonales.nivel_origen = 'decomiso' THEN 'decomiso'
        WHEN EXCLUDED.nivel_origen = 'decomiso' THEN 'decomiso'
        WHEN public.alertas_zonales.nivel_origen = 'donacion' THEN 'donacion'
        WHEN EXCLUDED.nivel_origen = 'donacion' THEN 'donacion'
        WHEN public.alertas_zonales.nivel_origen = 'urgente' THEN 'urgente'
        WHEN EXCLUDED.nivel_origen = 'urgente' THEN 'urgente'
        ELSE 'radar'
      END
  RETURNING id INTO v_alerta_id;

  INSERT INTO public.alertas_zonales_destinos(
    alerta_id, organizacion_id, zona_id, sucursal_id, usuario_id,
    stock_snapshot, stock_actualizado_at, estado, respuesta_at, vencimiento_destino_id
  )
  SELECT
    v_alerta_id,
    v_org,
    v_zona,
    sd.id,
    ufs.usuario_id,
    ps.stock_actual,
    ps.fecha_ultima_importacion,
    CASE
      WHEN vc.id IS NOT NULL THEN 'ya_controlado'
      WHEN ufs.usuario_id IS NULL OR ua.id IS NULL THEN 'sin_responsable'
      ELSE 'pendiente'
    END,
    CASE WHEN vc.id IS NOT NULL THEN now() ELSE NULL END,
    vc.id
  FROM public.sucursales sd
  JOIN public.producto_sucursal ps
    ON ps.sucursal_id = sd.id
   AND ps.organizacion_id = v_org
   AND ps.producto_id = v_producto
   AND ps.stock_actual > 0
  LEFT JOIN LATERAL (
    SELECT vx.id
    FROM public.vencimientos vx
    WHERE vx.sucursal_id = sd.id
      AND vx.producto_id = v_producto
      AND vx.activo = true
    ORDER BY vx.created_at DESC NULLS LAST, vx.id
    LIMIT 1
  ) vc ON true
  LEFT JOIN public.usuario_familias_sucursal ufs
    ON ufs.sucursal_id = sd.id
   AND ufs.organizacion_id = v_org
   AND ufs.familia_id = v_familia
   AND ufs.activo = true
  LEFT JOIN public.usuario_accesos ua
    ON ua.usuario_id = ufs.usuario_id
   AND ua.organizacion_id = v_org
   AND ua.sucursal_id = sd.id
   AND ua.rol = 'operador'
   AND ua.activo = true
  WHERE sd.organizacion_id = v_org
    AND sd.zona_id = v_zona
    AND sd.activa = true
    AND sd.id <> v_sucursal_origen
  ON CONFLICT(alerta_id, sucursal_id) DO UPDATE
  SET stock_snapshot = EXCLUDED.stock_snapshot,
      stock_actualizado_at = EXCLUDED.stock_actualizado_at,
      usuario_id = COALESCE(EXCLUDED.usuario_id, public.alertas_zonales_destinos.usuario_id),
      estado = CASE
        WHEN public.alertas_zonales_destinos.estado IN (
          'misma_fecha', 'otra_fecha', 'no_lo_tengo', 'ya_controlado', 'cerrada'
        ) THEN public.alertas_zonales_destinos.estado
        WHEN EXCLUDED.vencimiento_destino_id IS NOT NULL THEN 'ya_controlado'
        WHEN EXCLUDED.usuario_id IS NOT NULL THEN 'pendiente'
        ELSE 'sin_responsable'
      END,
      respuesta_at = CASE
        WHEN EXCLUDED.vencimiento_destino_id IS NOT NULL THEN now()
        ELSE public.alertas_zonales_destinos.respuesta_at
      END,
      vencimiento_destino_id = COALESCE(
        EXCLUDED.vencimiento_destino_id,
        public.alertas_zonales_destinos.vencimiento_destino_id
      );

  PERFORM noven_private.notificar_radar_zonal_async_v1(v_alerta_id);
  RETURN v_alerta_id;
END;
$$;

COMMENT ON FUNCTION noven_private.generar_radar_zonal_v1(uuid) IS
  'Genera Radar Zonal sólo cuando el vencimiento pertenece al circuito y su riesgo no es seguro.';

CREATE OR REPLACE FUNCTION public.recalcular_niveles_vencimientos()
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  filas integer;
BEGIN
  WITH op AS (
    SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy
  ),
  calc AS (
    SELECT
      ve.id,
      (ve.fecha_vencimiento - op.hoy) AS dias,
      s.dias_donacion,
      CASE
        WHEN ps.venta_media_diaria <= 0 THEN 'Infinity'::float8
        ELSE ve.cantidad::float8 / ps.venta_media_diaria::float8
      END AS dias_stock
    FROM public.vencimientos ve
    JOIN public.productos p ON p.id = ve.producto_id
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
    CROSS JOIN op
    WHERE ve.activo = true
      AND s.dias_donacion IS NOT NULL
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

COMMENT ON FUNCTION public.recalcular_niveles_vencimientos() IS
  'Recalcula sólo vencimientos dentro del circuito, usando fecha operacional Argentina y política explícita del sector.';

COMMIT;
