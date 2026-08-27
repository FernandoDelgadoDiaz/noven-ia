-- =============================================================================
-- NOVEN · RADAR ZONAL V1
--
-- Objetivo
-- -------
-- Convertir la colaboración informal entre sucursales de una zona en un flujo
-- selectivo, trazable y sin ruido:
--
--   * un vencimiento en riesgo detectado por una sucursal origina UN evento por
--     zona + producto + fecha;
--   * sólo se consideran otras sucursales de la misma zona con stock positivo;
--   * si la sucursal destino ya controla ese producto, queda como
--     `ya_controlado` y NO se notifica;
--   * si todavía no lo controla, la notificación se asigna exclusivamente al
--     operador responsable de la familia en esa sucursal;
--   * stock total nunca se interpreta como cantidad comprometida;
--   * el operador puede confirmar misma fecha, otra fecha, indicar que no lo
--     tiene o dejarlo para revisar después.
--
-- Santa Cruz Sur
-- ---------------
-- La zona confirmada tiene 15 sucursales comerciales. El depósito central NO se
-- incorpora como sucursal operativa de este circuito.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Maestro de zona Santa Cruz Sur y sus 15 sucursales comerciales
-- -----------------------------------------------------------------------------
UPDATE public.zonas
SET codigo = 'SCS',
    nombre = 'Santa Cruz Sur',
    updated_at = now()
WHERE id = '20000000-0000-4000-8000-000000000001'::uuid
  AND organizacion_id = '10000000-0000-4000-8000-000000000001'::uuid;

-- La 091 conserva su UUID legacy estable. Las restantes usan UUIDs deterministas
-- para que db reset / replay genere exactamente las mismas identidades.
INSERT INTO public.sucursales (id, nombre, direccion, activa, codigo, organizacion_id, zona_id)
VALUES
  ('30000000-0000-4000-8000-000000000072', 'Sucursal 072 · Río Gallegos', NULL, true, '072', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000033', 'Sucursal 033 · Río Gallegos', NULL, true, '033', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000183', 'Sucursal 183 · Río Gallegos', NULL, true, '183', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000200', 'Sucursal 200 · Río Gallegos', NULL, true, '200', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000199', 'Sucursal 199 · Río Gallegos', NULL, true, '199', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000205', 'Sucursal 205 · Río Gallegos', NULL, true, '205', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000360', 'Sucursal 360 · Río Gallegos', NULL, true, '360', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000043', 'Sucursal 043 · Río Gallegos', NULL, true, '043', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000198', 'Sucursal 198 · Río Gallegos', NULL, true, '198', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000124', 'Sucursal 124 · Río Gallegos', NULL, true, '124', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000161', 'Sucursal 161 · El Calafate', NULL, true, '161', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000131', 'Sucursal 131 · El Calafate', NULL, true, '131', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000204', 'Sucursal 204 · 28 de Noviembre', NULL, true, '204', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000138', 'Sucursal 138 · Río Turbio', NULL, true, '138', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')
ON CONFLICT (organizacion_id, codigo)
DO UPDATE SET
  nombre = EXCLUDED.nombre,
  zona_id = EXCLUDED.zona_id,
  activa = true;

