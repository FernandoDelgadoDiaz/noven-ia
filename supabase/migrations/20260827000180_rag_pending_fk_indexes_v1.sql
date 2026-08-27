-- =============================================================================
-- NOVEN · ÍNDICES FK RAG + PENDIENTES COMPARTIDOS V1
--
-- Cubre las claves foráneas nuevas señaladas por Supabase Advisor después de
-- probar el esquema completo en una branch descartable.
-- =============================================================================

BEGIN;

-- vencimiento_observaciones
CREATE INDEX IF NOT EXISTS venc_obs_organizacion_idx
  ON public.vencimiento_observaciones(organizacion_id);
CREATE INDEX IF NOT EXISTS venc_obs_usuario_idx
  ON public.vencimiento_observaciones(usuario_id);
CREATE INDEX IF NOT EXISTS venc_obs_sucursal_org_idx
  ON public.vencimiento_observaciones(sucursal_id, organizacion_id);
CREATE INDEX IF NOT EXISTS venc_obs_vencimiento_scope_idx
  ON public.vencimiento_observaciones(vencimiento_id, producto_id, sucursal_id);

-- intervenciones_rag
CREATE INDEX IF NOT EXISTS rag_organizacion_idx
  ON public.intervenciones_rag(organizacion_id);
CREATE INDEX IF NOT EXISTS rag_usuario_idx
  ON public.intervenciones_rag(usuario_id);
CREATE INDEX IF NOT EXISTS rag_sucursal_org_idx
  ON public.intervenciones_rag(sucursal_id, organizacion_id);
CREATE INDEX IF NOT EXISTS rag_vencimiento_scope_idx
  ON public.intervenciones_rag(vencimiento_id, producto_id, sucursal_id);

-- productos_pendientes_catalogo
CREATE INDEX IF NOT EXISTS productos_pendientes_clasificado_por_idx
  ON public.productos_pendientes_catalogo(clasificado_por)
  WHERE clasificado_por IS NOT NULL;
CREATE INDEX IF NOT EXISTS productos_pendientes_familia_org_idx
  ON public.productos_pendientes_catalogo(familia_id_resuelta, organizacion_id)
  WHERE familia_id_resuelta IS NOT NULL;
CREATE INDEX IF NOT EXISTS productos_pendientes_producto_org_idx
  ON public.productos_pendientes_catalogo(producto_id, organizacion_id)
  WHERE producto_id IS NOT NULL;

-- producto_pendiente_detecciones
CREATE INDEX IF NOT EXISTS pendiente_detecciones_org_idx
  ON public.producto_pendiente_detecciones(organizacion_id);
CREATE INDEX IF NOT EXISTS pendiente_detecciones_sucursal_org_idx
  ON public.producto_pendiente_detecciones(sucursal_id, organizacion_id);
CREATE INDEX IF NOT EXISTS pendiente_detecciones_import_scope_idx
  ON public.producto_pendiente_detecciones(importacion_id, organizacion_id, sucursal_id);

COMMIT;
