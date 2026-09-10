-- =============================================================================
-- NOVEN · RAG CENTRALIZADO · JORNADA ZONAL, CORTE DE VISIBILIDAD Y EXPORTACIÓN
--
-- Bloque 3B. Extiende la bandeja zonal de 3A con los tiempos reales del
-- circuito:
--
-- - cada zona configura su ventana de recepción (por defecto 08:00 a 12:00);
-- - la jornada de cada solicitud se resuelve en el servidor, en horario
--   argentino, y queda persistida junto al resto del snapshot inmutable;
-- - una solicitud anterior al inicio espera y aparece al abrir la ventana;
--   una registrada desde el corte queda diferida a la jornada siguiente;
-- - la administrativa no puede ejecutar lo que todavía no le corresponde ver.
--
-- No abre intervenciones, no confirma góndola y no toca precios.
-- =============================================================================

BEGIN;

-- --- 1. La ventana de recepción es configuración de la zona -----------------

-- Los valores por defecto son la política del circuito, no datos sembrados:
-- se aplican por igual a toda zona existente y futura, y cada zona puede
-- apartarse de ellos con la RPC de configuración.
ALTER TABLE public.zonas
  ADD COLUMN rag_jornada_inicio time NOT NULL DEFAULT '08:00',
  ADD COLUMN rag_jornada_corte  time NOT NULL DEFAULT '12:00',
  ADD CONSTRAINT zonas_rag_jornada_orden_check
    CHECK (rag_jornada_inicio < rag_jornada_corte);

COMMENT ON COLUMN public.zonas.rag_jornada_inicio IS
  'Hora argentina en que la bandeja zonal abre la jornada; antes las solicitudes del día esperan.';
COMMENT ON COLUMN public.zonas.rag_jornada_corte IS
  'Hora argentina de corte; desde ella toda solicitud nueva se difiere a la jornada siguiente.';

-- --- 2. Una sola fuente para decidir a qué jornada pertenece un momento -----

