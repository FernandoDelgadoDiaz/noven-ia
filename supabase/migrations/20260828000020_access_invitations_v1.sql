-- Invitaciones de acceso jerárquico V1.
-- Admin organización -> gerente zonal / gerente sucursal.
-- Gerente zonal -> gerente sucursal de su propia zona.
-- Supervisor/operador continúan administrándose desde cada sucursal.
-- Los accesos invitados nacen inactivos y sólo se activan al crear la contraseña.
-- Esta migración NO promueve automáticamente ninguna cuenta existente.

create table if not exists public.invitaciones_acceso (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  email text not null,
  nombre text not null,
  rol text not null,
  zona_id uuid,
  sucursal_id uuid,
  creado_por uuid not null references public.usuarios(id) on delete restrict,
  canal text not null,
  estado text not null default 'pendiente',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  anulada_at timestamptz,
  constraint invitaciones_acceso_email_no_vacio check (btrim(email) <> ''),
  constraint invitaciones_acceso_nombre_no_vacio check (btrim(nombre) <> ''),
  constraint invitaciones_acceso_rol_check check (rol in ('gerente_zonal','gerente_sucursal')),
  constraint invitaciones_acceso_canal_check check (canal in ('link','email')),
  constraint invitaciones_acceso_estado_check check (estado in ('pendiente','aceptada','anulada')),
  constraint invitaciones_acceso_scope_valido check (
    (rol = 'gerente_zonal' and zona_id is not null and sucursal_id is null)
    or
    (rol = 'gerente_sucursal' and zona_id is null and sucursal_id is not null)
  ),
  constraint invitaciones_acceso_zona_org_fk
    foreign key (zona_id, organizacion_id)
    references public.zonas(id, organizacion_id)
    on delete cascade,
  constraint invitaciones_acceso_sucursal_org_fk
    foreign key (sucursal_id, organizacion_id)
    references public.sucursales(id, organizacion_id)
    on delete cascade
);

alter table public.invitaciones_acceso enable row level security;

create index if not exists invitaciones_acceso_usuario_idx
  on public.invitaciones_acceso(usuario_id, estado);
create index if not exists invitaciones_acceso_creador_idx
  on public.invitaciones_acceso(creado_por, created_at desc);
create index if not exists invitaciones_acceso_email_idx
  on public.invitaciones_acceso(lower(email));

