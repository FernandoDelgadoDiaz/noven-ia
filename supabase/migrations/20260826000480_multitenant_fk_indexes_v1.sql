-- =============================================================================
-- MULTITENANT V1 · FASE 3E — índices de cobertura para FK compuestas
--
-- Objetivo:
--   Evitar scans innecesarios al crecer a decenas de sucursales y millones de
--   snapshots. Los índices cubren las FK nuevas señaladas por Supabase Advisor.
-- =============================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS familias_sector_org_idx
  ON public.familias(sector_id, organizacion_id);

CREATE INDEX IF NOT EXISTS importaciones_sucursal_org_idx
  ON public.importaciones(sucursal_id, organizacion_id);

CREATE INDEX IF NOT EXISTS producto_codigos_producto_org_idx
  ON public.producto_codigos(producto_id, organizacion_id);

CREATE INDEX IF NOT EXISTS producto_sucursal_producto_org_idx
  ON public.producto_sucursal(producto_id, organizacion_id);
CREATE INDEX IF NOT EXISTS producto_sucursal_sucursal_org_idx
  ON public.producto_sucursal(sucursal_id, organizacion_id);

CREATE INDEX IF NOT EXISTS producto_snapshots_import_scope_idx
  ON public.producto_snapshots(importacion_id, organizacion_id, sucursal_id);
CREATE INDEX IF NOT EXISTS producto_snapshots_producto_org_idx
  ON public.producto_snapshots(producto_id, organizacion_id);
CREATE INDEX IF NOT EXISTS producto_snapshots_sucursal_org_idx
  ON public.producto_snapshots(sucursal_id, organizacion_id);

CREATE INDEX IF NOT EXISTS productos_familia_org_idx
  ON public.productos(familia_id, organizacion_id)
  WHERE familia_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sucursales_zona_org_idx
  ON public.sucursales(zona_id, organizacion_id);

CREATE INDEX IF NOT EXISTS usuario_accesos_zona_org_idx
  ON public.usuario_accesos(zona_id, organizacion_id)
  WHERE zona_id IS NOT NULL AND activo = true;
CREATE INDEX IF NOT EXISTS usuario_accesos_sucursal_org_idx
  ON public.usuario_accesos(sucursal_id, organizacion_id)
  WHERE sucursal_id IS NOT NULL AND activo = true;

CREATE INDEX IF NOT EXISTS usuario_familias_sucursal_familia_idx
  ON public.usuario_familias_sucursal(familia_id);
CREATE INDEX IF NOT EXISTS usuario_familias_sucursal_familia_org_idx
  ON public.usuario_familias_sucursal(familia_id, organizacion_id);
CREATE INDEX IF NOT EXISTS usuario_familias_sucursal_sucursal_org_idx
  ON public.usuario_familias_sucursal(sucursal_id, organizacion_id)
  WHERE activo = true;

COMMIT;
