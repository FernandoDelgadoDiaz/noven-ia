-- =============================================================================
-- NOVEN · CIRCUITO RAG CENTRALIZADO · MODELO, ESTADOS Y PERMISOS V1
--
-- La solicitud es una decisión pendiente de ejecución, no una intervención.
-- Su identidad y la evidencia del motor son inmutables; cada cambio de estado
-- se agrega como evento. El tramo RAG sólo podrá vincularse al confirmar en
-- góndola, en un bloque posterior.
-- =============================================================================

BEGIN;

-- --- 1. Rol zonal de propósito único ----------------------------------------

ALTER TABLE public.usuario_accesos
  DROP CONSTRAINT usuario_accesos_rol_check,
  DROP CONSTRAINT usuario_accesos_scope_valido;

ALTER TABLE public.usuario_accesos
  ADD CONSTRAINT usuario_accesos_rol_check CHECK (
    rol IN (
      'admin_organizacion', 'gerente_zonal',
      'administrativa_precios_zonal', 'gerente_sucursal',
      'supervisor', 'operador'
    )
  ),
  ADD CONSTRAINT usuario_accesos_scope_valido CHECK (
    (rol = 'admin_organizacion' AND zona_id IS NULL AND sucursal_id IS NULL)
    OR
    (rol IN ('gerente_zonal', 'administrativa_precios_zonal')
      AND zona_id IS NOT NULL AND sucursal_id IS NULL)
    OR
    (rol IN ('gerente_sucursal', 'supervisor', 'operador')
      AND zona_id IS NULL AND sucursal_id IS NOT NULL)
  );

-- --- 2. Solicitud inmutable + evidencia del motor ---------------------------

-- Permite que la solicitud pruebe por FK que la sucursal pertenece a la zona
-- declarada, además de pertenecer a la organización.
ALTER TABLE public.sucursales
  ADD CONSTRAINT sucursales_id_zona_organizacion_uk
  UNIQUE (id, zona_id, organizacion_id);

CREATE TABLE public.solicitudes_cambio_rag (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id                 uuid NOT NULL
    REFERENCES public.organizaciones(id) ON DELETE RESTRICT,
  zona_id                         uuid NOT NULL,
  sucursal_id                     uuid NOT NULL,
  producto_id                     uuid NOT NULL,
  vencimiento_id                  uuid NOT NULL,
  solicitada_por                  uuid NOT NULL
    REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  porcentaje_rag_vigente          numeric(5,2),
  porcentaje_solicitado           numeric(5,2) NOT NULL,
  cobertura_al_sugerir            numeric,
  escalones_sugeridos             smallint NOT NULL,
  velocidad_observada             numeric,
  velocidad_necesaria             numeric,
  dias_comerciales_restantes      integer NOT NULL,
  cantidad_comprometida           numeric NOT NULL,
  vmd_glaciar                     numeric,
  fecha_vencimiento               date NOT NULL,
  fin_accion                      date NOT NULL,
  producto_codigo                 text NOT NULL,
  producto_descripcion            text NOT NULL,
  sector_nombre                   text NOT NULL,
  familia_nombre                  text NOT NULL,
  creada_at                       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT solicitudes_cambio_rag_zona_org_fk
    FOREIGN KEY (zona_id, organizacion_id)
    REFERENCES public.zonas(id, organizacion_id) ON DELETE RESTRICT,
  CONSTRAINT solicitudes_cambio_rag_sucursal_org_fk
    FOREIGN KEY (sucursal_id, organizacion_id)
    REFERENCES public.sucursales(id, organizacion_id) ON DELETE RESTRICT,
  CONSTRAINT solicitudes_cambio_rag_sucursal_zona_org_fk
    FOREIGN KEY (sucursal_id, zona_id, organizacion_id)
    REFERENCES public.sucursales(id, zona_id, organizacion_id) ON DELETE RESTRICT,
  CONSTRAINT solicitudes_cambio_rag_producto_org_fk
    FOREIGN KEY (producto_id, organizacion_id)
    REFERENCES public.productos(id, organizacion_id) ON DELETE RESTRICT,
  CONSTRAINT solicitudes_cambio_rag_vencimiento_scope_fk
    FOREIGN KEY (vencimiento_id, producto_id, sucursal_id)
    REFERENCES public.vencimientos(id, producto_id, sucursal_id) ON DELETE RESTRICT,
  CONSTRAINT solicitudes_cambio_rag_porcentaje_escala_fk
    FOREIGN KEY (organizacion_id, porcentaje_solicitado)
    REFERENCES public.rag_escala_descuento(organizacion_id, porcentaje) ON DELETE RESTRICT,
  CONSTRAINT solicitudes_cambio_rag_porcentaje_vigente_check CHECK (
    porcentaje_rag_vigente IS NULL
    OR (porcentaje_rag_vigente > 0 AND porcentaje_rag_vigente <= 100)
  ),
  CONSTRAINT solicitudes_cambio_rag_porcentaje_solicitado_check CHECK (
    porcentaje_solicitado > 0 AND porcentaje_solicitado <= 100
  ),
  CONSTRAINT solicitudes_cambio_rag_escalones_check CHECK (escalones_sugeridos >= 1),
  CONSTRAINT solicitudes_cambio_rag_cobertura_check CHECK (
    cobertura_al_sugerir IS NULL OR cobertura_al_sugerir >= 0
  ),
  CONSTRAINT solicitudes_cambio_rag_dias_check CHECK (dias_comerciales_restantes >= 0),
  CONSTRAINT solicitudes_cambio_rag_cantidad_check CHECK (cantidad_comprometida >= 0),
  CONSTRAINT solicitudes_cambio_rag_fechas_check CHECK (fin_accion <= fecha_vencimiento),
  CONSTRAINT solicitudes_cambio_rag_textos_check CHECK (
    btrim(producto_codigo) <> ''
    AND btrim(producto_descripcion) <> ''
    AND btrim(sector_nombre) <> ''
    AND btrim(familia_nombre) <> ''
  )
);

