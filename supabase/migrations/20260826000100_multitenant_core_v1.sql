-- =============================================================================
-- MULTITENANT V1 · FASE 1 — núcleo organización → zona → sucursal
--
-- Objetivo:
--   Introducir la jerarquía multitenant sin cambiar todavía el flujo operativo
--   de la Sucursal 091 ni las policies existentes de tablas legacy.
--
-- Características:
--   - Aditiva: no elimina ni renombra columnas existentes.
--   - Migra la sucursal legacy 091 a organización/zona iniciales.
--   - Las tablas nuevas nacen con RLS habilitado y SIN acceso Data API para
--     anon/authenticated hasta que la Fase 3 incorpore policies por alcance.
--   - La coherencia zona↔organización se impone con FK compuesta.
--
-- IMPORTANTE:
--   Esta migración prepara estructura. NO corrige todavía las policies abiertas
--   de usuarios/vencimientos/acciones/productos. Eso se hará en una migración
--   específica de seguridad después de probar aislamiento con tenants ficticios.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ORGANIZACIONES — límite superior de tenant
-- -----------------------------------------------------------------------------
CREATE TABLE public.organizaciones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text        NOT NULL UNIQUE,
  nombre      text        NOT NULL,
  activa      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizaciones_codigo_no_vacio CHECK (btrim(codigo) <> ''),
  CONSTRAINT organizaciones_nombre_no_vacio CHECK (btrim(nombre) <> '')
);

ALTER TABLE public.organizaciones ENABLE ROW LEVEL SECURITY;

-- No exponer todavía al Data API: primero se implementará autorización por scope.
REVOKE ALL ON TABLE public.organizaciones FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. ZONAS — siempre pertenecen a una organización
-- -----------------------------------------------------------------------------
CREATE TABLE public.zonas (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id  uuid        NOT NULL REFERENCES public.organizaciones(id) ON DELETE RESTRICT,
  codigo           text        NOT NULL,
  nombre           text        NOT NULL,
  activa           boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zonas_codigo_no_vacio CHECK (btrim(codigo) <> ''),
  CONSTRAINT zonas_nombre_no_vacio CHECK (btrim(nombre) <> ''),
  CONSTRAINT zonas_organizacion_codigo_uk UNIQUE (organizacion_id, codigo),
  -- Necesaria para la FK compuesta desde sucursales: garantiza que una zona
  -- no pueda referenciarse bajo una organización distinta.
  CONSTRAINT zonas_id_organizacion_uk UNIQUE (id, organizacion_id)
);

CREATE INDEX zonas_organizacion_idx ON public.zonas(organizacion_id);
ALTER TABLE public.zonas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.zonas FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. SEED TRANSITORIO para los datos actuales
--
-- UUIDs determinísticos: permiten que un db reset reproduzca exactamente la
-- relación de la sucursal legacy sin depender del orden de ejecución.
-- El nombre de organización se toma de la sucursal existente cuando existe.
-- -----------------------------------------------------------------------------
INSERT INTO public.organizaciones (id, codigo, nombre)
VALUES (
  '10000000-0000-4000-8000-000000000001',
  'ORG001',
  COALESCE(
    (SELECT nombre FROM public.sucursales WHERE id = '00000000-0000-0000-0000-000000000001'),
    'Organización inicial'
  )
);

INSERT INTO public.zonas (id, organizacion_id, codigo, nombre)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'RGL',
  'Río Gallegos'
);

-- -----------------------------------------------------------------------------
-- 4. EXTENDER SUCURSALES con identidad jerárquica
-- -----------------------------------------------------------------------------
ALTER TABLE public.sucursales
  ADD COLUMN codigo text,
  ADD COLUMN organizacion_id uuid,
  ADD COLUMN zona_id uuid;

-- Migrar la única sucursal productiva actual (legacy id estable).
UPDATE public.sucursales
SET
  codigo = '091',
  organizacion_id = '10000000-0000-4000-8000-000000000001',
  zona_id = '20000000-0000-4000-8000-000000000001'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Gate de seguridad: si hubiera aparecido una sucursal no contemplada entre el
-- diseño y la ejecución, abortar en vez de asignarla silenciosamente a 091/RGL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.sucursales
    WHERE codigo IS NULL OR organizacion_id IS NULL OR zona_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Migración multitenant abortada: existen sucursales sin mapping explícito de organización/zona/código.';
  END IF;
END;
$$;

ALTER TABLE public.sucursales
  ALTER COLUMN codigo SET NOT NULL,
  ALTER COLUMN organizacion_id SET NOT NULL,
  ALTER COLUMN zona_id SET NOT NULL,
  ADD CONSTRAINT sucursales_codigo_no_vacio CHECK (btrim(codigo) <> ''),
  ADD CONSTRAINT sucursales_organizacion_fk
    FOREIGN KEY (organizacion_id)
    REFERENCES public.organizaciones(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT sucursales_zona_organizacion_fk
    FOREIGN KEY (zona_id, organizacion_id)
    REFERENCES public.zonas(id, organizacion_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT sucursales_organizacion_codigo_uk UNIQUE (organizacion_id, codigo);

CREATE INDEX sucursales_zona_idx ON public.sucursales(zona_id);
CREATE INDEX sucursales_organizacion_idx ON public.sucursales(organizacion_id);

-- -----------------------------------------------------------------------------
-- 5. TRIGGERS updated_at para las nuevas entidades
-- Reutiliza set_updated_at(), ya existente en el esquema legacy.
-- -----------------------------------------------------------------------------
CREATE TRIGGER organizaciones_set_updated_at
  BEFORE UPDATE ON public.organizaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER zonas_set_updated_at
  BEFORE UPDATE ON public.zonas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.organizaciones IS
  'Tenant superior de NoVen. Datos de negocio nunca deben cruzar organizaciones.';
COMMENT ON TABLE public.zonas IS
  'Agrupación de sucursales dentro de una organización para alcance zonal.';
COMMENT ON COLUMN public.sucursales.codigo IS
  'Código de sucursal del sistema fuente (por ejemplo Cod.Suc.Padrón de Glaciar).';

COMMIT;
