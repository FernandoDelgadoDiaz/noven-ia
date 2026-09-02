-- =============================================================================
-- NOVEN · CUOTA POR ACTOR Y CACHÉ SERVER-SIDE PARA EL ANÁLISIS GERENCIAL
--
-- `analisis.ts` es hoy el único endpoint donde un usuario autenticado puede
-- generar costo ilimitado en un proveedor externo y enviarle datos operativos
-- sin techo. No tenía rate limit ni caché server-side: el "caché" del análisis
-- vive en localStorage del cliente, así que no impone ningún límite real.
--
-- Por qué en Postgres y no en el borde: el actor que hay que limitar es el
-- usuario. Las reglas nativas de Netlify agregan por IP, y en un supermercado
-- toda la sucursal sale por una IP — limitar por IP trabaría a los operadores
-- legítimos sin frenar a quien cambie de red. La única capa que conoce al actor
-- real es la base.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Contadores de cuota
-- -----------------------------------------------------------------------------
-- Una fila por (actor, endpoint, ventana). La ventana va truncada dentro de la
-- clave primaria, de modo que las ventanas viejas quedan huérfanas y se limpian
-- con un DELETE por antigüedad; no hace falta lógica de expiración.
CREATE TABLE IF NOT EXISTS public.rate_limit_consumo (
  actor_id        uuid        NOT NULL,
  endpoint        text        NOT NULL,
  ventana         text        NOT NULL,
  ventana_inicio  timestamptz NOT NULL,
  consumo         integer     NOT NULL DEFAULT 0,
  actualizado_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_limit_consumo_pkey
    PRIMARY KEY (actor_id, endpoint, ventana, ventana_inicio),
  CONSTRAINT rate_limit_consumo_ventana_check
    CHECK (ventana IN ('hora', 'dia')),
  CONSTRAINT rate_limit_consumo_no_negativo
    CHECK (consumo >= 0)
);

CREATE INDEX IF NOT EXISTS rate_limit_consumo_purga_idx
  ON public.rate_limit_consumo (ventana_inicio);

ALTER TABLE public.rate_limit_consumo ENABLE ROW LEVEL SECURITY;

-- Server-only: RLS activo y cero policies. El browser no la ve ni la toca.
REVOKE ALL PRIVILEGES ON TABLE public.rate_limit_consumo FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Caché del análisis
-- -----------------------------------------------------------------------------
-- La clave es sha256(system_prompt || datos_formateados). Es segura por
-- construcción: un acierto sólo ocurre si la entrada autorizada es byte a byte
-- idéntica, así que devolver el ámbito de otro usuario es estructuralmente
-- imposible, no una verificación que alguien pueda olvidar.
--
-- Se invalida sola a diario porque la fecha operacional viaja dentro de los
-- datos formateados. `generado_en` sólo acota el almacenamiento.
CREATE TABLE IF NOT EXISTS public.analisis_cache (
  clave        text        NOT NULL,
  sucursal_id  uuid        NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  analisis     text        NOT NULL,
  generado_en  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analisis_cache_pkey PRIMARY KEY (clave),
  CONSTRAINT analisis_cache_clave_sha256 CHECK (clave ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS analisis_cache_purga_idx
  ON public.analisis_cache (generado_en);

ALTER TABLE public.analisis_cache ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.analisis_cache FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Consumo atómico de cuota
-- -----------------------------------------------------------------------------
-- Incremento condicional en UNA sentencia por ventana: INSERT ... ON CONFLICT
-- DO UPDATE ... RETURNING toma el lock de fila en el conflicto y devuelve el
-- valor ya incrementado. No hay SELECT seguido de UPDATE, que es justamente la
-- carrera que un bucle explota contra un límite de cuota.
--
-- Las dos ventanas se tocan SIEMPRE en el mismo orden (hora y después día).
-- Son filas distintas: dos llamadas concurrentes que las tomaran en orden
-- inverso se deadlockearían.
--
-- Se incrementa y se decide sobre el valor devuelto, nunca al revés. Un intento
-- rechazado también consume ventana: es deliberado, hace que un bucle se
-- auto-castigue en vez de reintentar gratis.
CREATE OR REPLACE FUNCTION public.consumir_cuota_actor_v1(
  p_actor_id    uuid,
  p_endpoint    text,
  p_limite_hora integer,
  p_limite_dia  integer
)
RETURNS TABLE (permitido boolean, motivo text, consumo_hora integer, consumo_dia integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inicio_hora timestamptz := date_trunc('hour', now());
  v_inicio_dia  timestamptz := date_trunc('day', now());
  v_hora        integer;
  v_dia         integer;
BEGIN
  IF p_actor_id IS NULL OR p_endpoint IS NULL THEN
    RAISE EXCEPTION 'actor y endpoint son obligatorios';
  END IF;
  IF p_limite_hora <= 0 OR p_limite_dia <= 0 THEN
    RAISE EXCEPTION 'los límites deben ser positivos';
  END IF;

  INSERT INTO public.rate_limit_consumo AS r
    (actor_id, endpoint, ventana, ventana_inicio, consumo)
  VALUES (p_actor_id, p_endpoint, 'hora', v_inicio_hora, 1)
  ON CONFLICT (actor_id, endpoint, ventana, ventana_inicio)
  DO UPDATE SET consumo = r.consumo + 1, actualizado_at = now()
  RETURNING r.consumo INTO v_hora;

  INSERT INTO public.rate_limit_consumo AS r
    (actor_id, endpoint, ventana, ventana_inicio, consumo)
  VALUES (p_actor_id, p_endpoint, 'dia', v_inicio_dia, 1)
  ON CONFLICT (actor_id, endpoint, ventana, ventana_inicio)
  DO UPDATE SET consumo = r.consumo + 1, actualizado_at = now()
  RETURNING r.consumo INTO v_dia;

  IF v_hora > p_limite_hora THEN
    RETURN QUERY SELECT false, 'limite_hora'::text, v_hora, v_dia;
  ELSIF v_dia > p_limite_dia THEN
    RETURN QUERY SELECT false, 'limite_dia'::text, v_hora, v_dia;
  ELSE
    RETURN QUERY SELECT true, 'ok'::text, v_hora, v_dia;
  END IF;
END;
$$;

-- El default de Postgres es EXECUTE a PUBLIC. Revocarlo sin el GRANT explícito
-- dejaría a service_role sin permiso, la cuota fallaría cerrada y el análisis
-- quedaría en 503 permanente.
REVOKE ALL ON FUNCTION public.consumir_cuota_actor_v1(uuid, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_cuota_actor_v1(uuid, text, integer, integer)
  TO service_role;

-- -----------------------------------------------------------------------------
-- Purga de ventanas y caché vencidos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purgar_cuota_y_cache_v1(
  p_retencion_cuota interval DEFAULT interval '7 days',
  p_retencion_cache interval DEFAULT interval '7 days'
)
RETURNS TABLE (cuota_borrada bigint, cache_borrado bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cuota bigint;
  v_cache bigint;
BEGIN
  DELETE FROM public.rate_limit_consumo
  WHERE ventana_inicio < now() - p_retencion_cuota;
  GET DIAGNOSTICS v_cuota = ROW_COUNT;

  DELETE FROM public.analisis_cache
  WHERE generado_en < now() - p_retencion_cache;
  GET DIAGNOSTICS v_cache = ROW_COUNT;

  RETURN QUERY SELECT v_cuota, v_cache;
END;
$$;

REVOKE ALL ON FUNCTION public.purgar_cuota_y_cache_v1(interval, interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purgar_cuota_y_cache_v1(interval, interval)
  TO service_role;

COMMIT;
