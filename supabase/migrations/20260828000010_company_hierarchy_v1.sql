-- Jerarquía corporativa oficial de Noven
-- Fuente: Ticket Virtual - Ultimos 7 dias, 27/08/2026.
-- 5 regiones · 17 zonas · 183 sucursales.
-- No inventa nombres geográficos de sucursal: los locales nuevos nacen como "Sucursal NNN".
-- Los locales ya existentes conservan id, nombre y dirección.

create table if not exists public.regiones (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete restrict,
  codigo text not null,
  nombre text not null,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint regiones_codigo_no_vacio check (btrim(codigo) <> ''),
  constraint regiones_nombre_no_vacio check (btrim(nombre) <> ''),
  constraint regiones_organizacion_codigo_uk unique (organizacion_id, codigo),
  constraint regiones_id_organizacion_uk unique (id, organizacion_id)
);

alter table public.regiones enable row level security;

drop policy if exists regiones_select_scope on public.regiones;
create policy regiones_select_scope
  on public.regiones
  for select
  to authenticated
  using (noven_private.tiene_acceso_organizacion(organizacion_id));

create index if not exists idx_regiones_organizacion
  on public.regiones(organizacion_id);

alter table public.zonas
  add column if not exists region_id uuid;

insert into public.regiones (organizacion_id, codigo, nombre, activa)
select o.id, v.codigo, v.nombre, true
from public.organizaciones o
cross join (values
    ('NORTE', 'Norte'),
    ('CENTRO', 'Centro'),
    ('SUR', 'Sur'),
    ('PAMPA_ANDINA', 'Pampa Andina'),
    ('LIBERTAD', 'Libertad')
) as v(codigo, nombre)
where o.codigo = 'ORG001'
on conflict (organizacion_id, codigo)
do update set
  nombre = excluded.nombre,
  activa = true,
  updated_at = now();

insert into public.zonas (organizacion_id, codigo, nombre, activa)
select o.id, v.codigo, v.nombre, true
from public.organizaciones o
cross join (values
    ('BA', 'Buenos Aires'),
    ('CSF', 'Córdoba - Santa Fe'),
    ('LIT', 'Litoral'),
    ('NEI', 'Neuquén Interior'),
    ('RN', 'Río Negro'),
    ('TRW', 'Trelew'),
    ('NEC', 'Neuquén Ciudad'),
    ('VIE', 'Viedma'),
    ('SCN', 'Santa Cruz Norte'),
    ('CR', 'Comodoro Rivadavia'),
    ('SCS', 'Santa Cruz Sur'),
    ('TDF', 'Tierra del Fuego'),
    ('LP', 'La Pampa'),
    ('BAR', 'Bariloche'),
    ('ESQ', 'Esquel'),
    ('LIBC', 'Libertad Centro'),
    ('LIBN', 'Libertad Norte')
) as v(codigo, nombre)
where o.codigo = 'ORG001'
on conflict (organizacion_id, codigo)
do update set
  nombre = excluded.nombre,
  activa = true,
  updated_at = now();

update public.zonas z
set region_id = r.id,
    updated_at = now()
from public.regiones r,
(values
    ('BA', 'NORTE'),
    ('CSF', 'NORTE'),
    ('LIT', 'NORTE'),
    ('NEI', 'CENTRO'),
    ('RN', 'CENTRO'),
    ('TRW', 'CENTRO'),
    ('NEC', 'CENTRO'),
    ('VIE', 'CENTRO'),
    ('SCN', 'SUR'),
    ('CR', 'SUR'),
    ('SCS', 'SUR'),
    ('TDF', 'SUR'),
    ('LP', 'PAMPA_ANDINA'),
    ('BAR', 'PAMPA_ANDINA'),
    ('ESQ', 'PAMPA_ANDINA'),
    ('LIBC', 'LIBERTAD'),
    ('LIBN', 'LIBERTAD')
) as m(zona_codigo, region_codigo)
where z.organizacion_id = r.organizacion_id
  and z.codigo = m.zona_codigo
  and r.codigo = m.region_codigo
  and z.organizacion_id = (
    select id from public.organizaciones where codigo = 'ORG001'
  );

