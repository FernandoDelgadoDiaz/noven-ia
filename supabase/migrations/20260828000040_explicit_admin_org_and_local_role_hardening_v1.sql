-- Aprobación explícita del propietario operativo: gerente091@gmail.com
-- conserva gerente_sucursal de la 091 y suma admin_organizacion.
-- Además, el flujo local de sucursal deja de poder crear/promover nuevos gerentes;
-- los gerentes nuevos deben nacer por el flujo de Accesos e invitaciones.

do $$
declare
  v_candidatos integer;
begin
  select count(*) into v_candidatos
  from auth.users u
  join public.usuario_accesos ua
    on ua.usuario_id = u.id
   and ua.rol = 'gerente_sucursal'
   and ua.activo = true
  join public.sucursales s
    on s.id = ua.sucursal_id
   and s.organizacion_id = ua.organizacion_id
  where lower(u.email) = 'gerente091@gmail.com'
    and s.codigo = '091'
    and s.activa = true;

  if v_candidatos <> 1 then
    raise exception 'Grant admin_organizacion ambiguo para gerente091@gmail.com: candidatos = %, esperado 1', v_candidatos;
  end if;
end $$;

insert into public.usuario_accesos (
  usuario_id, organizacion_id, rol, zona_id, sucursal_id, activo
)
select
  u.id,
  s.organizacion_id,
  'admin_organizacion',
  null,
  null,
  true
from auth.users u
join public.usuario_accesos ua
  on ua.usuario_id = u.id
 and ua.rol = 'gerente_sucursal'
 and ua.activo = true
join public.sucursales s
  on s.id = ua.sucursal_id
 and s.organizacion_id = ua.organizacion_id
where lower(u.email) = 'gerente091@gmail.com'
  and s.codigo = '091'
  and s.activa = true
on conflict (usuario_id, organizacion_id, rol)
where zona_id is null and sucursal_id is null
do update set
  activo = true,
  updated_at = now();

create or replace function public.guardar_usuario_sucursal_admin_v1(
  p_actor_id uuid,
  p_sucursal_id uuid,
  p_usuario_id uuid,
  p_nombre text,
  p_rol_legacy text,
  p_activo boolean,
  p_familias uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_org uuid;
  v_zona uuid;
  v_puede boolean;
  v_rol_scope text;
  v_familia uuid;
  v_ya_es_gerente_local boolean;
begin
  select s.organizacion_id, s.zona_id
    into v_org, v_zona
  from public.sucursales s
  where s.id = p_sucursal_id
    and s.activa = true;

  if v_org is null then
    raise exception 'Sucursal inexistente o inactiva' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.usuario_accesos ua
    where ua.usuario_id = p_actor_id
      and ua.organizacion_id = v_org
      and ua.activo = true
      and (
        ua.rol = 'admin_organizacion'
        or (ua.rol = 'gerente_zonal' and ua.zona_id = v_zona)
        or (ua.rol = 'gerente_sucursal' and ua.sucursal_id = p_sucursal_id)
      )
  ) into v_puede;

  if not v_puede then
    raise exception 'Sin permiso para administrar usuarios de esta sucursal' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_nombre, '')), '') is null then
    raise exception 'El nombre es obligatorio' using errcode = '22023';
  end if;

  if p_rol_legacy not in ('admin', 'supervisor', 'operador') then
    raise exception 'Rol inválido' using errcode = '22023';
  end if;

  -- El rol legacy admin sólo puede mantenerse sobre alguien que YA tenga
  -- gerente_sucursal en esta misma sucursal. Así editar un gerente existente
  -- sigue funcionando, pero crear/promover uno desde Admin local queda bloqueado.
  if p_rol_legacy = 'admin' then
    select exists (
      select 1
      from public.usuario_accesos ua
      where ua.usuario_id = p_usuario_id
        and ua.organizacion_id = v_org
        and ua.rol = 'gerente_sucursal'
        and ua.sucursal_id = p_sucursal_id
    ) into v_ya_es_gerente_local;

    if not v_ya_es_gerente_local then
      raise exception 'Los gerentes de sucursal se crean desde Accesos y jerarquía mediante invitación'
        using errcode = '42501';
    end if;
  end if;

  v_rol_scope := case p_rol_legacy
    when 'admin' then 'gerente_sucursal'
    when 'supervisor' then 'supervisor'
    else 'operador'
  end;

  insert into public.usuarios(id, nombre, rol, activo, sucursal_id)
  values(p_usuario_id, btrim(p_nombre), p_rol_legacy, p_activo, p_sucursal_id)
  on conflict(id) do update set
    nombre = excluded.nombre,
    rol = excluded.rol,
    activo = excluded.activo,
    sucursal_id = excluded.sucursal_id;

  delete from public.usuario_accesos ua
  where ua.usuario_id = p_usuario_id
    and ua.organizacion_id = v_org
    and ua.sucursal_id = p_sucursal_id;

  insert into public.usuario_accesos(
    usuario_id, organizacion_id, rol, sucursal_id, activo
  ) values (
    p_usuario_id, v_org, v_rol_scope, p_sucursal_id, p_activo
  );

  update public.usuario_familias_sucursal ufs
  set activo = false,
      updated_at = now()
  where ufs.usuario_id = p_usuario_id
    and ufs.sucursal_id = p_sucursal_id
    and ufs.activo = true;

  if p_rol_legacy = 'operador' and p_activo then
    foreach v_familia in array coalesce(p_familias, array[]::uuid[]) loop
      if not exists (
        select 1
        from public.familias f
        where f.id = v_familia
          and f.organizacion_id = v_org
      ) then
        raise exception 'Familia % no pertenece a la organización', v_familia using errcode = '23503';
      end if;

      insert into public.usuario_familias_sucursal(
        usuario_id, organizacion_id, sucursal_id, familia_id, activo
      ) values (
        p_usuario_id, v_org, p_sucursal_id, v_familia, true
      )
      on conflict(usuario_id, sucursal_id, familia_id) do update set
        activo = true,
        organizacion_id = excluded.organizacion_id,
        updated_at = now();
    end loop;
  end if;

  return jsonb_build_object(
    'usuario_id', p_usuario_id,
    'sucursal_id', p_sucursal_id,
    'rol', p_rol_legacy,
    'rol_scope', v_rol_scope,
    'activo', p_activo,
    'familias', case
      when p_rol_legacy = 'operador' and p_activo then coalesce(array_length(p_familias, 1), 0)
      else 0
    end
  );
end;
$$;
