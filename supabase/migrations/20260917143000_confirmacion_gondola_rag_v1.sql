-- =============================================================================
-- NOVEN · CIRCUITO RAG CENTRALIZADO · PASO 5, LA VERIFICACIÓN EN GÓNDOLA
--
-- EL HUECO, TAL COMO SE VIO EN PRODUCCIÓN. El circuito se probó de punta a
-- punta sobre el alfajor tofi blanco de la 091 y se cortó en el último paso:
-- la solicitud llegó a `ejecutada`, la administrativa zonal cargó el cambio en
-- la cadena, y no había forma de decir «el precio está en góndola». No faltaba
-- sólo el botón: NINGUNA RPC del repositorio emite `confirmada` ni
-- `no_aplicada`. El modelo de eventos los admite desde `20260909020007` —el
-- CHECK de `tipo`, las transiciones del trigger, la compuerta de
-- `habilitada_desde` y los tres roles habilitados están escritos ahí— pero
-- nadie podía insertarlos. La máquina de estados existía sin su último paso.
--
-- LA CONSECUENCIA REAL, que es más grande que el botón. El tramo del nuevo
-- porcentaje nace en la confirmación. Sin confirmación no hay tramo, y sin
-- tramo el motor de cobertura sigue midiendo contra el porcentaje viejo: un
-- RAG que ya está en góndola al 30% se evalúa como si siguiera al 20%. Lo que
-- pasó en producción es la salida previsible de eso: alguien abrió la
-- intervención a mano para destrabarlo, y quedó registrada con
-- `origen_sugerencia = 'manual'` —es decir, como si nadie la hubiera sugerido—
-- cuando en realidad venía de una sugerencia aceptada y ejecutada por el
-- circuito. La instrumentación quedó midiendo lo contrario de lo que ocurrió.
--
-- LO QUE ESTA MIGRACIÓN DECIDE, y por qué en cada caso:
--
-- 1 · LA CONFIRMACIÓN ES IDEMPOTENTE, NO EXCEPCIONAL. Entre la ejecución
--     zonal y la verificación hay una ventana de al menos un día operativo, y
--     en esa ventana alguien puede abrir el tramo a mano —acaba de pasar—. Una
--     confirmación que asume que el tramo no existe falla la segunda vez y deja
--     la ventana abierta para siempre. Si ya hay un RAG vivo EN EL PORCENTAJE
--     SOLICITADO, no se abre otro: se corrige su atribución, que es lo único
--     que estaba mal. Si hay uno vivo con otro porcentaje, ése es el tramo que
--     termina.
--
-- 2 · `aplicado_at` NO SE RETROTRAE NUNCA. Ni al abrir el tramo nuevo ni al
--     corregir uno existente. El inicio de un tramo es el momento en que el
--     precio empezó a estar; moverlo hacia atrás para «cuadrar» con la
--     ejecución zonal inventaría días de medición que no ocurrieron, y hacia
--     adelante los borraría.
--
-- 3 · EL MOTIVO DE FINALIZACIÓN ES `reemplazado_por_circuito`. El CHECK de
--     `20260829171500` no lo admitía, así que se extiende. `reemplazado` ya
--     existe y significa otra cosa —lo escribe la reconstrucción histórica y el
--     camino manual—; distinguirlos es lo que después permite preguntar cuántos
--     tramos cerró el circuito y cuántos se cerraron a mano. Los tramos ya
--     cerrados conservan su motivo viejo: son historia, y la historia no se
--     reescribe para que quede prolija.
--
-- 4 · LA RPC NO VUELVE A DECIDIR PERMISOS DE TRANSICIÓN. El trigger
--     `validar_evento_solicitud_cambio_rag` ya resuelve quién puede emitir
--     `confirmada`/`no_aplicada`, en qué orden y desde qué fecha. Repetir esa
--     lógica acá sería tener dos copias de la misma regla, que es como se
--     empieza a divergir. Lo que la RPC sí hace es el guard de ALCANCE sobre el
--     producto, que es el lado correcto de la frontera —confirmar que un precio
--     está en góndola es CONSTATAR UN HECHO, no autorizar un cambio— y que
--     además da un error legible antes del genérico del trigger. El conjunto
--     que habilita `puede_ver_producto_sucursal` es exactamente el mismo que el
--     trigger enumera: gerente y supervisor de la sucursal, y operador con la
--     familia asignada.
--
-- 5 · `no_aplicada` NO TOCA `intervenciones_rag`. Es la constatación de que el
--     precio NO está: no hay tramo que abrir ni que cerrar. El aviso es que la
--     solicitud reaparece en la bandeja zonal —que ya la muestra, porque
--     `requiere_ejecucion` incluye `no_aplicada`—; no se inventa un canal nuevo.
--     Lo que sí faltaba es poder DISTINGUIRLA de una solicitud nueva, y para
--     eso la vista expone `reintentos_no_aplicada`: sin ese dato, una solicitud
--     que vuelve y se re-ejecuta queda otra vez en `lista_confirmacion`, con el
--     mismo estado y el mismo aspecto que una que nunca falló.
-- =============================================================================

