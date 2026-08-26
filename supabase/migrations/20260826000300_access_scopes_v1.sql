-- =============================================================================
-- MULTITENANT V1 · FASE 2B — alcances de usuario y helpers RLS
--
-- Objetivo:
--   Crear una fuente de autorización jerárquica independiente del `usuarios.rol`
--   legacy, preparada para organización → zona → sucursal → familia.
--
-- Esta migración NO reemplaza todavía las policies de las tablas legacy.
-- Primero incorpora el modelo, backfill de 091 y helpers privados que la fase
-- de cutover usará para aislar datos en PostgreSQL.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. USUARIO_ACCESOS — alcance jerárquico de cada identidad
--
-- Un mismo usuario puede tener múltiples filas si su función abarca más de una
-- sucursal o cambia por organización. La combinación de rol + zona/sucursal
-- determina el scope, no el frontend.
-- -----------------------------------------------------------------------------
CREATE TABLE public.usuario_accesos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       uuid        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  organizacion_id  uuid        NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  rol              text        NOT NULL CHECK (
    rol IN ('admin_organizacion', 'gerente_zonal', 'gerente_sucursal', 'supervisor', 'operador')
  ),
  zona_id          uuid,
  sucursal_id      uuid,
  activo           boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usuario_accesos_zona_org_fk
    FOREIGN KEY (zona_id, organizacion_id)
    REFERENCES public.zonas(id, organizacion_id)
    ON DELETE CASCADE,

  CONSTRAINT usuario_accesos_sucursal_org_fk
    FOREIGN KEY (sucursal_id, organizacion_id)
    REFERENCES public.sucursales(id, organizacion_id)
    ON DELETE CASCADE,

  CONSTRAINT usuario_accesos_scope_valido CHECK (
    (rol = 'admin_organizacion' AND zona_id IS NULL AND sucursal_id IS NULL)
    OR
    (rol = 'gerente_zonal' AND zona_id IS NOT NULL AND sucursal_id IS NULL)
    OR
    (rol IN ('gerente_sucursal', 'supervisor', 'operador') AND zona_id IS NULL AND sucursal_id IS NOT NULL)
  )
);

-- PostgreSQL 17 soporta NULLS NOT DISTINCT, pero usamos índices parciales
-- simples para que el historial siga siendo portable y explícito.
CREATE UNIQUE INDEX usuario_accesos_org_uk
  ON public.usuario_accesos(usuario_id, organizacion_id, rol)
  WHERE zona_id IS NULL AND sucursal_id IS NULL;

CREATE UNIQUE INDEX usuario_accesos_zona_uk
  ON public.usuario_accesos(usuario_id, organizacion_id, rol, zona_id)
  WHERE zona_id IS NOT NULL AND sucursal_id IS NULL;

CREATE UNIQUE INDEX usuario_accesos_sucursal_uk
  ON public.usuario_accesos(usuario_id, organizacion_id, rol, sucursal_id)
  WHERE sucursal_id IS NOT NULL;

CREATE INDEX usuario_accesos_usuario_idx
  ON public.usuario_accesos(usuario_id)
  WHERE activo = true;
CREATE INDEX usuario_accesos_org_idx
  ON public.usuario_accesos(organizacion_id)
  WHERE activo = true;
CREATE INDEX usuario_accesos_zona_idx
  ON public.usuario_accesos(zona_id)
  WHERE activo = true AND zona_id IS NOT NULL;
CREATE INDEX usuario_accesos_sucursal_idx
  ON public.usuario_accesos(sucursal_id)
  WHERE activo = true AND sucursal_id IS NOT NULL;

ALTER TABLE public.usuario_accesos ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.usuario_accesos TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.usuario_accesos FROM authenticated, anon;
REVOKE ALL ON TABLE public.usuario_accesos FROM anon;

CREATE POLICY usuario_accesos_select_propios
  ON public.usuario_accesos
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = usuario_id);

CREATE TRIGGER usuario_accesos_set_updated_at
  BEFORE UPDATE ON public.usuario_accesos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. USUARIO_FAMILIAS_SUCURSAL — responsabilidad operativa local
--
-- Reemplazará gradualmente `usuario_familias`, cuya exclusividad hoy es global.
-- Aquí la misma familia puede estar asignada a un operador distinto en cada
-- sucursal, que es el comportamiento correcto para una cadena.
-- -----------------------------------------------------------------------------
CREATE TABLE public.usuario_familias_sucursal (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       uuid        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  organizacion_id  uuid        NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  sucursal_id      uuid        NOT NULL,
  familia_id       uuid        NOT NULL REFERENCES public.familias(id) ON DELETE RESTRICT,
  activo           boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usuario_familias_sucursal_sucursal_org_fk
    FOREIGN KEY (sucursal_id, organizacion_id)
    REFERENCES public.sucursales(id, organizacion_id)
    ON DELETE CASCADE,

  CONSTRAINT usuario_familias_sucursal_usuario_familia_uk
    UNIQUE (usuario_id, sucursal_id, familia_id)
);