CREATE OR REPLACE FUNCTION noven_private.jornada_rag_zonal_v1(
  p_zona_id uuid,
  p_momento timestamptz
)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (p_momento AT TIME ZONE 'America/Argentina/Buenos_Aires')::time
         >= z.rag_jornada_corte
      THEN (p_momento AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 1
    ELSE (p_momento AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
  END
  FROM public.zonas z
  WHERE z.id = p_zona_id;
$$;

COMMENT ON FUNCTION noven_private.jornada_rag_zonal_v1(uuid, timestamptz) IS
  'Jornada zonal de un momento dado: el mismo día hasta el corte, el siguiente desde el corte. La hora del dispositivo no participa.';

-- --- 3. La jornada asignada forma parte del snapshot inmutable --------------

ALTER TABLE public.solicitudes_cambio_rag
  ADD COLUMN jornada_zonal date;

-- La reconstrucción de las solicitudes ya registradas no inventa un dato:
-- aplica la misma regla sobre `creada_at`, que sí es un hecho registrado. El
-- bloqueo de inmutabilidad se suspende sólo para este relleno y se restablece
-- dentro de la misma transacción.
ALTER TABLE public.solicitudes_cambio_rag
  DISABLE TRIGGER solicitudes_cambio_rag_inmutables;

UPDATE public.solicitudes_cambio_rag s
SET jornada_zonal = noven_private.jornada_rag_zonal_v1(s.zona_id, s.creada_at)
WHERE s.jornada_zonal IS NULL;

ALTER TABLE public.solicitudes_cambio_rag
  ENABLE TRIGGER solicitudes_cambio_rag_inmutables;

ALTER TABLE public.solicitudes_cambio_rag
  ALTER COLUMN jornada_zonal SET NOT NULL,
  ADD CONSTRAINT solicitudes_cambio_rag_jornada_no_anterior_check
    CHECK (
      jornada_zonal
      >= (creada_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    );

CREATE INDEX solicitudes_cambio_rag_zona_jornada_idx
  ON public.solicitudes_cambio_rag(zona_id, jornada_zonal);

COMMENT ON COLUMN public.solicitudes_cambio_rag.jornada_zonal IS
  'Jornada zonal a la que quedó asignada la solicitud al crearse; nunca se recalcula.';

-- --- 4. La proyección de estado expone la jornada asignada ------------------

-- Se enumeran las columnas en su orden original y la nueva se agrega al final,
-- para que CREATE OR REPLACE conserve la vista y su ACL. Las reloptions no
-- sobreviven a un reemplazo, así que `security_invoker` se vuelve a fijar.
CREATE OR REPLACE VIEW public.v_solicitudes_cambio_rag_actual AS
SELECT
  s.id,
  s.organizacion_id,
  s.zona_id,
  s.sucursal_id,
  s.producto_id,
  s.vencimiento_id,
  s.solicitada_por,
  s.porcentaje_rag_vigente,
  s.porcentaje_solicitado,
  s.cobertura_al_sugerir,
  s.escalones_sugeridos,
  s.velocidad_observada,
  s.velocidad_necesaria,
  s.dias_comerciales_restantes,
  s.cantidad_comprometida,
  s.vmd_glaciar,
  s.fecha_vencimiento,
  s.fin_accion,
  s.producto_codigo,
  s.producto_descripcion,
  s.sector_nombre,
  s.familia_nombre,
  s.creada_at,
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
  END AS estado_actual,
  s.jornada_zonal
FROM public.solicitudes_cambio_rag s
LEFT JOIN LATERAL (
  SELECT e.tipo, e.actor_id, e.ocurrida_at, e.habilitada_desde
  FROM public.solicitud_cambio_rag_eventos e
  WHERE e.solicitud_id = s.id
  ORDER BY e.id DESC
  LIMIT 1
) ultimo ON true;

ALTER VIEW public.v_solicitudes_cambio_rag_actual
  SET (security_invoker = true);

REVOKE ALL ON TABLE public.v_solicitudes_cambio_rag_actual
  FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.v_solicitudes_cambio_rag_actual FROM authenticated;
GRANT SELECT ON TABLE public.v_solicitudes_cambio_rag_actual TO authenticated;

-- --- 5. Crear la solicitud asigna su jornada en el servidor -----------------

CREATE OR REPLACE FUNCTION noven_private.solicitar_cambio_rag_impl(
  p_vencimiento_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid                         uuid := (SELECT auth.uid());
  v_organizacion_id             uuid;
  v_zona_id                     uuid;
  v_sucursal_id                 uuid;
  v_producto_id                 uuid;
  v_porcentaje_vigente          numeric(5,2);
  v_porcentaje_solicitado       numeric(5,2);
  v_cobertura                   numeric;
  v_velocidad_observada         numeric;
  v_velocidad_necesaria         numeric;
  v_dias_comerciales_restantes  integer;
  v_cantidad_comprometida       numeric;
  v_vmd_glaciar                 numeric;
  v_fecha_vencimiento           date;
  v_fin_accion                  date;
  v_producto_codigo             text;
  v_producto_descripcion        text;
  v_sector_nombre               text;
  v_familia_nombre              text;
  v_creada_at                   timestamptz;
  v_jornada_zonal               date;
  v_solicitud_id                uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  -- Serializa doble click y solicitudes simultáneas sobre el mismo vencimiento.
  SELECT p.organizacion_id, s.zona_id, v.sucursal_id, v.producto_id
  INTO v_organizacion_id, v_zona_id, v_sucursal_id, v_producto_id
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  JOIN public.sucursales s
    ON s.id = v.sucursal_id
   AND s.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true
    AND p.activo = true
    AND s.activa = true
  FOR UPDATE OF v;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = v_organizacion_id
     AND ua.sucursal_id = v_sucursal_id
     AND ua.zona_id IS NULL
     AND ua.rol IN ('gerente_sucursal', 'supervisor')
     AND ua.activo = true
    WHERE u.id = v_uid
      AND u.activo = true
  ) THEN
    RAISE EXCEPTION 'Sólo un gerente o supervisor de la sucursal puede validar la sugerencia'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotencia: una solicitud abierta conserva su identidad, su snapshot y la
  -- jornada zonal que se le asignó al crearse.
  SELECT s.id
  INTO v_solicitud_id
  FROM public.solicitudes_cambio_rag s
  JOIN LATERAL (
    SELECT e.tipo
    FROM public.solicitud_cambio_rag_eventos e
    WHERE e.solicitud_id = s.id
    ORDER BY e.id DESC
    LIMIT 1
  ) ultimo ON true
  WHERE s.vencimiento_id = p_vencimiento_id
    AND ultimo.tipo <> 'confirmada'
  ORDER BY s.creada_at DESC
  LIMIT 1;

  IF v_solicitud_id IS NOT NULL THEN
    RETURN v_solicitud_id;
  END IF;

  -- El próximo porcentaje se deriva de la escala autorizada. La RPC no acepta
  -- porcentaje, rol, alcance ni métricas provenientes del cliente.
  SELECT
    sg.rag_porcentaje,
    escala.porcentaje,
    sg.velocidad_observada / NULLIF(sg.velocidad_necesaria, 0),
    sg.velocidad_observada,
    sg.velocidad_necesaria,
    sg.dias_comerciales_restantes,
    sg.cantidad_actual_estimacion,
    sg.vmd_glaciar_actual,
    sg.fecha_vencimiento,
    sg.fecha_vencimiento - sg.dias_donacion,
    p.cod_art,
    p.descripcion,
    sg.sector_nombre,
    f.nombre
  INTO
    v_porcentaje_vigente,
    v_porcentaje_solicitado,
    v_cobertura,
    v_velocidad_observada,
    v_velocidad_necesaria,
    v_dias_comerciales_restantes,
    v_cantidad_comprometida,
    v_vmd_glaciar,
    v_fecha_vencimiento,
    v_fin_accion,
    v_producto_codigo,
    v_producto_descripcion,
    v_sector_nombre,
    v_familia_nombre
  FROM public.v_seguimiento_rag_actual sg
  JOIN public.productos p
    ON p.id = sg.producto_id
   AND p.organizacion_id = sg.organizacion_id
  JOIN public.familias f
    ON f.id = p.familia_id
   AND f.organizacion_id = sg.organizacion_id
  JOIN LATERAL (
    SELECT r.porcentaje
    FROM public.rag_escala_descuento r
    WHERE r.organizacion_id = sg.organizacion_id
      AND r.porcentaje > sg.rag_porcentaje
    ORDER BY r.porcentaje ASC
    LIMIT 1
  ) escala ON true
  WHERE sg.vencimiento_id = p_vencimiento_id
    AND sg.organizacion_id = v_organizacion_id
    AND sg.sucursal_id = v_sucursal_id
    AND sg.producto_id = v_producto_id
    AND sg.estado_seguimiento_rag IN ('insuficiente', 'sin_movimiento')
    AND sg.rag_porcentaje IS NOT NULL
    AND sg.velocidad_observada IS NOT NULL
    AND sg.velocidad_necesaria IS NOT NULL
    AND sg.velocidad_necesaria > 0
    AND sg.velocidad_observada < sg.velocidad_necesaria
    AND sg.dias_comerciales_restantes > 0
    AND sg.dias_observados IS NOT NULL
    AND sg.dias_observados * sg.velocidad_necesaria >= 1
    AND sg.dias_desde_ultimo_rag IS NOT NULL
    AND sg.dias_desde_ultimo_rag * sg.velocidad_necesaria >= 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay una sugerencia RAG vigente y validable para este producto'
      USING ERRCODE = '22023';
  END IF;

  -- Un único instante gobierna la fila y su jornada: si se tomaran por separado
  -- podrían caer a lados distintos del corte.
  v_creada_at := clock_timestamp();
  v_jornada_zonal := noven_private.jornada_rag_zonal_v1(v_zona_id, v_creada_at);

  IF v_jornada_zonal IS NULL THEN
    RAISE EXCEPTION 'La zona de la sucursal no tiene jornada zonal configurada'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.solicitudes_cambio_rag (
    organizacion_id,
    zona_id,
    sucursal_id,
    producto_id,
    vencimiento_id,
    solicitada_por,
    porcentaje_rag_vigente,
    porcentaje_solicitado,
    cobertura_al_sugerir,
    escalones_sugeridos,
    velocidad_observada,
    velocidad_necesaria,
    dias_comerciales_restantes,
    cantidad_comprometida,
    vmd_glaciar,
    fecha_vencimiento,
    fin_accion,
    producto_codigo,
    producto_descripcion,
    sector_nombre,
    familia_nombre,
    creada_at,
    jornada_zonal
  ) VALUES (
    v_organizacion_id,
    v_zona_id,
    v_sucursal_id,
    v_producto_id,
    p_vencimiento_id,
    v_uid,
    v_porcentaje_vigente,
    v_porcentaje_solicitado,
    v_cobertura,
    1,
    v_velocidad_observada,
    v_velocidad_necesaria,
    v_dias_comerciales_restantes,
    v_cantidad_comprometida,
    v_vmd_glaciar,
    v_fecha_vencimiento,
    v_fin_accion,
    v_producto_codigo,
    v_producto_descripcion,
    v_sector_nombre,
    v_familia_nombre,
    v_creada_at,
    v_jornada_zonal
  )
  RETURNING id INTO v_solicitud_id;

  INSERT INTO public.solicitud_cambio_rag_eventos (
    solicitud_id,
    tipo,
    actor_id
  ) VALUES (
    v_solicitud_id,
    'solicitada',
    v_uid
  );

  RETURN v_solicitud_id;
END;
$$;

-- --- 6. La bandeja muestra la jornada visible, no todo lo registrado --------

CREATE OR REPLACE FUNCTION noven_private.listar_bandeja_rag_zonal_impl()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid   uuid := (SELECT auth.uid());
  v_local timestamp := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.rol = 'administrativa_precios_zonal'
     AND ua.zona_id IS NOT NULL
     AND ua.sucursal_id IS NULL
     AND ua.activo = true
    WHERE u.id = v_uid AND u.activo = true
  ) THEN
    RAISE EXCEPTION 'Sin permiso para la bandeja zonal de precios'
      USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH zonas_actor AS (
      SELECT DISTINCT
        z.id, z.codigo, z.nombre, z.organizacion_id,
        z.rag_jornada_inicio, z.rag_jornada_corte
      FROM public.usuario_accesos ua
      JOIN public.usuarios u
        ON u.id = ua.usuario_id AND u.activo = true
      JOIN public.zonas z
        ON z.id = ua.zona_id
       AND z.organizacion_id = ua.organizacion_id
       AND z.activa = true
      WHERE ua.usuario_id = v_uid
        AND ua.rol = 'administrativa_precios_zonal'
        AND ua.sucursal_id IS NULL
        AND ua.activo = true
    ),
    jornada AS (
      SELECT
        za.*,
        v_local::date AS hoy,
        -- Antes del inicio la jornada del día todavía no abrió: lo registrado
        -- para hoy espera, y sólo se ven los pendientes de jornadas anteriores.
        CASE
          WHEN v_local::time >= za.rag_jornada_inicio THEN v_local::date
          ELSE NULL
        END AS jornada_visible,
        -- La jornada que está recibiendo solicitudes nuevas en este momento.
        CASE
          WHEN v_local::time >= za.rag_jornada_corte THEN v_local::date + 1
          ELSE v_local::date
        END AS jornada_en_curso,
        (
          v_local::time >= za.rag_jornada_inicio
          AND v_local::time < za.rag_jornada_corte
        ) AS ventana_abierta
      FROM zonas_actor za
    ),
    visibles AS (
      SELECT DISTINCT ON (s.id)
        s.id,
        s.organizacion_id,
        s.zona_id,
        j.nombre AS zona_nombre,
        s.sucursal_id,
        suc.codigo AS sucursal_codigo,
        suc.nombre AS sucursal_nombre,
        s.producto_id,
        s.vencimiento_id,
        s.producto_codigo,
        s.producto_descripcion,
        s.sector_nombre,
        s.familia_nombre,
        s.porcentaje_rag_vigente,
        s.porcentaje_solicitado,
        s.fecha_vencimiento,
        s.fin_accion,
        s.cantidad_comprometida,
        s.creada_at,
        s.jornada_zonal,
        s.ultimo_evento,
        s.ultimo_evento_at,
        s.habilitada_desde,
        s.estado_actual,
        solicitante.nombre AS validada_por_nombre,
        (s.ultimo_evento IN ('solicitada', 'no_aplicada')) AS requiere_ejecucion
      FROM public.v_solicitudes_cambio_rag_actual s
      JOIN jornada j
        ON j.id = s.zona_id
       AND j.organizacion_id = s.organizacion_id
      JOIN public.sucursales suc
        ON suc.id = s.sucursal_id
       AND suc.zona_id = s.zona_id
       AND suc.organizacion_id = s.organizacion_id
      JOIN public.usuarios solicitante ON solicitante.id = s.solicitada_por
      WHERE s.ultimo_evento IN ('solicitada', 'no_aplicada', 'ejecutada')
        AND (
          s.ultimo_evento <> 'ejecutada'
          OR s.ultimo_evento_at >= now() - interval '24 hours'
        )
        -- Corte de visibilidad: lo diferido a una jornada posterior no se ve,
        -- y lo asignado a hoy espera a que la ventana abra. Los pendientes de
        -- jornadas anteriores se muestran siempre.
        AND (
          s.jornada_zonal < j.hoy
          OR (s.jornada_zonal = j.hoy AND j.jornada_visible IS NOT NULL)
        )
      ORDER BY s.id
    )
    SELECT jsonb_build_object(
      'ahora_argentina', to_char(v_local, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'zonas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', j.id,
          'codigo', j.codigo,
          'nombre', j.nombre,
          'organizacion_id', j.organizacion_id,
          'jornada_inicio', to_char(j.rag_jornada_inicio, 'HH24:MI'),
          'jornada_corte', to_char(j.rag_jornada_corte, 'HH24:MI'),
          'jornada_visible', j.jornada_visible,
          'jornada_en_curso', j.jornada_en_curso,
          'ventana_abierta', j.ventana_abierta
        ) ORDER BY j.nombre)
        FROM jornada j
      ), '[]'::jsonb),
      'solicitudes', COALESCE((
        SELECT jsonb_agg(
          to_jsonb(v)
          ORDER BY
            v.sucursal_codigo,
            v.sector_nombre,
            v.familia_nombre,
            v.fin_accion,
            v.creada_at
        )
        FROM visibles v
      ), '[]'::jsonb)
    )
  );
