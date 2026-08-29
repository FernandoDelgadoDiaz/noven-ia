alter table public.acciones_operativas
  add column if not exists costo_unitario_sin_iva numeric,
  add column if not exists costo_observado_at timestamptz,
  add column if not exists valorizacion_metodo text;

alter table public.acciones_operativas
  drop constraint if exists acciones_operativas_costo_unitario_sin_iva_check;
alter table public.acciones_operativas
  add constraint acciones_operativas_costo_unitario_sin_iva_check
  check (costo_unitario_sin_iva is null or costo_unitario_sin_iva >= 0);

alter table public.acciones_operativas
  drop constraint if exists acciones_operativas_valorizacion_metodo_check;
alter table public.acciones_operativas
  add constraint acciones_operativas_valorizacion_metodo_check
  check (valorizacion_metodo is null or valorizacion_metodo in ('congelado_al_cierre','retrospectiva_0258'));

-- Los cierres previos a la disponibilidad de costos 0258 se valorizan sólo como
-- referencia retrospectiva y quedan explícitamente marcados como tales.
update public.acciones_operativas a
set costo_unitario_sin_iva = c.costo_unitario,
    costo_observado_at = c.observado_at,
    valorizacion_metodo = 'retrospectiva_0258'
from public.producto_costo_ultima_observacion c
where c.producto_id = a.producto_id
  and a.costo_unitario_sin_iva is null
  and c.costo_unitario is not null;

create or replace function public.cerrar_vencimiento_operativo_invoker_v1(
  p_vencimiento_id uuid,
  p_resultado text,
  p_observaciones text default null::text
)
returns uuid
language plpgsql
set search_path to 'public', 'noven_private', 'pg_temp'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_sucursal uuid;
  v_producto uuid;
  v_cantidad numeric;
  v_cantidad_accion integer;
  v_accion_id uuid;
  v_trimestre integer;
  v_anio integer;
  v_costo_unitario numeric;
  v_costo_observado_at timestamptz;
  v_fecha_operativa date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  if p_resultado not in ('vendido', 'donacion', 'decomiso') then
    raise exception 'Resultado terminal inválido: %', p_resultado using errcode = '22023';
  end if;

  select p.organizacion_id, v.sucursal_id, v.producto_id, v.cantidad
    into v_org, v_sucursal, v_producto, v_cantidad
  from public.vencimientos v
  join public.productos p on p.id = v.producto_id
  where v.id = p_vencimiento_id
    and v.activo = true
  for update of v;

  if not found then
    raise exception 'Vencimiento activo no encontrado o ya cerrado' using errcode = 'P0002';
  end if;

  if not noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) then
    raise exception 'Sin permiso para cerrar este vencimiento' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.acciones_operativas a
    where a.vencimiento_id = p_vencimiento_id
      and a.tipo in ('vendido', 'donacion', 'decomiso')
  ) then
    raise exception 'El vencimiento ya tiene un resultado terminal registrado' using errcode = '23505';
  end if;

  if p_resultado = 'vendido' then
    v_cantidad_accion := ceil(v_cantidad)::integer;

    insert into public.vencimiento_observaciones(
      organizacion_id, sucursal_id, producto_id, vencimiento_id,
      usuario_id, cantidad_comprometida, nota
    ) values (
      v_org, v_sucursal, v_producto, p_vencimiento_id,
      v_uid, 0, 'Cierre: vendido antes del vencimiento'
    );
  else
    if coalesce(v_cantidad, 0) <= 0 then
      raise exception 'No se puede registrar % con cantidad comprometida cero', p_resultado
        using errcode = '22023';
    end if;
    v_cantidad_accion := ceil(v_cantidad)::integer;
  end if;

  select c.costo_unitario, c.observado_at
    into v_costo_unitario, v_costo_observado_at
  from public.producto_costo_ultima_observacion c
  where c.producto_id = v_producto;

  v_anio := extract(year from v_fecha_operativa)::integer;
  v_trimestre := extract(quarter from v_fecha_operativa)::integer;

  insert into public.acciones_operativas(
    tipo, cantidad, producto_id, vencimiento_id, sucursal_id,
    usuario_id, trimestre, anio, observaciones,
    costo_unitario_sin_iva, costo_observado_at, valorizacion_metodo
  ) values (
    p_resultado, v_cantidad_accion, v_producto, p_vencimiento_id, v_sucursal,
    v_uid, v_trimestre, v_anio, nullif(btrim(coalesce(p_observaciones, '')), ''),
    v_costo_unitario, v_costo_observado_at,
    case when v_costo_unitario is not null then 'congelado_al_cierre' else null end
  )
  returning id into v_accion_id;

  update public.vencimientos
  set activo = false,
      updated_at = now()
  where id = p_vencimiento_id;

  return v_accion_id;
end;
$function$;

create or replace view public.v_acciones_operativas_historial
with (security_invoker = true)
as
select
  a.id,
  a.tipo,
  a.cantidad,
  a.created_at,
  a.observaciones,
  a.usuario_id,
  a.sucursal_id,
  a.producto_id,
  a.vencimiento_id,
  a.trimestre,
  a.anio,
  noven_private.nombre_actor_accion_visible(a.usuario_id, a.sucursal_id, a.producto_id) as usuario_nombre,
  p.descripcion as producto_descripcion,
  p.marca as producto_marca,
  p.imagen_url as producto_imagen_url,
  p.familia_id as producto_familia_id,
  p.gramaje as producto_gramaje,
  p.cod_art as producto_cod_art,
  p.codigo_barras as producto_codigo_barras,
  a.costo_unitario_sin_iva,
  case when a.costo_unitario_sin_iva is null then null else a.cantidad * a.costo_unitario_sin_iva end as valor_economico_sin_iva,
  a.costo_observado_at,
  a.valorizacion_metodo
from public.acciones_operativas a
join public.productos p on p.id = a.producto_id;