CREATE INDEX solicitudes_cambio_rag_zona_fecha_idx
  ON public.solicitudes_cambio_rag(zona_id, creada_at DESC);
CREATE INDEX solicitudes_cambio_rag_sucursal_fecha_idx
  ON public.solicitudes_cambio_rag(sucursal_id, creada_at DESC);
CREATE INDEX solicitudes_cambio_rag_vencimiento_fecha_idx
  ON public.solicitudes_cambio_rag(vencimiento_id, creada_at DESC);

COMMENT ON TABLE public.solicitudes_cambio_rag IS
  'Solicitud RAG inmutable: conserva la sugerencia validada y sus insumos; no abre una intervención.';

-- --- 3. Historial append-only y máquina de estados --------------------------

CREATE TABLE public.solicitud_cambio_rag_eventos (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id       uuid NOT NULL
    REFERENCES public.solicitudes_cambio_rag(id) ON DELETE RESTRICT,
  tipo               text NOT NULL CHECK (
    tipo IN ('solicitada', 'ejecutada', 'confirmada', 'no_aplicada')
  ),
  actor_id            uuid NOT NULL
    REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ocurrida_at         timestamptz NOT NULL DEFAULT now(),
  habilitada_desde    date,
  nota                text,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT solicitud_cambio_rag_eventos_habilitacion_check CHECK (
    (tipo = 'ejecutada' AND habilitada_desde IS NOT NULL)
    OR (tipo <> 'ejecutada' AND habilitada_desde IS NULL)
  )
);

CREATE INDEX solicitud_cambio_rag_eventos_solicitud_idx
  ON public.solicitud_cambio_rag_eventos(solicitud_id, id DESC);
CREATE INDEX solicitud_cambio_rag_eventos_actor_fecha_idx
  ON public.solicitud_cambio_rag_eventos(actor_id, ocurrida_at DESC);

COMMENT ON TABLE public.solicitud_cambio_rag_eventos IS
  'Historial append-only. Secuencia válida: solicitada → ejecutada → confirmada|no_aplicada; no_aplicada puede volver a ejecutada.';
COMMENT ON COLUMN public.solicitud_cambio_rag_eventos.habilitada_desde IS
  'Fecha operativa mínima para confirmar en góndola; se fija al ejecutar y no se recalcula.';

CREATE OR REPLACE FUNCTION noven_private.bloquear_mutacion_historial_rag_centralizado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'El circuito RAG centralizado es inmutable; agregue un evento'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER solicitudes_cambio_rag_inmutables
  BEFORE UPDATE OR DELETE ON public.solicitudes_cambio_rag
  FOR EACH ROW EXECUTE FUNCTION noven_private.bloquear_mutacion_historial_rag_centralizado();