create or replace function public.listar_contexto_altas_v1(p_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_puede boolean;
  v_puede_zonal boolean;
begin
  select exists (
    select 1
    from public.usuario_accesos ua
    where ua.usuario_id = p_actor_id
      and ua.activo = true
      and ua.rol in ('admin_organizacion','gerente_zonal')
  ) into v_puede;

  if not v_puede then
    raise exception 'Sin permiso para administrar accesos de organización o zona'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.usuario_accesos ua
    where ua.usuario_id = p_actor_id
      and ua.activo = true
      and ua.rol = 'admin_organizacion'
  ) into v_puede_zonal;

  return jsonb_build_object(
    'puede_crear_zonal', v_puede_zonal,
    'regiones', coalesce((
      select jsonb_agg(item order by item->>'nombre')
      from (
        select distinct jsonb_build_object(
          'id', r.id,
          'codigo', r.codigo,
          'nombre', r.nombre,
          'organizacion_id', r.organizacion_id
        ) as item
        from public.regiones r
        join public.zonas z on z.region_id = r.id and z.activa = true
        where r.activa = true
          and exists (
            select 1
            from public.usuario_accesos ua
            where ua.usuario_id = p_actor_id
              and ua.activo = true
              and ua.organizacion_id = r.organizacion_id
              and (
                ua.rol = 'admin_organizacion'
                or (ua.rol = 'gerente_zonal' and ua.zona_id = z.id)
              )
          )
      ) q
    ), '[]'::jsonb),
    'zonas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', z.id,
        'codigo', z.codigo,
        'nombre', z.nombre,
        'region_id', z.region_id,
        'organizacion_id', z.organizacion_id
      ) order by z.nombre)
      from public.zonas z
      where z.activa = true
        and exists (
          select 1
          from public.usuario_accesos ua
          where ua.usuario_id = p_actor_id
            and ua.activo = true
            and ua.organizacion_id = z.organizacion_id
            and (
              ua.rol = 'admin_organizacion'
              or (ua.rol = 'gerente_zonal' and ua.zona_id = z.id)
            )
        )
    ), '[]'::jsonb),
    'sucursales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'codigo', s.codigo,
        'nombre', s.nombre,
        'zona_id', s.zona_id,
        'organizacion_id', s.organizacion_id
      ) order by s.codigo)
      from public.sucursales s
      join public.zonas z on z.id = s.zona_id
      where s.activa = true
        and z.activa = true
        and exists (
          select 1
          from public.usuario_accesos ua
          where ua.usuario_id = p_actor_id
            and ua.activo = true
            and ua.organizacion_id = s.organizacion_id
            and (
              ua.rol = 'admin_organizacion'
              or (ua.rol = 'gerente_zonal' and ua.zona_id = s.zona_id)
            )
        )
    ), '[]'::jsonb),
    'accesos_actor', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rol', ua.rol,
        'organizacion_id', ua.organizacion_id,
        'zona_id', ua.zona_id,
        'sucursal_id', ua.sucursal_id
      ) order by ua.created_at)
      from public.usuario_accesos ua
      where ua.usuario_id = p_actor_id
        and ua.activo = true
        and ua.rol in ('admin_organizacion','gerente_zonal')
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.registrar_invitacion_acceso_v1(
  p_actor_id uuid,
  p_usuario_id uuid,
  p_email text,
  p_nombre text,
  p_rol text,
  p_zona_id uuid default null,
  p_sucursal_id uuid default null,
  p_canal text default 'link'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_org uuid;
  v_zona_objetivo uuid;
  v_puede boolean;
  v_invitacion_id uuid;
begin
  if nullif(btrim(coalesce(p_nombre,'')), '') is null then
    raise exception 'El nombre es obligatorio' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_email,'')), '') is null then
    raise exception 'El email es obligatorio' using errcode = '22023';
  end if;
  if p_rol not in ('gerente_zonal','gerente_sucursal') then
    raise exception 'Rol de invitación inválido' using errcode = '22023';
  end if;
  if p_canal not in ('link','email') then
    raise exception 'Canal de invitación inválido' using errcode = '22023';
  end if;

  if exists (select 1 from public.usuarios u where u.id = p_usuario_id) then
    raise exception 'La cuenta ya está registrada en Noven' using errcode = '23505';
  end if;

  if p_rol = 'gerente_zonal' then
    if p_zona_id is null or p_sucursal_id is not null then
      raise exception 'Gerente zonal requiere una zona' using errcode = '22023';
    end if;
    select z.organizacion_id, z.id
      into v_org, v_zona_objetivo
    from public.zonas z
    where z.id = p_zona_id and z.activa = true;
  else
    if p_sucursal_id is null or p_zona_id is not null then
      raise exception 'Gerente de sucursal requiere una sucursal' using errcode = '22023';
    end if;
    select s.organizacion_id, s.zona_id
      into v_org, v_zona_objetivo
    from public.sucursales s
    where s.id = p_sucursal_id and s.activa = true;
  end if;

  if v_org is null then
    raise exception 'Alcance inexistente o inactivo' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.usuario_accesos ua
    where ua.usuario_id = p_actor_id
      and ua.organizacion_id = v_org
      and ua.activo = true
      and (
        ua.rol = 'admin_organizacion'
        or (
          p_rol = 'gerente_sucursal'
          and ua.rol = 'gerente_zonal'
          and ua.zona_id = v_zona_objetivo
        )
      )
  ) into v_puede;

  if not v_puede then
    raise exception 'Sin permiso para crear este acceso' using errcode = '42501';
  end if;

  if p_rol = 'gerente_zonal' and not exists (
    select 1
    from public.usuario_accesos ua
    where ua.usuario_id = p_actor_id
      and ua.organizacion_id = v_org
      and ua.rol = 'admin_organizacion'
      and ua.activo = true
  ) then
    raise exception 'Solo el administrador de organización puede crear gerentes zonales'
      using errcode = '42501';
  end if;

  -- La tabla usuarios conserva tres valores legacy. Para evitar que un gerente
  -- zonal parezca un admin de sucursal en código viejo, se proyecta como supervisor;
  -- el permiso real y completo siempre vive en usuario_accesos.
  -- Tanto el perfil como el acceso quedan inactivos hasta aceptar la invitación.
  insert into public.usuarios(id, nombre, rol, sucursal_id, activo)
  values (
    p_usuario_id,
    btrim(p_nombre),
    case when p_rol = 'gerente_sucursal' then 'admin' else 'supervisor' end,
    case when p_rol = 'gerente_sucursal' then p_sucursal_id else null end,
    false
  );

  insert into public.usuario_accesos(
    usuario_id, organizacion_id, rol, zona_id, sucursal_id, activo
  ) values (
    p_usuario_id,
    v_org,
    p_rol,
    case when p_rol = 'gerente_zonal' then p_zona_id else null end,
    case when p_rol = 'gerente_sucursal' then p_sucursal_id else null end,
    false
  );

  insert into public.invitaciones_acceso(
    usuario_id, organizacion_id, email, nombre, rol, zona_id, sucursal_id,
    creado_por, canal, estado
  ) values (
    p_usuario_id, v_org, lower(btrim(p_email)), btrim(p_nombre), p_rol,
    case when p_rol = 'gerente_zonal' then p_zona_id else null end,
    case when p_rol = 'gerente_sucursal' then p_sucursal_id else null end,
    p_actor_id, p_canal, 'pendiente'
  ) returning id into v_invitacion_id;

  return jsonb_build_object(
    'invitacion_id', v_invitacion_id,
    'usuario_id', p_usuario_id,
    'rol', p_rol,
    'organizacion_id', v_org,
    'zona_id', case when p_rol = 'gerente_zonal' then p_zona_id else null end,
    'sucursal_id', case when p_rol = 'gerente_sucursal' then p_sucursal_id else null end,
    'estado', 'pendiente'
  );
