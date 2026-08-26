-- =============================================================================
-- MULTITENANT V1 · FASE 2A.5 — scope de catálogo por organización
--
-- Objetivo:
--   Sectores, familias, códigos internos y EAN dejan de tener unicidad global.
--   La misma nomenclatura puede existir en organizaciones distintas sin colisión,
--   manteniendo integridad compuesta dentro de cada tenant.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. SECTORES → organización
-- -----------------------------------------------------------------------------
ALTER TABLE public.sectores
  ADD COLUMN organizacion_id uuid;

UPDATE public.sectores
SET organizacion_id = '10000000-0000-4000-8000-000000000001'
WHERE organizacion_id IS NULL;

ALTER TABLE public.sectores
  ALTER COLUMN organizacion_id SET NOT NULL,
  ADD CONSTRAINT sectores_organizacion_fk
    FOREIGN KEY (organizacion_id)
    REFERENCES public.organizaciones(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT sectores_id_organizacion_uk UNIQUE (id, organizacion_id);

ALTER TABLE public.sectores DROP CONSTRAINT sectores_codigo_key;
ALTER TABLE public.sectores
  ADD CONSTRAINT sectores_organizacion_codigo_uk UNIQUE (organizacion_id, codigo);

CREATE INDEX sectores_organizacion_idx ON public.sectores(organizacion_id);

-- -----------------------------------------------------------------------------
-- 2. FAMILIAS → organización + sector del mismo tenant
-- -----------------------------------------------------------------------------
ALTER TABLE public.familias
  ADD COLUMN organizacion_id uuid;

UPDATE public.familias f
SET organizacion_id = s.organizacion_id
FROM public.sectores s
WHERE s.id = f.sector_id
  AND f.organizacion_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.familias WHERE organizacion_id IS NULL) THEN
    RAISE EXCEPTION
      'Migración multitenant abortada: existen familias sin sector/organización resoluble.';
  END IF;
END;
$$;

ALTER TABLE public.familias
  ALTER COLUMN organizacion_id SET NOT NULL,
  ADD CONSTRAINT familias_organizacion_fk
    FOREIGN KEY (organizacion_id)
    REFERENCES public.organizaciones(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT familias_id_organizacion_uk UNIQUE (id, organizacion_id);

-- La FK simple garantiza sector existente, pero no que pertenezca al mismo tenant.
ALTER TABLE public.familias DROP CONSTRAINT familias_sector_id_fkey;
ALTER TABLE public.familias
  ADD CONSTRAINT familias_sector_organizacion_fk
    FOREIGN KEY (sector_id, organizacion_id)
    REFERENCES public.sectores(id, organizacion_id)
    ON DELETE RESTRICT;

ALTER TABLE public.familias DROP CONSTRAINT familias_codigo_key;
ALTER TABLE public.familias
  ADD CONSTRAINT familias_organizacion_codigo_uk UNIQUE (organizacion_id, codigo);

CREATE INDEX familias_organizacion_idx ON public.familias(organizacion_id);

-- -----------------------------------------------------------------------------
-- 3. PRODUCTOS → familia del mismo tenant
-- `productos.organizacion_id` fue agregado en la migración 00200.
-- -----------------------------------------------------------------------------
ALTER TABLE public.productos
  ADD CONSTRAINT productos_familia_organizacion_fk
    FOREIGN KEY (familia_id, organizacion_id)
    REFERENCES public.familias(id, organizacion_id)
    ON DELETE RESTRICT;

-- Mantener la FK simple durante la transición es redundante pero inocuo. Se
-- elimina para que la relación autoritativa sea la compuesta por tenant.
ALTER TABLE public.productos DROP CONSTRAINT productos_familia_id_fkey;

-- -----------------------------------------------------------------------------
-- 4. CLAVES DE CATÁLOGO → unicidad por organización
--
-- Hoy existe una sola organización, así que el comportamiento de 091 no cambia.
-- Esto evita bloquear una futura empresa que legítimamente use el mismo cod_art
-- o EAN en su propio catálogo independiente.
-- -----------------------------------------------------------------------------
ALTER TABLE public.productos DROP CONSTRAINT productos_cod_art_key;
ALTER TABLE public.productos
  ADD CONSTRAINT productos_organizacion_cod_art_uk
  UNIQUE (organizacion_id, cod_art);

ALTER TABLE public.productos DROP CONSTRAINT productos_codigo_barras_key;
ALTER TABLE public.productos
  ADD CONSTRAINT productos_organizacion_codigo_barras_uk
  UNIQUE (organizacion_id, codigo_barras);

COMMENT ON COLUMN public.sectores.organizacion_id IS
  'Tenant propietario del sector.';
COMMENT ON COLUMN public.familias.organizacion_id IS
  'Tenant propietario de la familia; debe coincidir con el sector asociado.';

COMMIT;