-- -----------------------------------------------------------------------------
-- 2. Evento zonal: uno por zona + producto + fecha de vencimiento
-- -----------------------------------------------------------------------------
CREATE TABLE public.alertas_zonales (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id       uuid        NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  zona_id               uuid        NOT NULL,
  producto_id           uuid        NOT NULL,
  familia_id            uuid        NOT NULL,
  sucursal_origen_id    uuid        NOT NULL,
  vencimiento_origen_id uuid        NOT NULL REFERENCES public.vencimientos(id) ON DELETE RESTRICT,
  fecha_vencimiento     date        NOT NULL,
  nivel_origen          text        NOT NULL CHECK (nivel_origen IN ('radar','urgente','donacion','decomiso')),
  estado                text        NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','cerrada')),
  first_detected_at     timestamptz NOT NULL DEFAULT now(),
  last_detected_at      timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT alertas_zonales_zona_org_fk
    FOREIGN KEY (zona_id, organizacion_id)
    REFERENCES public.zonas(id, organizacion_id)
    ON DELETE CASCADE,
  CONSTRAINT alertas_zonales_sucursal_org_fk
    FOREIGN KEY (sucursal_origen_id, organizacion_id)
    REFERENCES public.sucursales(id, organizacion_id)
    ON DELETE RESTRICT,
  CONSTRAINT alertas_zonales_producto_org_fk
    FOREIGN KEY (producto_id, organizacion_id)
    REFERENCES public.productos(id, organizacion_id)
    ON DELETE RESTRICT,
  CONSTRAINT alertas_zonales_familia_org_fk
    FOREIGN KEY (familia_id, organizacion_id)
    REFERENCES public.familias(id, organizacion_id)
    ON DELETE RESTRICT,
  CONSTRAINT alertas_zonales_evento_uk
    UNIQUE (zona_id, producto_id, fecha_vencimiento)
);

CREATE INDEX alertas_zonales_zona_estado_idx
  ON public.alertas_zonales(zona_id, estado, last_detected_at DESC);
CREATE INDEX alertas_zonales_producto_idx
  ON public.alertas_zonales(producto_id, fecha_vencimiento DESC);
CREATE INDEX alertas_zonales_origen_idx
  ON public.alertas_zonales(sucursal_origen_id, created_at DESC);