end;
$$;

create or replace function public.aceptar_invitacion_acceso_v1()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.invitaciones_acceso ia
  where ia.usuario_id = auth.uid()
    and ia.estado = 'pendiente';

  if v_count = 0 then
    return 0;
  end if;

  -- Activa únicamente los accesos respaldados por una invitación pendiente
  -- del usuario autenticado. No activa otros scopes históricos/inactivos.
  update public.usuario_accesos ua
  set activo = true,
      updated_at = now()
  where ua.usuario_id = auth.uid()
    and ua.activo = false
    and exists (
      select 1
      from public.invitaciones_acceso ia
      where ia.usuario_id = ua.usuario_id
        and ia.organizacion_id = ua.organizacion_id
        and ia.rol = ua.rol
        and ia.estado = 'pendiente'
        and (
          (ia.rol = 'gerente_zonal' and ia.zona_id = ua.zona_id and ua.sucursal_id is null)
          or
          (ia.rol = 'gerente_sucursal' and ia.sucursal_id = ua.sucursal_id and ua.zona_id is null)
        )
    );

  update public.usuarios
  set activo = true
  where id = auth.uid();

  update public.invitaciones_acceso
  set estado = 'aceptada',
      accepted_at = now()
  where usuario_id = auth.uid()
    and estado = 'pendiente';

  return v_count;
end;
$$;

revoke all on function public.listar_contexto_altas_v1(uuid) from public, anon, authenticated;
grant execute on function public.listar_contexto_altas_v1(uuid) to service_role;

revoke all on function public.registrar_invitacion_acceso_v1(uuid,uuid,text,text,text,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.registrar_invitacion_acceso_v1(uuid,uuid,text,text,text,uuid,uuid,text) to service_role;

revoke all on function public.aceptar_invitacion_acceso_v1() from public, anon;
grant execute on function public.aceptar_invitacion_acceso_v1() to authenticated;
