-- Índices de soporte para las FK incorporadas por jerarquía/invitaciones V1.
-- No cambia permisos ni datos; sólo evita scans innecesarios al crecer el volumen.

create index if not exists invitaciones_acceso_org_idx
  on public.invitaciones_acceso(organizacion_id);

create index if not exists invitaciones_acceso_zona_org_idx
  on public.invitaciones_acceso(zona_id, organizacion_id)
  where zona_id is not null;

create index if not exists invitaciones_acceso_sucursal_org_idx
  on public.invitaciones_acceso(sucursal_id, organizacion_id)
  where sucursal_id is not null;

create index if not exists zonas_region_org_idx
  on public.zonas(region_id, organizacion_id);