CREATE TRIGGER solicitud_cambio_rag_eventos_inmutables
  BEFORE UPDATE OR DELETE ON public.solicitud_cambio_rag_eventos
  FOR EACH ROW EXECUTE FUNCTION noven_private.bloquear_mutacion_historial_rag_centralizado();

CREATE OR REPLACE FUNCTION noven_private.validar_evento_solicitud_cambio_rag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_solicitud public.solicitudes_cambio_rag%ROWTYPE;
  v_anterior public.solicitud_cambio_rag_eventos%ROWTYPE;
  v_rol_valido boolean := false;
  v_fecha_evento date;
BEGIN
  v_fecha_evento := (NEW.ocurrida_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  SELECT * INTO v_solicitud
  FROM public.solicitudes_cambio_rag s
  WHERE s.id = NEW.solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud RAG inexistente' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_anterior
  FROM public.solicitud_cambio_rag_eventos e
  WHERE e.solicitud_id = NEW.solicitud_id
  ORDER BY e.id DESC
  LIMIT 1;

  IF (v_anterior.id IS NULL AND NEW.tipo <> 'solicitada')
    OR (v_anterior.tipo = 'solicitada' AND NEW.tipo <> 'ejecutada')
    OR (v_anterior.tipo = 'ejecutada' AND NEW.tipo NOT IN ('confirmada', 'no_aplicada'))
    OR (v_anterior.tipo = 'no_aplicada' AND NEW.tipo <> 'ejecutada')
    OR v_anterior.tipo = 'confirmada'
  THEN
    RAISE EXCEPTION 'Transición RAG centralizada inválida: % → %',
      coalesce(v_anterior.tipo, 'inicio'), NEW.tipo USING ERRCODE = '23514';
  END IF;

  IF NEW.ocurrida_at < v_solicitud.creada_at
    OR (v_anterior.id IS NOT NULL AND NEW.ocurrida_at < v_anterior.ocurrida_at)
  THEN
    RAISE EXCEPTION 'Los eventos RAG centralizados deben conservar orden temporal'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.tipo = 'ejecutada' AND NEW.habilitada_desde <> v_fecha_evento + 1 THEN
    RAISE EXCEPTION 'La ejecución debe habilitarse exactamente el día operativo siguiente'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.tipo IN ('confirmada', 'no_aplicada')
    AND v_fecha_evento < v_anterior.habilitada_desde
  THEN
    RAISE EXCEPTION 'La verificación en góndola todavía no está habilitada'
      USING ERRCODE = '23514';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = v_solicitud.organizacion_id
     AND ua.activo = true
    LEFT JOIN public.productos p ON p.id = v_solicitud.producto_id
    WHERE u.id = NEW.actor_id
      AND u.activo = true
      AND (
        (NEW.tipo = 'solicitada'
          AND ua.rol IN ('gerente_sucursal', 'supervisor')
          AND ua.sucursal_id = v_solicitud.sucursal_id)
        OR
        (NEW.tipo = 'ejecutada'
          AND ua.rol = 'administrativa_precios_zonal'
          AND ua.zona_id = v_solicitud.zona_id)
        OR
        (NEW.tipo IN ('confirmada', 'no_aplicada')
          AND ua.sucursal_id = v_solicitud.sucursal_id
          AND (
            ua.rol IN ('gerente_sucursal', 'supervisor')
            OR (
              ua.rol = 'operador'
              AND EXISTS (
                SELECT 1
                FROM public.usuario_familias_sucursal ufs
                WHERE ufs.usuario_id = NEW.actor_id
                  AND ufs.organizacion_id = v_solicitud.organizacion_id
                  AND ufs.sucursal_id = v_solicitud.sucursal_id
                  AND ufs.familia_id = p.familia_id
                  AND ufs.activo = true
              )
            )
          ))
      )
  ) INTO v_rol_valido;

  IF NOT v_rol_valido THEN
    RAISE EXCEPTION 'Actor sin permiso para esta transición RAG centralizada'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.tipo = 'solicitada' AND NEW.actor_id <> v_solicitud.solicitada_por THEN
    RAISE EXCEPTION 'El primer evento debe pertenecer a quien creó la solicitud'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER solicitud_cambio_rag_eventos_validar
  BEFORE INSERT ON public.solicitud_cambio_rag_eventos
  FOR EACH ROW EXECUTE FUNCTION noven_private.validar_evento_solicitud_cambio_rag();