END;
$$;

-- --- 7. No se ejecuta lo que todavía no corresponde ver ---------------------

CREATE OR REPLACE FUNCTION noven_private.ejecutar_solicitud_cambio_rag_impl(
  p_solicitud_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_solicitud public.solicitudes_cambio_rag%ROWTYPE;
  v_ultimo public.solicitud_cambio_rag_eventos%ROWTYPE;
  v_evento_id bigint;
  v_ocurrida_at timestamptz;
  v_local timestamp;
  v_inicio time;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_solicitud_id IS NULL THEN
    RAISE EXCEPTION 'La solicitud es obligatoria' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_solicitud
  FROM public.solicitudes_cambio_rag s
  WHERE s.id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud RAG inexistente' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = v_solicitud.organizacion_id
     AND ua.zona_id = v_solicitud.zona_id
     AND ua.rol = 'administrativa_precios_zonal'
     AND ua.sucursal_id IS NULL
     AND ua.activo = true
    WHERE u.id = v_uid AND u.activo = true
  ) THEN
    RAISE EXCEPTION 'Sin permiso para ejecutar solicitudes de esta zona'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ultimo
  FROM public.solicitud_cambio_rag_eventos e
  WHERE e.solicitud_id = p_solicitud_id
  ORDER BY e.id DESC
  LIMIT 1;

  IF v_ultimo.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud RAG sin evento inicial' USING ERRCODE = '23514';
  END IF;

  -- Doble click o reintento de red: devolver el evento vigente sin duplicarlo.
  -- Va antes del corte de jornada para que un reintento tardío nunca falle.
  IF v_ultimo.tipo = 'ejecutada' THEN
    RETURN v_ultimo.id;
  END IF;

  -- Un cambio diferido no puede ejecutarse antes de su jornada: si pudiera, el
  -- corte de visibilidad sería sólo una decisión de pantalla.
  SELECT z.rag_jornada_inicio INTO v_inicio
  FROM public.zonas z
  WHERE z.id = v_solicitud.zona_id;

  IF v_inicio IS NULL THEN
    RAISE EXCEPTION 'La zona de la solicitud no tiene jornada zonal configurada'
      USING ERRCODE = 'P0002';
  END IF;

  v_local := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires');

  IF NOT (
    v_solicitud.jornada_zonal < v_local::date
    OR (v_solicitud.jornada_zonal = v_local::date AND v_local::time >= v_inicio)
  ) THEN
    RAISE EXCEPTION 'La solicitud pertenece a una jornada zonal que todavía no está abierta'
      USING ERRCODE = '55000';
  END IF;

  IF v_ultimo.tipo NOT IN ('solicitada', 'no_aplicada') THEN
    RAISE EXCEPTION 'La solicitud ya no admite ejecución'
      USING ERRCODE = '23514';
  END IF;

  -- Se toma después de adquirir el lock: una espera concurrente nunca puede
  -- producir un evento anterior al que terminó mientras esta llamada esperaba.
  v_ocurrida_at := clock_timestamp();

  INSERT INTO public.solicitud_cambio_rag_eventos(
    solicitud_id, tipo, actor_id, ocurrida_at, habilitada_desde
  ) VALUES (
    p_solicitud_id,
    'ejecutada',
    v_uid,
    v_ocurrida_at,
    (v_ocurrida_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 1
  ) RETURNING id INTO v_evento_id;

  RETURN v_evento_id;
END;
$$;

-- --- 8. Configurar la ventana de una zona ----------------------------------

-- Accesos y jerarquía necesita leer la ventana vigente para poder editarla.
CREATE OR REPLACE FUNCTION public.listar_contexto_altas_v1(p_actor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'noven_private'
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT ua.organizacion_id INTO v_org
  FROM public.usuario_accesos ua
  WHERE ua.usuario_id = p_actor_id
    AND ua.rol = 'admin_organizacion'
    AND ua.activo = true
    AND noven_private.es_administrador_jerarquia_v1(p_actor_id, ua.organizacion_id)
  ORDER BY ua.created_at
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sin permiso para administrar accesos y jerarquía'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'puede_crear_zonal', true,
    'regiones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'codigo', r.codigo,
        'nombre', r.nombre,
        'organizacion_id', r.organizacion_id
      ) ORDER BY r.nombre)
      FROM public.regiones r
      WHERE r.organizacion_id = v_org AND r.activa = true
    ), '[]'::jsonb),
    'zonas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', z.id,
        'codigo', z.codigo,
        'nombre', z.nombre,
        'region_id', z.region_id,
        'organizacion_id', z.organizacion_id,
        'rag_jornada_inicio', to_char(z.rag_jornada_inicio, 'HH24:MI'),
        'rag_jornada_corte', to_char(z.rag_jornada_corte, 'HH24:MI')
      ) ORDER BY z.nombre)
      FROM public.zonas z
      WHERE z.organizacion_id = v_org AND z.activa = true
    ), '[]'::jsonb),
    'sucursales', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'codigo', s.codigo,
        'nombre', s.nombre,
        'zona_id', s.zona_id,
        'organizacion_id', s.organizacion_id
      ) ORDER BY s.codigo)
      FROM public.sucursales s
      WHERE s.organizacion_id = v_org AND s.activa = true
    ), '[]'::jsonb),
    'cobertura_zonal', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'zona_id', z.id,
        'gerentes_zonales', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'usuario_id', u.id,
            'nombre', u.nombre
          ) ORDER BY u.nombre)
          FROM public.usuario_accesos ua
          JOIN public.usuarios u
            ON u.id = ua.usuario_id AND u.activo = true
          WHERE ua.organizacion_id = v_org
            AND ua.zona_id = z.id
            AND ua.rol = 'gerente_zonal'
            AND ua.activo = true
        ), '[]'::jsonb),
        'gerentes_zonales_pendientes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'invitacion_id', ia.id,
            'nombre', ia.nombre
          ) ORDER BY ia.created_at)
          FROM public.invitaciones_acceso ia
          WHERE ia.organizacion_id = v_org
            AND ia.zona_id = z.id
            AND ia.rol = 'gerente_zonal'
            AND ia.estado = 'pendiente'
            AND ia.expires_at > now()
        ), '[]'::jsonb),
        'administrativas_precios', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'usuario_id', u.id,
            'nombre', u.nombre
          ) ORDER BY u.nombre)
          FROM public.usuario_accesos ua
          JOIN public.usuarios u
            ON u.id = ua.usuario_id AND u.activo = true
          WHERE ua.organizacion_id = v_org
            AND ua.zona_id = z.id
            AND ua.rol = 'administrativa_precios_zonal'
            AND ua.activo = true
        ), '[]'::jsonb),
        'administrativas_precios_pendientes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'invitacion_id', ia.id,
            'nombre', ia.nombre
          ) ORDER BY ia.created_at)
          FROM public.invitaciones_acceso ia
          WHERE ia.organizacion_id = v_org
            AND ia.zona_id = z.id
            AND ia.rol = 'administrativa_precios_zonal'
            AND ia.estado = 'pendiente'
            AND ia.expires_at > now()
        ), '[]'::jsonb)
      ) ORDER BY z.nombre)
      FROM public.zonas z
      WHERE z.organizacion_id = v_org AND z.activa = true
    ), '[]'::jsonb),
    'accesos_actor', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'rol', ua.rol,
        'organizacion_id', ua.organizacion_id,
        'zona_id', ua.zona_id,
        'sucursal_id', ua.sucursal_id
      ) ORDER BY ua.created_at)
      FROM public.usuario_accesos ua
      WHERE ua.usuario_id = p_actor_id
        AND ua.organizacion_id = v_org
        AND ua.activo = true
    ), '[]'::jsonb)
  );
