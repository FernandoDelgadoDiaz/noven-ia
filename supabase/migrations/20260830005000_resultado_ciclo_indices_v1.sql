-- NOVEN · INDICES DE RESULTADO DE CICLO V1
-- Índices alineados con Dashboard por sucursal/período y orden temporal del ledger.

create index if not exists acciones_operativas_sucursal_periodo_idx
  on public.acciones_operativas (sucursal_id, anio, trimestre);

create index if not exists venc_obs_vencimiento_fecha_id_idx
  on public.vencimiento_observaciones (vencimiento_id, observada_at, id);

create index if not exists rag_vencimiento_fecha_orden_idx
  on public.intervenciones_rag (vencimiento_id, aplicado_at, created_at, id);