BEGIN;

-- --- 1. El motivo que el circuito necesita escribir -------------------------

ALTER TABLE public.intervenciones_rag
  DROP CONSTRAINT IF EXISTS intervenciones_rag_motivo_finalizacion_check;

ALTER TABLE public.intervenciones_rag
  ADD CONSTRAINT intervenciones_rag_motivo_finalizacion_check
  CHECK (
    motivo_finalizacion IS NULL
    OR motivo_finalizacion IN (
      'reemplazado',
      'reemplazado_por_circuito',
      'oferta_centralizada',
      'decision_comercial',
      'otro'
    )
  );

COMMENT ON COLUMN public.intervenciones_rag.motivo_finalizacion IS
  'Por qué terminó el tramo. `reemplazado_por_circuito` lo escribe sólo la verificación en góndola del circuito centralizado; `reemplazado` es el cierre manual y el de la reconstrucción histórica. Distinguirlos es lo que permite medir cuánto cierra el circuito y cuánto la mano.';

-- --- 2. Una solicitud que vuelve no se confunde con una nueva ---------------
--
-- `estado_actual` no alcanza: una solicitud que volvió de `no_aplicada` y se
-- re-ejecutó vuelve a decir `lista_confirmacion`, igual que una que nunca
-- falló. El contador de reintentos es el único rastro que sobrevive a la
-- re-ejecución, y viene del historial append-only, no de una columna nueva que
-- alguien tenga que mantener.
--
-- Las columnas existentes se enumeran en su orden original y la nueva se agrega
-- al final, para que CREATE OR REPLACE conserve la vista y su ACL. Las
-- reloptions NO sobreviven al reemplazo: `security_invoker` se vuelve a fijar.

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
  s.jornada_zonal,
  reintentos.veces AS reintentos_no_aplicada
FROM public.solicitudes_cambio_rag s
LEFT JOIN LATERAL (
  SELECT e.tipo, e.actor_id, e.ocurrida_at, e.habilitada_desde
  FROM public.solicitud_cambio_rag_eventos e
  WHERE e.solicitud_id = s.id
  ORDER BY e.id DESC
  LIMIT 1
) ultimo ON true
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS veces
  FROM public.solicitud_cambio_rag_eventos e
  WHERE e.solicitud_id = s.id
    AND e.tipo = 'no_aplicada'
) reintentos ON true;

ALTER VIEW public.v_solicitudes_cambio_rag_actual
  SET (security_invoker = true);

REVOKE ALL ON TABLE public.v_solicitudes_cambio_rag_actual
  FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.v_solicitudes_cambio_rag_actual FROM authenticated;
GRANT SELECT ON TABLE public.v_solicitudes_cambio_rag_actual TO authenticated;

COMMENT ON VIEW public.v_solicitudes_cambio_rag_actual IS
  'Estado vigente de cada solicitud del circuito RAG centralizado. `reintentos_no_aplicada` cuenta las verificaciones fallidas en góndola: una solicitud re-ejecutada vuelve a `lista_confirmacion` y sin ese contador sería indistinguible de una que nunca falló.';

-- --- 3. Verificar en góndola ------------------------------------------------