-- --- 4. Lectura estrictamente acotada al circuito ---------------------------

CREATE OR REPLACE FUNCTION noven_private.puede_ver_solicitud_cambio_rag(
  p_organizacion_id uuid,
  p_zona_id uuid,
  p_sucursal_id uuid,
  p_producto_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    noven_private.puede_ver_producto_sucursal(p_sucursal_id, p_producto_id)
    OR EXISTS (
      SELECT 1
      FROM public.usuarios u
      JOIN public.usuario_accesos ua
        ON ua.usuario_id = u.id
       AND ua.organizacion_id = p_organizacion_id
       AND ua.rol = 'administrativa_precios_zonal'
       AND ua.zona_id = p_zona_id
       AND ua.sucursal_id IS NULL
       AND ua.activo = true
      WHERE u.id = (SELECT auth.uid())
        AND u.activo = true
    );
$$;

REVOKE ALL ON FUNCTION noven_private.puede_ver_solicitud_cambio_rag(uuid,uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.solicitudes_cambio_rag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitud_cambio_rag_eventos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.solicitudes_cambio_rag
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.solicitud_cambio_rag_eventos
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.solicitud_cambio_rag_eventos_id_seq
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.solicitudes_cambio_rag TO authenticated;
GRANT SELECT ON TABLE public.solicitud_cambio_rag_eventos TO authenticated;

CREATE POLICY solicitudes_cambio_rag_select_scope
  ON public.solicitudes_cambio_rag
  FOR SELECT TO authenticated
  USING (noven_private.puede_ver_solicitud_cambio_rag(
    organizacion_id, zona_id, sucursal_id, producto_id
  ));

CREATE POLICY solicitud_cambio_rag_eventos_select_scope
  ON public.solicitud_cambio_rag_eventos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.solicitudes_cambio_rag s
    WHERE s.id = solicitud_id
      AND noven_private.puede_ver_solicitud_cambio_rag(
        s.organizacion_id, s.zona_id, s.sucursal_id, s.producto_id
      )
  ));

-- El estado actual es una proyección; la fuente sigue siendo el historial.
CREATE VIEW public.v_solicitudes_cambio_rag_actual
WITH (security_invoker = true)
AS
SELECT
  s.*,
  ultimo.tipo AS ultimo_evento,
  ultimo.actor_id AS ultimo_actor_id,
  ultimo.ocurrida_at AS ultimo_evento_at,
  ultimo.habilitada_desde,
  CASE
    WHEN ultimo.tipo = 'ejecutada'
      AND (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
          < ultimo.habilitada_desde
      THEN 'ejecutada_no_habilitada'
    WHEN ultimo.tipo = 'ejecutada' THEN 'lista_confirmacion'
    ELSE ultimo.tipo
  END AS estado_actual
FROM public.solicitudes_cambio_rag s
LEFT JOIN LATERAL (
  SELECT e.tipo, e.actor_id, e.ocurrida_at, e.habilitada_desde
  FROM public.solicitud_cambio_rag_eventos e
  WHERE e.solicitud_id = s.id
  ORDER BY e.id DESC
  LIMIT 1
) ultimo ON true;

REVOKE ALL ON TABLE public.v_solicitudes_cambio_rag_actual
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_solicitudes_cambio_rag_actual TO authenticated;

-- El vínculo no abre el tramo. Queda nullable para historia y se llenará sólo
-- en la futura RPC de confirmación en góndola.
ALTER TABLE public.intervenciones_rag
  ADD COLUMN solicitud_cambio_rag_id uuid,
  ADD CONSTRAINT intervenciones_rag_solicitud_cambio_fk
    FOREIGN KEY (solicitud_cambio_rag_id)
    REFERENCES public.solicitudes_cambio_rag(id) ON DELETE RESTRICT,
  ADD CONSTRAINT intervenciones_rag_solicitud_cambio_uk
    UNIQUE (solicitud_cambio_rag_id);

REVOKE ALL ON FUNCTION noven_private.bloquear_mutacion_historial_rag_centralizado()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION noven_private.validar_evento_solicitud_cambio_rag()
  FROM PUBLIC, anon, authenticated;

COMMIT;