-- Regla actual de NoVen: una familia tiene un operador responsable por sucursal.
-- Se hace parcial para que una asignación histórica pueda desactivarse y luego
-- reasignarse sin borrar trazabilidad.
CREATE UNIQUE INDEX usuario_familias_sucursal_responsable_uk
  ON public.usuario_familias_sucursal(sucursal_id, familia_id)
  WHERE activo = true;

CREATE INDEX usuario_familias_sucursal_usuario_idx
  ON public.usuario_familias_sucursal(usuario_id, sucursal_id)
  WHERE activo = true;
CREATE INDEX usuario_familias_sucursal_org_idx
  ON public.usuario_familias_sucursal(organizacion_id, sucursal_id)
  WHERE activo = true;

ALTER TABLE public.usuario_familias_sucursal ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.usuario_familias_sucursal TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.usuario_familias_sucursal FROM authenticated, anon;
REVOKE ALL ON TABLE public.usuario_familias_sucursal FROM anon;

CREATE POLICY usuario_familias_sucursal_select_propias
  ON public.usuario_familias_sucursal
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = usuario_id);

CREATE TRIGGER usuario_familias_sucursal_set_updated_at
  BEFORE UPDATE ON public.usuario_familias_sucursal
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. BACKFILL seguro de la Sucursal 091
--
-- El rol legacy NO se cambia. Para el nuevo scope:
--   admin      → gerente_sucursal de 091
--   supervisor → supervisor de 091
--   operador   → operador de 091
-- Esto evita convertir accidentalmente al gerente de una sucursal en admin de
-- toda la cadena cuando se incorporen nuevas zonas.
-- -----------------------------------------------------------------------------
INSERT INTO public.usuario_accesos (
  usuario_id,
  organizacion_id,
  rol,
  sucursal_id
)
SELECT
  u.id,
  '10000000-0000-4000-8000-000000000001',
  CASE u.rol
    WHEN 'admin' THEN 'gerente_sucursal'
    WHEN 'supervisor' THEN 'supervisor'
    ELSE 'operador'
  END,
  '00000000-0000-0000-0000-000000000001'
FROM public.usuarios u
WHERE u.activo = true;

-- Gate reproducible: si el legado contiene dos operadores distintos para la
-- misma familia, no elegimos uno en silencio. La migración se detiene y exige
-- corregir el dato antes de crear el scope por sucursal.
DO $$
DECLARE
  v_conflictos integer;
BEGIN
  SELECT count(*)
  INTO v_conflictos
  FROM (
    SELECT uf.familia_id
    FROM public.usuario_familias uf
    JOIN public.usuarios u ON u.id = uf.usuario_id
    WHERE u.rol = 'operador'
      AND u.activo = true
      AND uf.usuario_id IS NOT NULL
      AND uf.familia_id IS NOT NULL
    GROUP BY uf.familia_id
    HAVING count(DISTINCT uf.usuario_id) > 1
  ) conflictos;

  IF v_conflictos > 0 THEN
    RAISE EXCEPTION
      'Backfill multitenant abortado: % familia(s) legacy tienen más de un operador activo. Resolver antes de migrar.',
      v_conflictos;
  END IF;
END;
$$;

-- Solo las asignaciones de OPERADORES se trasladan a la tabla de responsabilidad
-- por familia. Gerentes y supervisores obtienen alcance por usuario_accesos y no
-- deben ocupar la exclusividad operativa de una familia.
INSERT INTO public.usuario_familias_sucursal (
  usuario_id,
  organizacion_id,
  sucursal_id,
  familia_id
)
SELECT
  uf.usuario_id,
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  uf.familia_id
FROM public.usuario_familias uf
JOIN public.usuarios u ON u.id = uf.usuario_id
WHERE u.rol = 'operador'
  AND u.activo = true
  AND uf.usuario_id IS NOT NULL
  AND uf.familia_id IS NOT NULL