END;
$$;

-- La ventana la define la administración de la organización, no la pantalla de
-- la administrativa ni el reloj del dispositivo.
CREATE OR REPLACE FUNCTION public.configurar_jornada_rag_zonal_v1(
  p_actor_id uuid,
  p_zona_id uuid,
  p_inicio time,
  p_corte time
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'noven_private'
AS $$
DECLARE
  v_org uuid;
  v_nombre text;
BEGIN
  IF p_zona_id IS NULL THEN
    RAISE EXCEPTION 'La zona es obligatoria' USING ERRCODE = '22023';
  END IF;
  IF p_inicio IS NULL OR p_corte IS NULL THEN
    RAISE EXCEPTION 'El inicio y el corte de la jornada son obligatorios'
      USING ERRCODE = '22023';
  END IF;
  IF p_inicio >= p_corte THEN
    RAISE EXCEPTION 'El corte de la jornada debe ser posterior a su inicio'
      USING ERRCODE = '22023';
  END IF;

  SELECT z.organizacion_id, z.nombre INTO v_org, v_nombre
  FROM public.zonas z
  WHERE z.id = p_zona_id AND z.activa = true;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Zona inexistente o inactiva' USING ERRCODE = 'P0002';
  END IF;

  IF NOT noven_private.es_administrador_jerarquia_v1(p_actor_id, v_org) THEN
    RAISE EXCEPTION 'Sin permiso para administrar accesos y jerarquía'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.zonas
  SET rag_jornada_inicio = p_inicio,
      rag_jornada_corte = p_corte,
      updated_at = now()
  WHERE id = p_zona_id;

  RETURN jsonb_build_object(
    'zona_id', p_zona_id,
    'zona_nombre', v_nombre,
    'organizacion_id', v_org,
    'rag_jornada_inicio', to_char(p_inicio, 'HH24:MI'),
    'rag_jornada_corte', to_char(p_corte, 'HH24:MI')
  );
END;
$$;

COMMENT ON FUNCTION public.configurar_jornada_rag_zonal_v1(uuid, uuid, time, time) IS
  'Fija la ventana de recepción de la bandeja zonal; sólo la administración de jerarquía de la organización puede cambiarla.';

-- --- 9. ACL explícita de lo agregado ---------------------------------------

-- Los valores por defecto de las relaciones nuevas no alcanzan: en este
-- proyecto `authenticated` recibe privilegios amplios sobre lo que se crea.
REVOKE ALL ON FUNCTION noven_private.jornada_rag_zonal_v1(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.configurar_jornada_rag_zonal_v1(uuid, uuid, time, time)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.configurar_jornada_rag_zonal_v1(uuid, uuid, time, time)
  TO service_role;

REVOKE ALL ON FUNCTION public.listar_contexto_altas_v1(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_contexto_altas_v1(uuid) TO service_role;

REVOKE ALL ON FUNCTION noven_private.listar_bandeja_rag_zonal_impl()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION noven_private.listar_bandeja_rag_zonal_impl()
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION noven_private.ejecutar_solicitud_cambio_rag_impl(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION noven_private.ejecutar_solicitud_cambio_rag_impl(uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION noven_private.solicitar_cambio_rag_impl(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION noven_private.solicitar_cambio_rag_impl(uuid)
  TO authenticated, service_role;

COMMIT;
