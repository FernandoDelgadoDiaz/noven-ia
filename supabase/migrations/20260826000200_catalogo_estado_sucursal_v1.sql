-- =============================================================================
-- MULTITENANT V1 · FASE 2A — catálogo compartido vs estado por sucursal
--
-- Objetivo:
--   Evitar que stock_actual / venta_media_diaria de una sucursal pisen los de
--   otra cuando NoVen empiece a operar múltiples locales.
--
-- Estrategia de compatibilidad:
--   - `productos.stock_actual` y `productos.venta_media_diaria` NO se eliminan.
--   - El frontend actual sigue funcionando sin cambios.
--   - Se crea `producto_sucursal` y se backfillea la situación actual de 091.
--   - Se crea `producto_codigos` como futuro origen del vínculo EAN↔producto.
--   - Las nuevas tablas quedan fuera del Data API para authenticated hasta que
--     la capa de RLS multitenant esté terminada y probada.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. PRODUCTOS pasa a pertenecer explícitamente a una organización.
--    Por ahora existe una sola organización; las UNIQUE legacy de cod_art/EAN se
--    conservan para no cambiar comportamiento. Se relajarán a scope organización
--    únicamente antes de incorporar una segunda organización real.
-- -----------------------------------------------------------------------------
ALTER TABLE public.productos
  ADD COLUMN organizacion_id uuid;

UPDATE public.productos
SET organizacion_id = '10000000-0000-4000-8000-000000000001'
WHERE organizacion_id IS NULL;

ALTER TABLE public.productos
  ALTER COLUMN organizacion_id SET NOT NULL,
  ADD CONSTRAINT productos_organizacion_fk
    FOREIGN KEY (organizacion_id)
    REFERENCES public.organizaciones(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT productos_id_organizacion_uk UNIQUE (id, organizacion_id);

CREATE INDEX productos_organizacion_idx ON public.productos(organizacion_id);

-- Para FK compuesta desde producto_sucursal. El id sigue siendo PK; esta UNIQUE
-- agrega la prueba de pertenencia al tenant en la misma constraint.
ALTER TABLE public.sucursales
  ADD CONSTRAINT sucursales_id_organizacion_uk UNIQUE (id, organizacion_id);

-- -----------------------------------------------------------------------------
-- 2. PRODUCTO_CODIGOS — códigos de barras separados del código interno.
--
-- Un mismo producto puede cambiar de packaging y acumular varios EAN/UPC/GTIN.
-- El código es único dentro de la organización y nunca se reutiliza para otro
-- producto activo de la misma cadena.
-- -----------------------------------------------------------------------------
CREATE TABLE public.producto_codigos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id  uuid        NOT NULL,
  producto_id      uuid        NOT NULL,
  codigo           text        NOT NULL,
  tipo             text        NOT NULL DEFAULT 'otro'
                              CHECK (tipo IN ('ean8', 'upca', 'ean13', 'gtin14', 'otro')),
  es_principal     boolean     NOT NULL DEFAULT false,
  activo           boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT producto_codigos_codigo_no_vacio CHECK (btrim(codigo) <> ''),
  CONSTRAINT producto_codigos_producto_org_fk
    FOREIGN KEY (producto_id, organizacion_id)
    REFERENCES public.productos(id, organizacion_id)
    ON DELETE CASCADE,
  CONSTRAINT producto_codigos_org_codigo_uk UNIQUE (organizacion_id, codigo)
);

CREATE INDEX producto_codigos_producto_idx ON public.producto_codigos(producto_id);
CREATE INDEX producto_codigos_org_idx ON public.producto_codigos(organizacion_id);

ALTER TABLE public.producto_codigos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.producto_codigos FROM anon, authenticated;

CREATE TRIGGER producto_codigos_set_updated_at
  BEFORE UPDATE ON public.producto_codigos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Backfill de los EAN/UPC/GTIN ya reconciliados por la Sucursal 091.
INSERT INTO public.producto_codigos (
  organizacion_id,
  producto_id,
  codigo,
  tipo,
  es_principal
)
SELECT
  p.organizacion_id,
  p.id,
  btrim(p.codigo_barras),
  CASE length(btrim(p.codigo_barras))
    WHEN 8  THEN 'ean8'
    WHEN 12 THEN 'upca'
    WHEN 13 THEN 'ean13'
    WHEN 14 THEN 'gtin14'
    ELSE 'otro'
  END,
  true
FROM public.productos p
WHERE p.codigo_barras IS NOT NULL
  AND btrim(p.codigo_barras) <> '';

-- -----------------------------------------------------------------------------
-- 3. PRODUCTO_SUCURSAL — estado operativo local.
--
-- Esta tabla será la fuente de verdad de stock/VMD cuando el frontend migre.
-- Hasta entonces se mantiene sincronización manual/legacy únicamente en 091.
-- -----------------------------------------------------------------------------
CREATE TABLE public.producto_sucursal (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id          uuid        NOT NULL,
  producto_id              uuid        NOT NULL,
  sucursal_id              uuid        NOT NULL,
  stock_actual             integer     NOT NULL DEFAULT 0,
  venta_media_diaria       numeric     NOT NULL DEFAULT 0,
  fecha_ultima_importacion timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT producto_sucursal_producto_org_fk
    FOREIGN KEY (producto_id, organizacion_id)
    REFERENCES public.productos(id, organizacion_id)
    ON DELETE CASCADE,

  CONSTRAINT producto_sucursal_sucursal_org_fk
    FOREIGN KEY (sucursal_id, organizacion_id)
    REFERENCES public.sucursales(id, organizacion_id)
    ON DELETE CASCADE,

  CONSTRAINT producto_sucursal_producto_sucursal_uk
    UNIQUE (producto_id, sucursal_id)
);

CREATE INDEX producto_sucursal_sucursal_idx
  ON public.producto_sucursal(sucursal_id);
CREATE INDEX producto_sucursal_org_sucursal_idx
  ON public.producto_sucursal(organizacion_id, sucursal_id);

ALTER TABLE public.producto_sucursal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.producto_sucursal FROM anon, authenticated;

CREATE TRIGGER producto_sucursal_set_updated_at
  BEFORE UPDATE ON public.producto_sucursal
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Backfill 1:1 del estado legacy actual de 091. No modifica productos.
INSERT INTO public.producto_sucursal (
  organizacion_id,
  producto_id,
  sucursal_id,
  stock_actual,
  venta_media_diaria,
  fecha_ultima_importacion
)
SELECT
  p.organizacion_id,
  p.id,
  '00000000-0000-0000-0000-000000000001',
  p.stock_actual,
  p.venta_media_diaria,
  p.updated_at
FROM public.productos p
WHERE p.organizacion_id = '10000000-0000-4000-8000-000000000001';

COMMENT ON TABLE public.producto_codigos IS
  'Códigos EAN/UPC/GTIN compartidos por catálogo dentro de una organización.';
COMMENT ON TABLE public.producto_sucursal IS
  'Estado operativo de un producto por sucursal. Futura fuente de verdad para stock y VMD.';
COMMENT ON COLUMN public.productos.organizacion_id IS
  'Tenant propietario del producto de catálogo.';

COMMIT;