ON CONFLICT (usuario_id, sucursal_id, familia_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. HELPERS PRIVADOS PARA RLS
--
-- Supabase recomienda que SECURITY DEFINER no viva en un schema expuesto.
-- Estas funciones solo sirven como predicados internos de policies.
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS noven_private;
REVOKE ALL ON SCHEMA noven_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA noven_private TO authenticated;

CREATE OR REPLACE FUNCTION noven_private.tiene_acceso_organizacion(p_organizacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_accesos ua
    WHERE ua.usuario_id = (SELECT auth.uid())
      AND ua.organizacion_id = p_organizacion_id
      AND ua.activo = true
  );
$$;

CREATE OR REPLACE FUNCTION noven_private.tiene_acceso_zona(p_zona_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.zonas z
    JOIN public.usuario_accesos ua
      ON ua.organizacion_id = z.organizacion_id
     AND ua.usuario_id = (SELECT auth.uid())
     AND ua.activo = true
    WHERE z.id = p_zona_id
      AND (
        ua.rol = 'admin_organizacion'
        OR (ua.rol = 'gerente_zonal' AND ua.zona_id = z.id)
        OR (
          ua.rol IN ('gerente_sucursal', 'supervisor', 'operador')
          AND EXISTS (
            SELECT 1
            FROM public.sucursales s
            WHERE s.id = ua.sucursal_id
              AND s.zona_id = z.id
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION noven_private.tiene_acceso_sucursal(p_sucursal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sucursales s
    JOIN public.usuario_accesos ua
      ON ua.organizacion_id = s.organizacion_id
     AND ua.usuario_id = (SELECT auth.uid())
     AND ua.activo = true
    WHERE s.id = p_sucursal_id
      AND (
        ua.rol = 'admin_organizacion'
        OR (ua.rol = 'gerente_zonal' AND ua.zona_id = s.zona_id)
        OR (
          ua.rol IN ('gerente_sucursal', 'supervisor', 'operador')
          AND ua.sucursal_id = s.id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION noven_private.puede_ver_familia_sucursal(
  p_sucursal_id uuid,
  p_familia_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sucursales s
    JOIN public.usuario_accesos ua
      ON ua.organizacion_id = s.organizacion_id
     AND ua.usuario_id = (SELECT auth.uid())
     AND ua.activo = true
    WHERE s.id = p_sucursal_id
      AND (
        ua.rol = 'admin_organizacion'
        OR (ua.rol = 'gerente_zonal' AND ua.zona_id = s.zona_id)
        OR (
          ua.rol IN ('gerente_sucursal', 'supervisor')
          AND ua.sucursal_id = s.id
        )
        OR (
          ua.rol = 'operador'
          AND ua.sucursal_id = s.id
          AND EXISTS (
            SELECT 1
            FROM public.usuario_familias_sucursal ufs
            WHERE ufs.usuario_id = ua.usuario_id
              AND ufs.sucursal_id = s.id
              AND ufs.familia_id = p_familia_id
              AND ufs.activo = true
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION noven_private.tiene_acceso_organizacion(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION noven_private.tiene_acceso_zona(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION noven_private.tiene_acceso_sucursal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION noven_private.puede_ver_familia_sucursal(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION noven_private.tiene_acceso_organizacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION noven_private.tiene_acceso_zona(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION noven_private.tiene_acceso_sucursal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION noven_private.puede_ver_familia_sucursal(uuid, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. POLICIES de las entidades NUEVAS solamente
--
-- Los helpers de abajo reciben columnas DE CADA FILA. Por eso se invocan
-- directamente. No se envuelven en `(SELECT helper(columna))`: Supabase solo
-- recomienda ese initPlan cuando el resultado NO depende de los datos de la fila.
-- -----------------------------------------------------------------------------
GRANT SELECT ON TABLE public.organizaciones TO authenticated;
GRANT SELECT ON TABLE public.zonas TO authenticated;
GRANT SELECT ON TABLE public.sucursales TO authenticated;
GRANT SELECT ON TABLE public.producto_codigos TO authenticated;
GRANT SELECT ON TABLE public.producto_sucursal TO authenticated;

CREATE POLICY organizaciones_select_scope
  ON public.organizaciones
  FOR SELECT
  TO authenticated
  USING (noven_private.tiene_acceso_organizacion(id));

CREATE POLICY zonas_select_scope
  ON public.zonas
  FOR SELECT
  TO authenticated
  USING (noven_private.tiene_acceso_zona(id));

-- Las policies legacy de `sucursales` siguen coexistiendo hasta el cutover, por
-- lo que esta policy todavía NO endurece por sí sola la tabla legacy.
CREATE POLICY sucursales_select_scope_v1
  ON public.sucursales
  FOR SELECT
  TO authenticated
  USING (noven_private.tiene_acceso_sucursal(id));

CREATE POLICY producto_codigos_select_scope
  ON public.producto_codigos
  FOR SELECT
  TO authenticated
  USING (noven_private.tiene_acceso_organizacion(organizacion_id));

CREATE POLICY producto_sucursal_select_scope
  ON public.producto_sucursal
  FOR SELECT
  TO authenticated
  USING (noven_private.tiene_acceso_sucursal(sucursal_id));

COMMENT ON TABLE public.usuario_accesos IS
  'Fuente de autorización multitenant: rol + scope organización/zona/sucursal.';
COMMENT ON TABLE public.usuario_familias_sucursal IS
  'Familias operativas asignadas por sucursal; reemplazo gradual de usuario_familias legacy.';

COMMIT;