CREATE OR REPLACE FUNCTION noven_private.verificar_cambio_rag_impl(
  p_solicitud_id uuid,
  p_resultado text,
  p_nota text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid          uuid := (SELECT auth.uid());
  v_solicitud    public.solicitudes_cambio_rag%ROWTYPE;
  v_ultimo       public.solicitud_cambio_rag_eventos%ROWTYPE;
  v_evento_id    bigint;
  v_ocurrida_at  timestamptz;
  v_rag_id       uuid;
  v_rag_pc       numeric;
  v_cantidad     numeric;
  v_vmd          numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  -- El resultado lo fija el wrapper, no el browser. Si alguna vez llegara otro
  -- valor, es un defecto de programación y no un dato de entrada a validar
  -- amablemente.
  IF p_resultado IS NULL OR p_resultado NOT IN ('confirmada', 'no_aplicada') THEN
    RAISE EXCEPTION 'Resultado de verificación no válido' USING ERRCODE = '22023';
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

  -- EL GUARD DE LA CONSTATACIÓN. Alcance sobre el producto, no jerarquía: el
  -- operador con la familia asignada, el gerente y el supervisor pasan por
  -- igual, porque los tres pueden estar parados frente a la góndola. Es el
  -- mismo conjunto que el trigger enumera para esta transición; acá se nombra
  -- una sola vez y da un error legible antes del genérico.
  IF NOT noven_private.puede_ver_producto_sucursal(
    v_solicitud.sucursal_id, v_solicitud.producto_id
  ) THEN
    RAISE EXCEPTION 'Sin permiso para verificar este cambio en góndola'
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

  -- Doble click o reintento de red: se devuelve el evento vigente sin
  -- duplicarlo. Va antes de la comprobación de estado para que un reintento
  -- tardío nunca falle con «ya no admite verificación».
  IF v_ultimo.tipo = p_resultado THEN
    RETURN v_ultimo.id;
  END IF;

  IF v_ultimo.tipo <> 'ejecutada' THEN
    RAISE EXCEPTION 'La solicitud no está esperando verificación en góndola'
      USING ERRCODE = '23514';
  END IF;

  -- Se toma después de adquirir el lock: una espera concurrente nunca puede
  -- producir un evento anterior al que terminó mientras esta llamada esperaba.
  v_ocurrida_at := clock_timestamp();

  -- El trigger valida acá la transición, el orden temporal, la compuerta de
  -- `habilitada_desde` y el rol del actor. No se repite nada de eso arriba.
  INSERT INTO public.solicitud_cambio_rag_eventos(
    solicitud_id, tipo, actor_id, ocurrida_at, nota
  ) VALUES (
    p_solicitud_id, p_resultado, v_uid, v_ocurrida_at, NULLIF(btrim(p_nota), '')
  ) RETURNING id INTO v_evento_id;

  -- `no_aplicada` constata que el precio NO está: no hay tramo que abrir ni que
  -- cerrar, y la intervención vigente sigue siendo la que estaba. La solicitud
  -- vuelve sola a la bandeja zonal.
  IF p_resultado = 'no_aplicada' THEN
    RETURN v_evento_id;
  END IF;

  SELECT r.id, r.porcentaje_descuento
    INTO v_rag_id, v_rag_pc
  FROM public.intervenciones_rag r
  WHERE r.vencimiento_id = v_solicitud.vencimiento_id
    AND r.tipo = 'rag'
    AND r.finalizado_at IS NULL
  FOR UPDATE;

  IF FOUND AND v_rag_pc IS NOT DISTINCT FROM v_solicitud.porcentaje_solicitado THEN
    -- EL TRAMO YA EXISTE en el porcentaje solicitado: alguien lo abrió a mano
    -- en la ventana entre la ejecución zonal y esta verificación. Abrir otro
    -- chocaría contra el índice único de un solo RAG vigente por vencimiento, y
    -- retrotraer `aplicado_at` falsearía la medición. Lo único que está mal es
    -- la atribución: la intervención dice `manual` cuando en realidad viene de
    -- una sugerencia aceptada y ejecutada por el circuito.
    --
    -- El origen se limpia para que la instrumentación pueda volver a correr:
    -- `instrumentar_sugerencia_rag_impl` se detiene si ya hay origen, y es la
    -- única función que sabe resolver escalones y `fuera_de_escala`. Escribir
    -- esos números acá sería un segundo cómputo del mismo valor, y dos cómputos
    -- del mismo número terminan divergiendo.
    --
    -- Sólo se corrige lo que el circuito puede reclamar como suyo: una
    -- intervención `manual` o sin instrumentar. Una ya marcada
    -- `sugerida_aceptada` o `sugerida_rechazada` se deja como está.
    UPDATE public.intervenciones_rag
    SET origen_sugerencia = NULL
    WHERE id = v_rag_id
      AND (origen_sugerencia IS NULL OR origen_sugerencia = 'manual');

    PERFORM noven_private.instrumentar_sugerencia_rag_impl(
      v_solicitud.vencimiento_id,
      v_solicitud.cobertura_al_sugerir,
      v_solicitud.escalones_sugeridos,
      'sugerida_aceptada'
    );

    RETURN v_evento_id;
  END IF;

  IF FOUND THEN
    -- Hay un RAG vivo con OTRO porcentaje: es el tramo que este cambio
    -- reemplaza, y termina en el mismo instante en que empieza el nuevo.
    UPDATE public.intervenciones_rag
    SET finalizado_at = v_ocurrida_at,
        finalizado_por = v_uid,
        motivo_finalizacion = 'reemplazado_por_circuito'
    WHERE id = v_rag_id;
  END IF;

  -- La cantidad y la VMD son las de HOY, no las del snapshot de la solicitud:
  -- el tramo arranca ahora y se mide desde el stock que hay ahora. El snapshot
  -- conserva por qué se pidió el cambio, que es otra pregunta.
  SELECT v.cantidad, ps.venta_media_diaria
    INTO v_cantidad, v_vmd
  FROM public.vencimientos v
  JOIN public.producto_sucursal ps
    ON ps.producto_id = v.producto_id
   AND ps.sucursal_id = v.sucursal_id
   AND ps.organizacion_id = v_solicitud.organizacion_id
  WHERE v.id = v_solicitud.vencimiento_id
    AND v.activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo/estado de sucursal no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.intervenciones_rag(
    organizacion_id, sucursal_id, producto_id, vencimiento_id, usuario_id,
    tipo, porcentaje_descuento, cantidad_comprometida_al_aplicar,
    vmd_glaciar_al_aplicar, aplicado_at
  )
  VALUES(
    v_solicitud.organizacion_id, v_solicitud.sucursal_id,
    v_solicitud.producto_id, v_solicitud.vencimiento_id, v_uid,
    'rag', v_solicitud.porcentaje_solicitado, v_cantidad, v_vmd,
    v_ocurrida_at
  );

  PERFORM noven_private.instrumentar_sugerencia_rag_impl(
    v_solicitud.vencimiento_id,
    v_solicitud.cobertura_al_sugerir,
    v_solicitud.escalones_sugeridos,
    'sugerida_aceptada'
  );

  RETURN v_evento_id;
END;
$function$;

-- --- 4. Dos caminos explícitos, sin un `resultado` viajando por la red ------
--
-- El mismo patrón que `finalizar_rag_vigente` / `finalizar_oferta_central`: el
-- browser elige el BOTÓN, no el valor del campo. Un único endpoint con un
-- parámetro de texto haría que confirmar y desmentir se distingan por un string
-- que viaja desde el cliente.

CREATE OR REPLACE FUNCTION public.confirmar_cambio_rag_en_gondola(
  p_solicitud_id uuid,
  p_nota text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.verificar_cambio_rag_impl(p_solicitud_id, 'confirmada', p_nota);
$$;

CREATE OR REPLACE FUNCTION public.registrar_cambio_rag_no_aplicado(
  p_solicitud_id uuid,
  p_nota text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.verificar_cambio_rag_impl(p_solicitud_id, 'no_aplicada', p_nota);
$$;

-- --- 5. La bandeja zonal muestra los reintentos -----------------------------
--
-- Es el aviso pedido, en el canal que ya existe: la solicitud reaparece sola
-- porque `requiere_ejecucion` incluye `no_aplicada`. Lo que se agrega es poder
-- ver que ya volvió una vez.

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
        (s.ultimo_evento IN ('solicitada', 'no_aplicada')) AS requiere_ejecucion,
        -- Distingue una solicitud que ya volvió de góndola de una nueva. Sin
        -- esto, una re-ejecución la devuelve a `lista_confirmacion` con el
        -- mismo aspecto que una que nunca falló.
        s.reintentos_no_aplicada
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
      -- `to_char` no tiene sobrecarga para `time`: el cast a interval es
      -- explícito para no depender de que exista una conversión implícita.
      'ahora_argentina', to_char(v_local, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'zonas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', j.id,
          'codigo', j.codigo,
          'nombre', j.nombre,
          'organizacion_id', j.organizacion_id,
          'jornada_inicio', to_char(j.rag_jornada_inicio::interval, 'HH24:MI'),
          'jornada_corte', to_char(j.rag_jornada_corte::interval, 'HH24:MI'),
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

-- --- 6. Superficie RPC mínima y explícita -----------------------------------
--
-- Los defaults de Supabase conceden a `authenticated` sobre toda función nueva.
-- El REVOKE previo al GRANT no es ceremonia: es lo que deja `anon` afuera.

REVOKE ALL ON FUNCTION noven_private.verificar_cambio_rag_impl(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.verificar_cambio_rag_impl(uuid, text, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.confirmar_cambio_rag_en_gondola(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_cambio_rag_en_gondola(uuid, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.registrar_cambio_rag_no_aplicado(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_cambio_rag_no_aplicado(uuid, text)
  TO authenticated;

COMMENT ON FUNCTION public.confirmar_cambio_rag_en_gondola(uuid, text) IS
  'Constata que el precio solicitado ya está en góndola y abre ahí el tramo del nuevo porcentaje. Autoriza por alcance sobre el producto —constatar un hecho no es autorizar un cambio—; el trigger del historial resuelve la transición y la compuerta de habilitación. Es idempotente: si el tramo ya fue abierto a mano en la ventana entre la ejecución y la verificación, corrige su atribución en vez de fallar, y nunca retrotrae aplicado_at.';

COMMENT ON FUNCTION public.registrar_cambio_rag_no_aplicado(uuid, text) IS
  'Constata que el precio NO está en góndola. No toca ninguna intervención: la solicitud vuelve sola a la bandeja zonal para re-ejecutarse, y la vista la distingue de una nueva por reintentos_no_aplicada.';

COMMIT;