do $$
begin
  if exists (
    select 1
    from public.zonas z
    join public.organizaciones o on o.id = z.organizacion_id
    where o.codigo = 'ORG001'
      and z.region_id is null
  ) then
    raise exception 'Existen zonas de ORG001 sin región asignada';
  end if;
end $$;

alter table public.zonas
  alter column region_id set not null;

alter table public.zonas
  drop constraint if exists zonas_region_organizacion_fk;

alter table public.zonas
  add constraint zonas_region_organizacion_fk
  foreign key (region_id, organizacion_id)
  references public.regiones(id, organizacion_id)
  on delete restrict;

create index if not exists idx_zonas_region
  on public.zonas(region_id);

insert into public.sucursales (organizacion_id, zona_id, codigo, nombre, activa)
select o.id, z.id, v.sucursal_codigo, 'Sucursal ' || v.sucursal_codigo, true
from public.organizaciones o
join (values
    ('BA', '055'),
    ('BA', '057'),
    ('BA', '058'),
    ('BA', '085'),
    ('BA', '089'),
    ('BA', '096'),
    ('BA', '100'),
    ('BA', '101'),
    ('BA', '118'),
    ('BA', '125'),
    ('BA', '173'),
    ('BA', '185'),
    ('BA', '201'),
    ('BA', '260'),
    ('CSF', '067'),
    ('CSF', '114'),
    ('CSF', '119'),
    ('CSF', '150'),
    ('CSF', '151'),
    ('CSF', '152'),
    ('CSF', '156'),
    ('CSF', '221'),
    ('CSF', '261'),
    ('CSF', '264'),
    ('CSF', '351'),
    ('CSF', '388'),
    ('LIT', '153'),
    ('LIT', '171'),
    ('LIT', '206'),
    ('LIT', '359'),
    ('LIT', '361'),
    ('LIT', '368'),
    ('LIT', '369'),
    ('NEI', '050'),
    ('NEI', '076'),
    ('NEI', '172'),
    ('NEI', '182'),
    ('NEI', '188'),
    ('NEI', '213'),
    ('NEI', '228'),
    ('NEI', '230'),
    ('NEI', '234'),
    ('NEI', '247'),
    ('NEI', '259'),
    ('NEI', '266'),
    ('NEI', '356'),
    ('NEI', '357'),
    ('RN', '007'),
    ('RN', '010'),
    ('RN', '042'),
    ('RN', '048'),
    ('RN', '051'),
    ('RN', '053'),
    ('RN', '092'),
    ('RN', '164'),
    ('RN', '195'),
    ('RN', '238'),
    ('RN', '241'),
    ('RN', '242'),
    ('RN', '243'),
    ('RN', '246'),
    ('RN', '265'),
    ('RN', '363'),
    ('TRW', '012'),
    ('TRW', '013'),
    ('TRW', '014'),
    ('TRW', '016'),
    ('TRW', '044'),
    ('TRW', '045'),
    ('TRW', '134'),
    ('TRW', '167'),
    ('TRW', '181'),
    ('TRW', '207'),
    ('NEC', '006'),
    ('NEC', '068'),
    ('NEC', '162'),
    ('NEC', '225'),
    ('NEC', '226'),
    ('NEC', '229'),
    ('NEC', '232'),
    ('NEC', '233'),
    ('NEC', '235'),
    ('NEC', '236'),
    ('NEC', '237'),
    ('NEC', '239'),
    ('NEC', '240'),
    ('NEC', '248'),
    ('VIE', '011'),
    ('VIE', '046'),
    ('VIE', '047'),
    ('VIE', '069'),
    ('VIE', '163'),
    ('VIE', '208'),
    ('VIE', '215'),
    ('VIE', '216'),
    ('SCN', '031'),
    ('SCN', '032'),
    ('SCN', '097'),
    ('SCN', '145'),
    ('SCN', '160'),
    ('SCN', '184'),
    ('SCN', '186'),
    ('SCN', '192'),
    ('SCN', '197'),
    ('SCN', '214'),
    ('SCN', '217'),
    ('SCN', '263'),
    ('CR', '021'),
    ('CR', '022'),
    ('CR', '023'),
    ('CR', '024'),
    ('CR', '025'),
    ('CR', '104'),
    ('CR', '159'),
    ('CR', '179'),
    ('CR', '218'),
    ('SCS', '033'),
    ('SCS', '043'),
    ('SCS', '072'),
    ('SCS', '091'),
    ('SCS', '124'),
    ('SCS', '131'),
    ('SCS', '138'),
    ('SCS', '161'),
    ('SCS', '183'),
    ('SCS', '198'),
    ('SCS', '199'),
    ('SCS', '200'),
    ('SCS', '204'),
    ('SCS', '205'),
    ('SCS', '360'),
    ('TDF', '035'),
    ('TDF', '036'),
    ('TDF', '037'),
    ('TDF', '038'),
    ('TDF', '056'),
    ('TDF', '074'),
    ('TDF', '075'),
    ('TDF', '141'),
    ('TDF', '166'),
    ('TDF', '211'),
    ('TDF', '220'),
    ('LP', '090'),
    ('LP', '103'),
    ('LP', '105'),
    ('LP', '109'),
    ('LP', '117'),
    ('LP', '122'),
    ('LP', '127'),
    ('LP', '143'),
    ('LP', '148'),
    ('LP', '149'),
    ('LP', '187'),
    ('LP', '196'),
    ('LP', '202'),
    ('LP', '203'),
    ('BAR', '004'),
    ('BAR', '008'),
    ('BAR', '009'),
    ('BAR', '084'),
    ('BAR', '175'),
    ('BAR', '177'),
    ('ESQ', '015'),
    ('ESQ', '017'),
    ('ESQ', '018'),
    ('ESQ', '102'),
    ('ESQ', '147'),
    ('ESQ', '165'),
    ('ESQ', '168'),
    ('ESQ', '189'),
    ('ESQ', '212'),
    ('ESQ', '257'),
    ('LIBC', '377'),
    ('LIBC', '378'),
    ('LIBC', '379'),
    ('LIBC', '380'),
    ('LIBC', '381'),
    ('LIBC', '387'),
    ('LIBN', '382'),
    ('LIBN', '383'),
    ('LIBN', '384'),
    ('LIBN', '385'),
    ('LIBN', '386')
) as v(zona_codigo, sucursal_codigo) on true
join public.zonas z
  on z.organizacion_id = o.id
 and z.codigo = v.zona_codigo
where o.codigo = 'ORG001'
on conflict (organizacion_id, codigo)
do update set
  zona_id = excluded.zona_id,
  activa = true;

do $$
declare
  v_org uuid;
  v_regiones integer;
  v_zonas integer;
  v_sucursales integer;
begin
  select id into v_org
  from public.organizaciones
  where codigo = 'ORG001';

  select count(*) into v_regiones
  from public.regiones
  where organizacion_id = v_org and activa = true;

  select count(*) into v_zonas
  from public.zonas
  where organizacion_id = v_org and activa = true;

  select count(*) into v_sucursales
  from public.sucursales
  where organizacion_id = v_org and activa = true;

  if v_regiones <> 5 then
    raise exception 'Jerarquía inválida: regiones %, esperado 5', v_regiones;
  end if;
  if v_zonas <> 17 then
    raise exception 'Jerarquía inválida: zonas %, esperado 17', v_zonas;
  end if;
  if v_sucursales <> 183 then
    raise exception 'Jerarquía inválida: sucursales %, esperado 183', v_sucursales;
  end if;
end $$;