CREATE TRIGGER alertas_zonales_set_updated_at
BEFORE UPDATE ON public.alertas_zonales
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Estado por sucursal candidata
-- -----------------------------------------------------------------------------
CREATE TABLE public.alertas_zonales_destinos (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id                uuid        NOT NULL REFERENCES public.alertas_zonales(id) ON DELETE CASCADE,
  organizacion_id          uuid        NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  zona_id                  uuid        NOT NULL,
  sucursal_id              uuid        NOT NULL,
  usuario_id               uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  stock_snapshot           integer     NOT NULL CHECK (stock_snapshot > 0),
  stock_actualizado_at     timestamptz,
  estado                   text        NOT NULL CHECK (estado IN (
                               'pendiente',
                               'revisar_despues',
                               'ya_controlado',
                               'misma_fecha',
                               'otra_fecha',
                               'no_lo_tengo',
                               'sin_responsable',
                               'sin_stock',
                               'cerrada'
                             )),
  notificada_at            timestamptz,
  respuesta_at             timestamptz,
  cantidad_confirmada      integer CHECK (cantidad_confirmada IS NULL OR cantidad_confirmada > 0),
  fecha_confirmada         date,
  vencimiento_destino_id   uuid REFERENCES public.vencimientos(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT alertas_zonales_destinos_zona_org_fk
    FOREIGN KEY (zona_id, organizacion_id)
    REFERENCES public.zonas(id, organizacion_id)
    ON DELETE CASCADE,
  CONSTRAINT alertas_zonales_destinos_sucursal_org_fk
    FOREIGN KEY (sucursal_id, organizacion_id)
    REFERENCES public.sucursales(id, organizacion_id)
    ON DELETE CASCADE,
  CONSTRAINT alertas_zonales_destinos_alerta_sucursal_uk
    UNIQUE (alerta_id, sucursal_id)
);

CREATE INDEX alertas_zonales_destinos_usuario_estado_idx
  ON public.alertas_zonales_destinos(usuario_id, estado, created_at DESC)
  WHERE usuario_id IS NOT NULL;
CREATE INDEX alertas_zonales_destinos_sucursal_estado_idx
  ON public.alertas_zonales_destinos(sucursal_id, estado, created_at DESC);
CREATE INDEX alertas_zonales_destinos_alerta_estado_idx
  ON public.alertas_zonales_destinos(alerta_id, estado);

CREATE TRIGGER alertas_zonales_destinos_set_updated_at
BEFORE UPDATE ON public.alertas_zonales_destinos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.alertas_zonales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_zonales_destinos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.alertas_zonales FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.alertas_zonales_destinos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.alertas_zonales TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.alertas_zonales_destinos TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Cálculo autoritativo del nivel actual para decidir si nace Radar Zonal
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
    COALESCE(s.dias_donacion, 10),
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

  IF v_dias <= 0 THEN
    RETURN 'decomiso';
  END IF;

  IF v_dias <= v_dias_donacion THEN
    RETURN 'donacion';
  END IF;

  v_dias_comerciales := GREATEST(v_dias - v_dias_donacion, 0);
  v_hay_riesgo := v_vmd <= 0 OR (v_cantidad / NULLIF(v_vmd, 0)) > v_dias_comerciales;

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

-- -----------------------------------------------------------------------------
-- 5. Push asíncrono: una llamada por evento, destinatarios resueltos en servidor
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION noven_private.notificar_radar_zonal_async_v1(
  p_alerta_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_webhook_secret text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.alertas_zonales_destinos d
    WHERE d.alerta_id = p_alerta_id
      AND d.estado = 'pendiente'
      AND d.usuario_id IS NOT NULL
      AND d.notificada_at IS NULL
  ) THEN
    RETURN;
  END IF;

  SELECT ds.decrypted_secret
  INTO v_webhook_secret
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'noven_push_webhook_secret'
  LIMIT 1;

  IF v_webhook_secret IS NULL OR v_webhook_secret = '' THEN
    RAISE WARNING 'NoVen Radar Zonal: secreto de push no disponible para alerta %', p_alerta_id;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://noven-ia.netlify.app/.netlify/functions/enviar-push-radar-zonal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_webhook_secret
    ),
    body := jsonb_build_object('alerta_zonal_id', p_alerta_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION noven_private.notificar_radar_zonal_async_v1(uuid)
  FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Generador idempotente del evento y de sus destinos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION noven_private.generar_radar_zonal_v1(
  p_vencimiento_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
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
  SELECT
    p.organizacion_id,
    s.zona_id,
    v.producto_id,
    p.familia_id,
    v.sucursal_id,
    v.fecha_vencimiento
  INTO
    v_org,
    v_zona,
    v_producto,
    v_familia,
    v_sucursal_origen,
    v_fecha
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  JOIN public.sucursales s
    ON s.id = v.sucursal_id
   AND s.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true;

  IF NOT FOUND OR v_familia IS NULL THEN
    RETURN NULL;
  END IF;

  v_nivel := noven_private.nivel_riesgo_vencimiento_zonal_v1(p_vencimiento_id);
  IF v_nivel = 'seguro' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.alertas_zonales (
    organizacion_id,
    zona_id,
    producto_id,
    familia_id,
    sucursal_origen_id,
    vencimiento_origen_id,
    fecha_vencimiento,
    nivel_origen,
    last_detected_at
  )
  VALUES (
    v_org,
    v_zona,
    v_producto,
    v_familia,
    v_sucursal_origen,
    p_vencimiento_id,
    v_fecha,
    v_nivel,
    now()
  )
  ON CONFLICT (zona_id, producto_id, fecha_vencimiento)
  DO UPDATE SET
    last_detected_at = now(),
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

  -- Sólo sucursales de la misma zona con stock positivo. El origen nunca se
  -- auto-notifica. Si existe cualquier vencimiento activo para ese SKU en el
  -- destino, se considera que el local ya está gestionando el producto.
  INSERT INTO public.alertas_zonales_destinos (
    alerta_id,
    organizacion_id,
    zona_id,
    sucursal_id,
    usuario_id,
    stock_snapshot,
    stock_actualizado_at,
    estado,
    respuesta_at,
    vencimiento_destino_id
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
  ON CONFLICT (alerta_id, sucursal_id)
  DO UPDATE SET
    stock_snapshot = EXCLUDED.stock_snapshot,
    stock_actualizado_at = EXCLUDED.stock_actualizado_at,
    usuario_id = COALESCE(EXCLUDED.usuario_id, public.alertas_zonales_destinos.usuario_id),
    estado = CASE
      WHEN public.alertas_zonales_destinos.estado IN ('misma_fecha','otra_fecha','no_lo_tengo','ya_controlado','cerrada')
        THEN public.alertas_zonales_destinos.estado
      WHEN EXCLUDED.vencimiento_destino_id IS NOT NULL
        THEN 'ya_controlado'
      WHEN EXCLUDED.usuario_id IS NOT NULL
        THEN 'pendiente'
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

REVOKE ALL ON FUNCTION noven_private.generar_radar_zonal_v1(uuid)
  FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Triggers: detección inmediata y actualización por stock importado
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION noven_private.trigger_generar_radar_zonal_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.activo = true THEN
    PERFORM noven_private.generar_radar_zonal_v1(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.trigger_generar_radar_zonal_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vencimientos_radar_zonal_v1 ON public.vencimientos;
CREATE TRIGGER vencimientos_radar_zonal_v1
AFTER INSERT OR UPDATE OF nivel_actual, fecha_vencimiento, cantidad, activo
ON public.vencimientos
FOR EACH ROW
EXECUTE FUNCTION noven_private.trigger_generar_radar_zonal_v1();

CREATE OR REPLACE FUNCTION noven_private.trigger_control_local_radar_zonal_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.activo = true THEN
    UPDATE public.alertas_zonales_destinos d
    SET estado = 'ya_controlado',
        respuesta_at = COALESCE(d.respuesta_at, now()),
        vencimiento_destino_id = NEW.id,
        updated_at = now()
    FROM public.alertas_zonales a
    WHERE a.id = d.alerta_id
      AND a.producto_id = NEW.producto_id
      AND d.sucursal_id = NEW.sucursal_id
      AND d.estado IN ('pendiente','revisar_despues','sin_responsable');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.trigger_control_local_radar_zonal_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vencimientos_control_local_radar_zonal_v1 ON public.vencimientos;
CREATE TRIGGER vencimientos_control_local_radar_zonal_v1
AFTER INSERT OR UPDATE OF activo
ON public.vencimientos
FOR EACH ROW
EXECUTE FUNCTION noven_private.trigger_control_local_radar_zonal_v1();

CREATE OR REPLACE FUNCTION noven_private.trigger_estado_producto_radar_zonal_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source record;
BEGIN
  IF NEW.stock_actual <= 0 THEN
    UPDATE public.alertas_zonales_destinos d
    SET estado = 'sin_stock',
        respuesta_at = COALESCE(d.respuesta_at, now()),
        updated_at = now()
    FROM public.alertas_zonales a
    WHERE a.id = d.alerta_id
      AND a.producto_id = NEW.producto_id
      AND d.sucursal_id = NEW.sucursal_id
      AND d.estado IN ('pendiente','revisar_despues','sin_responsable');
    RETURN NEW;
  END IF;

  -- En INSERT o cuando el stock pasa de cero a positivo, revisamos riesgos ya
  -- detectados en otros locales de la zona. Esto hace que una sucursal que se
  -- incorpora más tarde reciba alertas existentes sin re-subir nada especial.
  IF TG_OP = 'INSERT' OR OLD.stock_actual <= 0 THEN
    FOR v_source IN
      SELECT v.id
      FROM public.vencimientos v
      JOIN public.sucursales so ON so.id = v.sucursal_id
      JOIN public.sucursales sd ON sd.id = NEW.sucursal_id
      WHERE v.producto_id = NEW.producto_id
        AND v.activo = true
        AND v.sucursal_id <> NEW.sucursal_id
        AND so.organizacion_id = NEW.organizacion_id
        AND sd.organizacion_id = NEW.organizacion_id
        AND so.zona_id = sd.zona_id
    LOOP
      PERFORM noven_private.generar_radar_zonal_v1(v_source.id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.trigger_estado_producto_radar_zonal_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS producto_sucursal_radar_zonal_v1 ON public.producto_sucursal;
CREATE TRIGGER producto_sucursal_radar_zonal_v1
AFTER INSERT OR UPDATE OF stock_actual
ON public.producto_sucursal
FOR EACH ROW
EXECUTE FUNCTION noven_private.trigger_estado_producto_radar_zonal_v1();

-- -----------------------------------------------------------------------------
-- 8. Bandeja del operador: sólo sus propias alertas y su sucursal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl(
  p_sucursal_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'destino_id', d.id,
        'alerta_id', a.id,
        'estado', d.estado,
        'producto_id', a.producto_id,
        'cod_art', p.cod_art,
        'descripcion', p.descripcion,
        'marca', p.marca,
        'imagen_thumb_url', p.imagen_thumb_url,
        'familia_id', a.familia_id,
        'fecha_vencimiento', a.fecha_vencimiento,
        'nivel_origen', a.nivel_origen,
        'sucursal_origen_id', a.sucursal_origen_id,
        'sucursal_origen_codigo', so.codigo,
        'sucursal_origen_nombre', so.nombre,
        'sucursal_destino_id', d.sucursal_id,
        'sucursal_destino_codigo', sd.codigo,
        'stock_snapshot', d.stock_snapshot,
        'stock_actual', COALESCE(ps.stock_actual, d.stock_snapshot),
        'stock_actualizado_at', COALESCE(ps.fecha_ultima_importacion, d.stock_actualizado_at),
        'created_at', d.created_at
      ) AS item,
      d.created_at
    FROM public.alertas_zonales_destinos d
    JOIN public.alertas_zonales a ON a.id = d.alerta_id
    JOIN public.productos p ON p.id = a.producto_id
    JOIN public.sucursales so ON so.id = a.sucursal_origen_id
    JOIN public.sucursales sd ON sd.id = d.sucursal_id
    LEFT JOIN public.producto_sucursal ps
      ON ps.producto_id = a.producto_id
     AND ps.sucursal_id = d.sucursal_id
     AND ps.organizacion_id = d.organizacion_id
    WHERE d.usuario_id = v_uid
      AND d.estado IN ('pendiente','revisar_despues')
      AND (p_sucursal_id IS NULL OR d.sucursal_id = p_sucursal_id)
      AND EXISTS (
        SELECT 1
        FROM public.usuario_familias_sucursal ufs
        WHERE ufs.usuario_id = v_uid
          AND ufs.sucursal_id = d.sucursal_id
          AND ufs.familia_id = a.familia_id
          AND ufs.activo = true
      )
  ) q;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_mis_alertas_zonales_v1(
  p_sucursal_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.listar_mis_alertas_zonales_v1_impl(p_sucursal_id);
$$;

REVOKE ALL ON FUNCTION public.listar_mis_alertas_zonales_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_mis_alertas_zonales_v1(uuid)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 9. Respuesta del operador, atómica con el alta del vencimiento cuando aplica
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION noven_private.responder_alerta_zonal_v1_impl(
  p_destino_id uuid,
  p_respuesta text,
  p_cantidad integer DEFAULT NULL,
  p_fecha_otra date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_dest public.alertas_zonales_destinos%ROWTYPE;
  v_alerta public.alertas_zonales%ROWTYPE;
  v_vencimiento_existente uuid;
  v_vencimiento_nuevo uuid;
  v_fecha date;
  v_estado text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_respuesta NOT IN ('misma_fecha','otra_fecha','no_lo_tengo','revisar_despues') THEN
    RAISE EXCEPTION 'Respuesta de Radar Zonal inválida' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_dest
  FROM public.alertas_zonales_destinos
  WHERE id = p_destino_id
  FOR UPDATE;

  IF v_dest.id IS NULL THEN
    RAISE EXCEPTION 'Alerta zonal inexistente' USING ERRCODE = 'P0002';
  END IF;

  IF v_dest.usuario_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'La alerta no está asignada a este operador' USING ERRCODE = '42501';
  END IF;

  IF v_dest.estado NOT IN ('pendiente','revisar_despues') THEN
    RETURN jsonb_build_object('estado', v_dest.estado, 'ya_resuelta', true);
  END IF;

  SELECT * INTO v_alerta
  FROM public.alertas_zonales
  WHERE id = v_dest.alerta_id;

  IF p_respuesta = 'revisar_despues' THEN
    UPDATE public.alertas_zonales_destinos
    SET estado = 'revisar_despues', updated_at = now()
    WHERE id = p_destino_id;
    RETURN jsonb_build_object('estado', 'revisar_despues');
  END IF;

  IF p_respuesta = 'no_lo_tengo' THEN
    UPDATE public.alertas_zonales_destinos
    SET estado = 'no_lo_tengo', respuesta_at = now(), updated_at = now()
    WHERE id = p_destino_id;
    RETURN jsonb_build_object('estado', 'no_lo_tengo');
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad comprometida debe ser mayor a cero' USING ERRCODE = '22023';
  END IF;

  IF p_respuesta = 'otra_fecha' AND p_fecha_otra IS NULL THEN
    RAISE EXCEPTION 'La nueva fecha de vencimiento es obligatoria' USING ERRCODE = '22023';
  END IF;

  v_fecha := CASE
    WHEN p_respuesta = 'misma_fecha' THEN v_alerta.fecha_vencimiento
    ELSE p_fecha_otra
  END;

  -- Si apareció un control local mientras el usuario tenía abierta la alerta,
  -- no generamos un segundo vencimiento.
  SELECT v.id INTO v_vencimiento_existente
  FROM public.vencimientos v
  WHERE v.producto_id = v_alerta.producto_id
    AND v.sucursal_id = v_dest.sucursal_id
    AND v.activo = true
  ORDER BY v.created_at DESC NULLS LAST, v.id
  LIMIT 1;

  IF v_vencimiento_existente IS NOT NULL THEN
    UPDATE public.alertas_zonales_destinos
    SET estado = 'ya_controlado',
        respuesta_at = now(),
        vencimiento_destino_id = v_vencimiento_existente,
        updated_at = now()
    WHERE id = p_destino_id;

    RETURN jsonb_build_object(
      'estado', 'ya_controlado',
      'vencimiento_id', v_vencimiento_existente,
      'ya_resuelta', true
    );
  END IF;

  -- Reutilizamos el contrato operativo existente. El impl vuelve a validar
  -- auth.uid(), sucursal, familia y scope antes de escribir.
  SELECT noven_private.crear_vencimiento_operador_impl(
    v_alerta.producto_id,
    v_dest.sucursal_id,
    p_cantidad,
    v_fecha,
    NULL
  ) INTO v_vencimiento_nuevo;

  v_estado := CASE
    WHEN v_fecha = v_alerta.fecha_vencimiento THEN 'misma_fecha'
    ELSE 'otra_fecha'
  END;

  UPDATE public.alertas_zonales_destinos
  SET estado = v_estado,
      respuesta_at = now(),
      cantidad_confirmada = p_cantidad,
      fecha_confirmada = v_fecha,
      vencimiento_destino_id = v_vencimiento_nuevo,
      updated_at = now()
  WHERE id = p_destino_id;

  RETURN jsonb_build_object(
    'estado', v_estado,
    'vencimiento_id', v_vencimiento_nuevo,
    'fecha_vencimiento', v_fecha,
    'cantidad', p_cantidad
  );
END;
$$;

REVOKE ALL ON FUNCTION noven_private.responder_alerta_zonal_v1_impl(uuid,text,integer,date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.responder_alerta_zonal_v1_impl(uuid,text,integer,date)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.responder_alerta_zonal_v1(
  p_destino_id uuid,
  p_respuesta text,
  p_cantidad integer DEFAULT NULL,
  p_fecha_otra date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.responder_alerta_zonal_v1_impl(
    p_destino_id,
    p_respuesta,
    p_cantidad,
    p_fecha_otra
  );
$$;

REVOKE ALL ON FUNCTION public.responder_alerta_zonal_v1(uuid,text,integer,date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.responder_alerta_zonal_v1(uuid,text,integer,date)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. Resumen zonal/gerencial (backend listo para futura vista consolidada)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION noven_private.listar_resumen_radar_zonal_v1_impl(
  p_zona_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY last_detected_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'alerta_id', a.id,
        'zona_id', a.zona_id,
        'producto_id', a.producto_id,
        'cod_art', p.cod_art,
        'descripcion', p.descripcion,
        'fecha_vencimiento', a.fecha_vencimiento,
        'nivel_origen', a.nivel_origen,
        'sucursal_origen_codigo', so.codigo,
        'con_stock', count(d.id),
        'pendientes', count(*) FILTER (WHERE d.estado IN ('pendiente','revisar_despues')),
        'ya_controlados', count(*) FILTER (WHERE d.estado = 'ya_controlado'),
        'misma_fecha', count(*) FILTER (WHERE d.estado = 'misma_fecha'),
        'otra_fecha', count(*) FILTER (WHERE d.estado = 'otra_fecha'),
        'no_lo_tienen', count(*) FILTER (WHERE d.estado = 'no_lo_tengo'),
        'sin_responsable', count(*) FILTER (WHERE d.estado = 'sin_responsable')
      ) AS item,
      a.last_detected_at
    FROM public.alertas_zonales a
    JOIN public.productos p ON p.id = a.producto_id
    JOIN public.sucursales so ON so.id = a.sucursal_origen_id
    LEFT JOIN public.alertas_zonales_destinos d ON d.alerta_id = a.id
    WHERE (p_zona_id IS NULL OR a.zona_id = p_zona_id)
      AND (
        EXISTS (
          SELECT 1
          FROM public.usuario_accesos ua
          WHERE ua.usuario_id = v_uid
            AND ua.organizacion_id = a.organizacion_id
            AND ua.activo = true
            AND (
              ua.rol = 'admin_organizacion'
              OR (ua.rol = 'gerente_zonal' AND ua.zona_id = a.zona_id)
              OR (ua.rol IN ('gerente_sucursal','supervisor') AND ua.sucursal_id = a.sucursal_origen_id)
            )
        )
      )
    GROUP BY a.id, a.zona_id, a.producto_id, a.fecha_vencimiento, a.nivel_origen,
             a.last_detected_at, p.cod_art, p.descripcion, so.codigo
  ) q;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.listar_resumen_radar_zonal_v1_impl(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.listar_resumen_radar_zonal_v1_impl(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_resumen_radar_zonal_v1(
  p_zona_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.listar_resumen_radar_zonal_v1_impl(p_zona_id);
$$;

REVOKE ALL ON FUNCTION public.listar_resumen_radar_zonal_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_resumen_radar_zonal_v1(uuid)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 11. Bootstrap: crea eventos para riesgos actuales. Hoy sólo 091 tiene estado;
--     por lo tanto no genera ruido. Cuando nuevas sucursales importen stock, el
--     trigger de producto_sucursal incorporará sólo las candidatas pertinentes.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT id
    FROM public.vencimientos
    WHERE activo = true
  LOOP
    PERFORM noven_private.generar_radar_zonal_v1(v.id);
  END LOOP;
END;
$$;

COMMENT ON TABLE public.alertas_zonales IS
  'Radar Zonal: evento colaborativo único por zona, producto y fecha de vencimiento.';
COMMENT ON TABLE public.alertas_zonales_destinos IS
  'Estado de cada sucursal con stock positivo frente a un evento de Radar Zonal.';

COMMIT;
