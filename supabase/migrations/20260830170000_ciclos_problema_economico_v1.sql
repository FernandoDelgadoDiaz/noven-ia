-- Ciclo formal de problemas económicos de vencimiento.
-- Distingue un problema abierto de un vencimiento activo y registra cuándo
-- realmente deja de requerir gestión. Un regreso a SEGURO es resolución
-- operativa (vuelto_seguro), no un cierre terminal.

CREATE TABLE IF NOT EXISTS public.problemas_economicos_ciclos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL,
  sucursal_id uuid NOT NULL,
  vencimiento_id uuid NOT NULL REFERENCES public.vencimientos(id) ON DELETE RESTRICT,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,

  abierto_at timestamptz NOT NULL,
  abierto_por uuid,
  apertura_fuente text NOT NULL,
  apertura_metodo text NOT NULL CHECK (apertura_metodo IN ('evento', 'backfill_actual')),
  nivel_apertura text NOT NULL CHECK (nivel_apertura IN ('decomiso', 'donacion', 'urgente', 'radar')),
  cantidad_apertura numeric NOT NULL CHECK (cantidad_apertura >= 0),
  unidades_expuestas_apertura numeric NOT NULL CHECK (unidades_expuestas_apertura >= 0),
  costo_unitario_sin_iva_apertura numeric,
  dinero_en_riesgo_apertura numeric,

  ultimo_estado_at timestamptz NOT NULL,
  ultimo_actor uuid,
  ultima_fuente text NOT NULL,
  nivel_actual text,
  cantidad_actual numeric NOT NULL CHECK (cantidad_actual >= 0),
  unidades_expuestas_actual numeric NOT NULL CHECK (unidades_expuestas_actual >= 0),
  costo_unitario_sin_iva_actual numeric,
  dinero_en_riesgo_actual numeric,

  resuelto_at timestamptz,
  resuelto_por uuid,
  resolucion text CHECK (resolucion IN (
    'vuelto_seguro', 'vendido', 'donacion', 'decomiso',
    'anulado', 'fuera_circuito', 'inactivo_sin_resultado'
  )),
  resolucion_fuente text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT problemas_economicos_ciclos_resolucion_ck CHECK (
    (resuelto_at IS NULL AND resolucion IS NULL AND resolucion_fuente IS NULL)
    OR
    (resuelto_at IS NOT NULL AND resolucion IS NOT NULL AND resolucion_fuente IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS problemas_economicos_ciclos_un_abierto_v1
  ON public.problemas_economicos_ciclos(vencimiento_id)
  WHERE resuelto_at IS NULL;

CREATE INDEX IF NOT EXISTS problemas_economicos_ciclos_sucursal_estado_v1
  ON public.problemas_economicos_ciclos(sucursal_id, resuelto_at, abierto_at DESC);

CREATE INDEX IF NOT EXISTS problemas_economicos_ciclos_producto_v1
  ON public.problemas_economicos_ciclos(producto_id, abierto_at DESC);

ALTER TABLE public.problemas_economicos_ciclos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.problemas_economicos_ciclos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.problemas_economicos_ciclos TO service_role;

DROP TRIGGER IF EXISTS problemas_economicos_ciclos_set_updated_at ON public.problemas_economicos_ciclos;
CREATE TRIGGER problemas_economicos_ciclos_set_updated_at
BEFORE UPDATE ON public.problemas_economicos_ciclos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION noven_private.sincronizar_problema_economico_v1(
  p_vencimiento_id uuid,
  p_evento_at timestamptz DEFAULT now(),
  p_fuente text DEFAULT 'evento',
  p_apertura_metodo text DEFAULT 'evento'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid;
  v_sucursal uuid;
  v_producto uuid;
  v_activo boolean;
  v_cantidad numeric;
  v_fecha_vencimiento date;
  v_vmd numeric;
  v_dias_donacion integer;
  v_costo numeric;
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', p_evento_at))::date;
  v_dias integer;
  v_dias_comerciales integer;
  v_dias_stock numeric;
  v_nivel text;
  v_expuestas numeric := 0;
  v_dinero numeric;
  v_terminal record;
  v_anulacion record;
  v_resolucion text;
  v_resuelto_at timestamptz;
  v_resuelto_por uuid;
BEGIN
  IF p_apertura_metodo NOT IN ('evento', 'backfill_actual') THEN
    RAISE EXCEPTION 'Método de apertura inválido: %', p_apertura_metodo USING ERRCODE = '22023';
  END IF;

  SELECT
    p.organizacion_id,
    v.sucursal_id,
    v.producto_id,
    v.activo,
    v.cantidad::numeric,
    v.fecha_vencimiento,
    COALESCE(ps.venta_media_diaria, 0)::numeric,
    s.dias_donacion,
    c.costo_unitario::numeric
  INTO
    v_org, v_sucursal, v_producto, v_activo, v_cantidad,
    v_fecha_vencimiento, v_vmd, v_dias_donacion, v_costo
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  LEFT JOIN public.producto_sucursal ps
    ON ps.producto_id = v.producto_id
   AND ps.sucursal_id = v.sucursal_id
   AND ps.organizacion_id = p.organizacion_id
  LEFT JOIN public.familias f
    ON f.id = p.familia_id
   AND f.organizacion_id = p.organizacion_id
  LEFT JOIN public.sectores s
    ON s.id = f.sector_id
   AND s.organizacion_id = p.organizacion_id
  LEFT JOIN public.producto_costo_ultima_observacion c
    ON c.producto_id = v.producto_id
  WHERE v.id = p_vencimiento_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT v_activo THEN
    SELECT a.tipo, COALESCE(a.fecha, a.created_at) AS evento_at, a.usuario_id
      INTO v_terminal
    FROM public.acciones_operativas a
    WHERE a.vencimiento_id = p_vencimiento_id
      AND a.tipo IN ('vendido', 'donacion', 'decomiso')
    ORDER BY COALESCE(a.fecha, a.created_at) DESC, a.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_resolucion := v_terminal.tipo;
      v_resuelto_at := COALESCE(v_terminal.evento_at, p_evento_at);
      v_resuelto_por := v_terminal.usuario_id;
    ELSE
      SELECT o.observada_at AS evento_at, o.usuario_id
        INTO v_anulacion
      FROM public.vencimiento_observaciones o
      WHERE o.vencimiento_id = p_vencimiento_id
        AND o.nota ILIKE 'ANULACIÓN DE CARGA:%'
      ORDER BY o.observada_at DESC, o.id DESC
      LIMIT 1;

      IF FOUND THEN
        v_resolucion := 'anulado';
        v_resuelto_at := COALESCE(v_anulacion.evento_at, p_evento_at);
        v_resuelto_por := v_anulacion.usuario_id;
      ELSE
        -- No se inventa un resultado económico: queda explícito que sólo se
        -- observó un cierre técnico sin resultado terminal reconocido.
        v_resolucion := 'inactivo_sin_resultado';
        v_resuelto_at := p_evento_at;
        v_resuelto_por := v_actor;
      END IF;
    END IF;

    UPDATE public.problemas_economicos_ciclos
    SET resuelto_at = v_resuelto_at,
        resuelto_por = v_resuelto_por,
        resolucion = v_resolucion,
        resolucion_fuente = p_fuente,
        ultimo_estado_at = p_evento_at,
        ultimo_actor = v_actor,
        ultima_fuente = p_fuente,
        updated_at = now()
    WHERE vencimiento_id = p_vencimiento_id
      AND resuelto_at IS NULL;

    RETURN;
  END IF;

  IF v_dias_donacion IS NULL THEN
    UPDATE public.problemas_economicos_ciclos
    SET resuelto_at = p_evento_at,
        resuelto_por = v_actor,
        resolucion = 'fuera_circuito',
        resolucion_fuente = p_fuente,
        ultimo_estado_at = p_evento_at,
        ultimo_actor = v_actor,
        ultima_fuente = p_fuente,
        updated_at = now()
    WHERE vencimiento_id = p_vencimiento_id
      AND resuelto_at IS NULL;
    RETURN;
  END IF;

  v_dias := v_fecha_vencimiento - v_hoy;
  v_dias_comerciales := GREATEST(v_dias - v_dias_donacion, 0);
  v_dias_stock := CASE WHEN v_vmd <= 0 THEN 'Infinity'::numeric ELSE v_cantidad / v_vmd END;

  IF v_dias <= 0 THEN
    v_nivel := 'decomiso';
    v_expuestas := GREATEST(v_cantidad, 0);
  ELSIF v_dias <= v_dias_donacion THEN
    v_nivel := 'donacion';
    v_expuestas := GREATEST(v_cantidad, 0);
  ELSIF v_dias <= 20 AND v_dias_stock > v_dias_comerciales THEN
    v_nivel := 'urgente';
    v_expuestas := GREATEST(v_cantidad - GREATEST(v_vmd, 0) * v_dias_comerciales, 0);
  ELSIF v_dias <= 45 AND v_dias_stock > v_dias_comerciales THEN
    v_nivel := 'radar';
    v_expuestas := GREATEST(v_cantidad - GREATEST(v_vmd, 0) * v_dias_comerciales, 0);
  ELSE
    v_nivel := 'seguro';
    v_expuestas := 0;
  END IF;

  v_dinero := CASE WHEN v_costo IS NULL THEN NULL ELSE v_expuestas * v_costo END;

  IF v_nivel = 'seguro' THEN
    UPDATE public.problemas_economicos_ciclos
    SET resuelto_at = p_evento_at,
        resuelto_por = v_actor,
        resolucion = 'vuelto_seguro',
        resolucion_fuente = p_fuente,
        ultimo_estado_at = p_evento_at,
        ultimo_actor = v_actor,
        ultima_fuente = p_fuente,
        nivel_actual = 'seguro',
        cantidad_actual = GREATEST(v_cantidad, 0),
        unidades_expuestas_actual = 0,
        costo_unitario_sin_iva_actual = v_costo,
        dinero_en_riesgo_actual = 0,
        updated_at = now()
    WHERE vencimiento_id = p_vencimiento_id
      AND resuelto_at IS NULL;
    RETURN;
  END IF;

  INSERT INTO public.problemas_economicos_ciclos (
    organizacion_id, sucursal_id, vencimiento_id, producto_id,
    abierto_at, abierto_por, apertura_fuente, apertura_metodo,
    nivel_apertura, cantidad_apertura, unidades_expuestas_apertura,
    costo_unitario_sin_iva_apertura, dinero_en_riesgo_apertura,
    ultimo_estado_at, ultimo_actor, ultima_fuente, nivel_actual,
    cantidad_actual, unidades_expuestas_actual,
    costo_unitario_sin_iva_actual, dinero_en_riesgo_actual
  ) VALUES (
    v_org, v_sucursal, p_vencimiento_id, v_producto,
    p_evento_at, v_actor, p_fuente, p_apertura_metodo,
    v_nivel, GREATEST(v_cantidad, 0), v_expuestas,
    v_costo, v_dinero,
    p_evento_at, v_actor, p_fuente, v_nivel,
    GREATEST(v_cantidad, 0), v_expuestas,
    v_costo, v_dinero
  )
  ON CONFLICT (vencimiento_id) WHERE resuelto_at IS NULL
  DO UPDATE SET
    producto_id = EXCLUDED.producto_id,
    ultimo_estado_at = EXCLUDED.ultimo_estado_at,
    ultimo_actor = EXCLUDED.ultimo_actor,
    ultima_fuente = EXCLUDED.ultima_fuente,
    nivel_actual = EXCLUDED.nivel_actual,
    cantidad_actual = EXCLUDED.cantidad_actual,
    unidades_expuestas_actual = EXCLUDED.unidades_expuestas_actual,
    costo_unitario_sin_iva_actual = EXCLUDED.costo_unitario_sin_iva_actual,
    dinero_en_riesgo_actual = EXCLUDED.dinero_en_riesgo_actual,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION noven_private.sincronizar_problema_economico_v1(uuid,timestamptz,text,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION noven_private.trg_problema_economico_vencimiento_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM noven_private.sincronizar_problema_economico_v1(
    NEW.id,
    COALESCE(NEW.updated_at, NEW.created_at, now()),
    'vencimiento',
    'evento'
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.trg_problema_economico_vencimiento_v1() FROM PUBLIC;

DROP TRIGGER IF EXISTS vencimientos_problema_economico_v1 ON public.vencimientos;
CREATE TRIGGER vencimientos_problema_economico_v1
AFTER INSERT OR UPDATE OF cantidad, fecha_vencimiento, nivel_actual, producto_id, activo
ON public.vencimientos
FOR EACH ROW EXECUTE FUNCTION noven_private.trg_problema_economico_vencimiento_v1();

CREATE OR REPLACE FUNCTION noven_private.trg_problema_economico_producto_sucursal_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT v.id
    FROM public.vencimientos v
    WHERE v.producto_id = NEW.producto_id
      AND v.sucursal_id = NEW.sucursal_id
      AND v.activo = true
  LOOP
    PERFORM noven_private.sincronizar_problema_economico_v1(
      r.id,
      COALESCE(NEW.updated_at, now()),
      'producto_sucursal',
      'evento'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.trg_problema_economico_producto_sucursal_v1() FROM PUBLIC;

DROP TRIGGER IF EXISTS producto_sucursal_problema_economico_v1 ON public.producto_sucursal;
CREATE TRIGGER producto_sucursal_problema_economico_v1
AFTER INSERT OR UPDATE OF venta_media_diaria
ON public.producto_sucursal
FOR EACH ROW EXECUTE FUNCTION noven_private.trg_problema_economico_producto_sucursal_v1();

CREATE OR REPLACE FUNCTION noven_private.trg_problema_economico_costo_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT v.id
    FROM public.vencimientos v
    WHERE v.producto_id = NEW.producto_id
      AND v.activo = true
  LOOP
    PERFORM noven_private.sincronizar_problema_economico_v1(
      r.id,
      COALESCE(NEW.observado_at, now()),
      'costo_0258',
      'evento'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.trg_problema_economico_costo_v1() FROM PUBLIC;

DROP TRIGGER IF EXISTS producto_costo_problema_economico_v1 ON public.producto_costo_ultima_observacion;
CREATE TRIGGER producto_costo_problema_economico_v1
AFTER INSERT OR UPDATE OF costo_unitario, observado_at
ON public.producto_costo_ultima_observacion
FOR EACH ROW EXECUTE FUNCTION noven_private.trg_problema_economico_costo_v1();

CREATE OR REPLACE VIEW public.v_problemas_economicos_historial
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.organizacion_id,
  c.sucursal_id,
  c.vencimiento_id,
  c.producto_id,
  c.abierto_at,
  c.apertura_metodo,
  c.nivel_apertura,
  c.unidades_expuestas_apertura,
  c.dinero_en_riesgo_apertura,
  c.resuelto_at,
  c.resolucion,
  c.resolucion_fuente,
  CASE
    WHEN c.apertura_metodo = 'evento'
      THEN EXTRACT(EPOCH FROM (COALESCE(c.resuelto_at, now()) - c.abierto_at))
    ELSE NULL
  END AS segundos_hasta_resolucion,
  c.nivel_actual,
  c.unidades_expuestas_actual,
  c.dinero_en_riesgo_actual
FROM public.problemas_economicos_ciclos c;

REVOKE ALL ON public.v_problemas_economicos_historial FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_problemas_economicos_historial TO service_role;

COMMENT ON TABLE public.problemas_economicos_ciclos IS
  'Episodios formales de problema económico. Permite reaperturas y distingue volver a Seguro de un cierre terminal.';
COMMENT ON COLUMN public.problemas_economicos_ciclos.apertura_metodo IS
  'evento = inicio observado formalmente; backfill_actual = ya estaba abierto al activar esta capacidad, no usar como inicio histórico exacto.';
COMMENT ON VIEW public.v_problemas_economicos_historial IS
  'Historial server-only; tiempo de resolución sólo se calcula cuando la apertura fue observada como evento real.';

-- Backfill conservador: sólo problemas que están abiertos ahora. No se inventa
-- cuándo comenzaron; por eso quedan marcados como backfill_actual y su duración
-- no participa del tiempo histórico exacto.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT v.id
    FROM public.vencimientos v
    WHERE v.activo = true
  LOOP
    PERFORM noven_private.sincronizar_problema_economico_v1(
      r.id,
      now(),
      'backfill_actual',
      'backfill_actual'
    );
  END LOOP;
END;
$$;
