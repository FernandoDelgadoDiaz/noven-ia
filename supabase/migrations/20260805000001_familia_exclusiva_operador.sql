-- =============================================================================
-- MIGRACIÓN: restricción de familia exclusiva por operador (vía TRIGGER)
--
-- DECISIÓN ARQUITECTÓNICA — por qué trigger y no índice único parcial:
--   Un índice único parcial en PostgreSQL exige que su predicado sea
--   IMMUTABLE. La condición que nos interesa es
--     WHERE (SELECT rol FROM public.usuarios WHERE id = usuario_id) = 'operador'
--   que contiene una subconsulta → ilegal como predicado de índice.
--   La alternativa de desnormalizar la columna `rol` dentro de
--   `usuario_familias` introduciría un segundo lugar de verdad que habría
--   que mantener sincronizado con `public.usuarios`, aumentando la superficie
--   de error. El trigger valida contra la única fuente de verdad (`usuarios`)
--   y admite el bloqueo advisory necesario para evitar condiciones de carrera.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Validación preventiva de datos existentes
--    Se emite WARNING (no EXCEPTION) para no bloquear el deploy si ya hay
--    violaciones previas. El operador DBA debe resolverlas manualmente.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM (
    SELECT uf.familia_id
    FROM public.usuario_familias uf
    JOIN public.usuarios u ON u.id = uf.usuario_id
    WHERE u.rol = 'operador'
      AND uf.familia_id IS NOT NULL
      AND uf.usuario_id IS NOT NULL
    GROUP BY uf.familia_id
    HAVING COUNT(DISTINCT uf.usuario_id) > 1
  ) conflictos;

  IF v_count > 0 THEN
    RAISE WARNING
      'PRECAUCIÓN: existen % familia(s) asignada(s) a más de un operador. '
      'Los triggers no modifican datos existentes, pero bloquearán nuevas '
      'asignaciones conflictivas. Revisar y corregir manualmente antes del '
      'próximo ciclo de asignaciones.',
      v_count;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Función del trigger principal: familia exclusiva por operador
--    BEFORE INSERT OR UPDATE en usuario_familias.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_familia_exclusiva_operador()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_rol      text;
  v_ocupante text;
BEGIN
  -- Nada que validar si algún FK es NULL.
  IF NEW.familia_id IS NULL OR NEW.usuario_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- En UPDATE, si ni la familia ni el usuario cambiaron, no hay conflicto nuevo.
  IF TG_OP = 'UPDATE'
     AND NEW.familia_id IS NOT DISTINCT FROM OLD.familia_id
     AND NEW.usuario_id IS NOT DISTINCT FROM OLD.usuario_id THEN
    RETURN NEW;
  END IF;

  -- Lock advisory a nivel de transacción para serializar asignaciones
  -- concurrentes de la misma familia y evitar condiciones de carrera.
  PERFORM pg_advisory_xact_lock(
    hashtext('familia_exclusiva'),
    hashtext(NEW.familia_id::text)
  );

  -- Leer el rol del usuario destinatario.
  SELECT rol INTO v_rol
  FROM public.usuarios
  WHERE id = NEW.usuario_id;

  -- Supervisores y admins no tienen restricción de exclusividad.
  IF v_rol IS DISTINCT FROM 'operador' THEN
    RETURN NEW;
  END IF;

  -- Buscar si otro operador ya tiene esta familia asignada.
  SELECT u.nombre INTO v_ocupante
  FROM public.usuario_familias uf
  JOIN public.usuarios u ON u.id = uf.usuario_id
  WHERE uf.familia_id  = NEW.familia_id
    AND uf.usuario_id <> NEW.usuario_id
    AND u.rol          = 'operador'
  LIMIT 1;

  IF v_ocupante IS NOT NULL THEN
    RAISE EXCEPTION
      USING errcode = '23505',
            message = format(
              'La familia ya está asignada al operador %s. '
              'Una familia solo puede tener un operador.',
              v_ocupante
            );
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Trigger principal sobre usuario_familias
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_familia_exclusiva_operador ON public.usuario_familias;

CREATE TRIGGER trg_familia_exclusiva_operador
  BEFORE INSERT OR UPDATE ON public.usuario_familias
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_familia_exclusiva_operador();

-- ---------------------------------------------------------------------------
-- 3. Función del trigger de refuerzo: bloquear cambio de rol a 'operador'
--    cuando el usuario ya tiene familias que colisionan con otro operador.
--    BEFORE UPDATE OF rol en public.usuarios.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_rol_operador_sin_colision()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_familia  text;
  v_ocupante text;
BEGIN
  -- Solo actuar cuando el rol realmente cambia y el nuevo valor es 'operador'.
  IF NEW.rol IS NOT DISTINCT FROM OLD.rol OR NEW.rol <> 'operador' THEN
    RETURN NEW;
  END IF;

  -- Buscar la primera familia del usuario que ya esté asignada a OTRO operador.
  SELECT f.nombre, u.nombre
  INTO v_familia, v_ocupante
  FROM public.usuario_familias uf_candidato
  JOIN public.familias f
    ON f.id = uf_candidato.familia_id
  JOIN public.usuario_familias uf_otro
    ON uf_otro.familia_id  = uf_candidato.familia_id
   AND uf_otro.usuario_id <> NEW.id
  JOIN public.usuarios u
    ON u.id  = uf_otro.usuario_id
   AND u.rol = 'operador'
  WHERE uf_candidato.usuario_id = NEW.id
  LIMIT 1;

  IF v_ocupante IS NOT NULL THEN
    RAISE EXCEPTION
      USING errcode = '23505',
            message = format(
              'No se puede asignar rol operador: la familia %s ya pertenece al operador %s.',
              v_familia,
              v_ocupante
            );
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Trigger de refuerzo sobre usuarios
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_rol_operador_sin_colision ON public.usuarios;

CREATE TRIGGER trg_rol_operador_sin_colision
  BEFORE UPDATE OF rol ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_rol_operador_sin_colision();

COMMIT;

-- ---------------------------------------------------------------------------
-- DIAGNÓSTICO MANUAL (ejecutar separado si el DO block emitió WARNING):
-- Lista las familias con más de un operador asignado para corrección manual.
-- ---------------------------------------------------------------------------
/*
SELECT
  f.id          AS familia_id,
  f.nombre      AS familia,
  u.id          AS usuario_id,
  u.nombre      AS operador
FROM public.usuario_familias uf
JOIN public.usuarios u  ON u.id  = uf.usuario_id  AND u.rol = 'operador'
JOIN public.familias  f ON f.id  = uf.familia_id
WHERE uf.familia_id IN (
  SELECT uf2.familia_id
  FROM public.usuario_familias uf2
  JOIN public.usuarios u2 ON u2.id = uf2.usuario_id AND u2.rol = 'operador'
  WHERE uf2.familia_id IS NOT NULL AND uf2.usuario_id IS NOT NULL
  GROUP BY uf2.familia_id
  HAVING COUNT(DISTINCT uf2.usuario_id) > 1
)
ORDER BY f.nombre, u.nombre;
*/
