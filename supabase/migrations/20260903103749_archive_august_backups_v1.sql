-- NoVen · archivo en frío reversible de los respaldos operativos de agosto.
-- Conserva filas y objetos asociados, pero los retira de la superficie public.

set lock_timeout = '5s';

create schema if not exists noven_archive authorization postgres;
comment on schema noven_archive is
  'Archivo en frío de respaldos históricos de NoVen. No forma parte del core operativo.';

revoke all on schema noven_archive from public, anon, authenticated, service_role;

create temporary table noven_archive_counts (
  object_name text primary key,
  row_count bigint not null
);

-- En un replay limpio las tablas históricas no existen. Ese caso es válido y
-- deja solamente el schema privado. Un inventario parcial o inesperado aborta.
do $$
declare
  v_expected text[] := array[
    'dedup_turrocklets_backup_20260805',
    'productos_descripcion_backup_20260805',
    'productos_familia_backup_20260806'
  ];
  v_expected_policies text[] := array[
    'dedup_backup_admin',
    'productos_desc_backup_admin'
  ];
  v_public text[];
  v_archived text[];
  v_policies text[];
  v_target_oids oid[];
  v_name text;
  v_count bigint;
  v_dependency_count integer;
begin
  select coalesce(array_agg(c.relname order by c.relname), '{}'::text[])
    into v_public
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname = any(v_expected);

  select coalesce(array_agg(c.relname order by c.relname), '{}'::text[])
    into v_archived
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'noven_archive'
    and c.relkind = 'r'
    and c.relname = any(v_expected);

  if cardinality(v_public) = 0 and cardinality(v_archived) = 0 then
    return;
  end if;

  if v_public is distinct from v_expected or cardinality(v_archived) <> 0 then
    raise exception 'Inventario inesperado de respaldos: public %, archive %',
      v_public, v_archived;
  end if;

  select array_agg(c.oid order by c.relname)
    into v_target_oids
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname = any(v_expected);

  select coalesce(array_agg(p.policyname order by p.policyname), '{}'::text[])
    into v_policies
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = any(v_expected);

  if v_policies is distinct from v_expected_policies then
    raise exception 'Inventario inesperado de policies de respaldos: %', v_policies;
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.table_name = any(v_expected)
      and g.grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception 'Un respaldo conserva grants de cliente; se aborta el archivo';
  end if;

  select count(*)::integer
    into v_dependency_count
  from pg_constraint con
  where con.contype = 'f'
    and (con.conrelid = any(v_target_oids) or con.confrelid = any(v_target_oids));

  if v_dependency_count <> 0 then
    raise exception 'Los respaldos tienen % foreign keys; se aborta el archivo',
      v_dependency_count;
  end if;

  select count(distinct v.oid)::integer
    into v_dependency_count
  from pg_depend d
  join pg_rewrite r on r.oid = d.objid
  join pg_class v on v.oid = r.ev_class
  where d.classid = 'pg_rewrite'::regclass
    and d.refclassid = 'pg_class'::regclass
    and d.refobjid = any(v_target_oids);

  if v_dependency_count <> 0 then
    raise exception 'Los respaldos tienen % vistas dependientes; se aborta el archivo',
      v_dependency_count;
  end if;

  select count(distinct p.oid)::integer
    into v_dependency_count
  from pg_depend d
  join pg_proc p on p.oid = d.objid
  where d.classid = 'pg_proc'::regclass
    and d.refclassid = 'pg_class'::regclass
    and d.refobjid = any(v_target_oids);

  if v_dependency_count <> 0 then
    raise exception 'Los respaldos tienen % funciones dependientes; se aborta el archivo',
      v_dependency_count;
  end if;

  select count(*)::integer
    into v_dependency_count
  from (
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'noven_private')
      and p.prokind = 'f'
  ) f
  where pg_get_functiondef(f.oid) ilike any(array[
    '%dedup_turrocklets_backup_20260805%',
    '%productos_descripcion_backup_20260805%',
    '%productos_familia_backup_20260806%'
  ]);

  if v_dependency_count <> 0 then
    raise exception 'Los respaldos aparecen en % definiciones de funciones; se aborta el archivo',
      v_dependency_count;
  end if;

  select count(*)::integer
    into v_dependency_count
  from pg_trigger t
  where not t.tgisinternal
    and t.tgrelid = any(v_target_oids);

  if v_dependency_count <> 0 then
    raise exception 'Los respaldos tienen % triggers; se aborta el archivo',
      v_dependency_count;
  end if;

  select count(*)::integer
    into v_dependency_count
  from pg_publication_tables p
  where p.schemaname = 'public'
    and p.tablename = any(v_expected);

  if v_dependency_count <> 0 then
    raise exception 'Los respaldos integran % publicaciones; se aborta el archivo',
      v_dependency_count;
  end if;

  foreach v_name in array v_expected loop
    execute format('select count(*) from public.%I', v_name) into v_count;
    insert into noven_archive_counts(object_name, row_count)
    values (v_name, v_count);
  end loop;
end
$$;

do $$
declare
  v_name text;
begin
  foreach v_name in array array[
    'dedup_turrocklets_backup_20260805',
    'productos_descripcion_backup_20260805',
    'productos_familia_backup_20260806'
  ] loop
    if to_regclass(format('public.%I', v_name)) is not null then
      execute format('alter table public.%I set schema noven_archive', v_name);
    end if;
  end loop;
end
$$;

-- Las policies se preservan para una restauración futura, pero ni clientes ni
-- service_role conservan USAGE del schema o privilegios sobre las relaciones.
do $$
declare
  v_name text;
begin
  foreach v_name in array array[
    'dedup_turrocklets_backup_20260805',
    'productos_descripcion_backup_20260805',
    'productos_familia_backup_20260806'
  ] loop
    if to_regclass(format('noven_archive.%I', v_name)) is not null then
      execute format(
        'revoke all privileges on table noven_archive.%I from public, anon, authenticated, service_role',
        v_name
      );
    end if;
  end loop;
end
$$;

revoke all on schema noven_archive from public, anon, authenticated, service_role;

-- Verificación final dentro de la misma transacción de migración.
do $$
declare
  v_expected text[] := array[
    'dedup_turrocklets_backup_20260805',
    'productos_descripcion_backup_20260805',
    'productos_familia_backup_20260806'
  ];
  v_public text[];
  v_archived text[];
  v_record record;
  v_after bigint;
  v_client_acl integer;
begin
  select coalesce(array_agg(c.relname order by c.relname), '{}'::text[])
    into v_public
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname = any(v_expected);

  if cardinality(v_public) <> 0 then
    raise exception 'Quedaron respaldos de agosto en public: %', v_public;
  end if;

  select coalesce(array_agg(c.relname order by c.relname), '{}'::text[])
    into v_archived
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'noven_archive'
    and c.relkind = 'r'
    and c.relname = any(v_expected);

  if exists(select 1 from noven_archive_counts) then
    if v_archived is distinct from v_expected then
      raise exception 'Archivo de respaldos incompleto: %', v_archived;
    end if;
  elsif cardinality(v_archived) <> 0 then
    raise exception 'El replay encontró respaldos archivados no inventariados: %', v_archived;
  end if;

  for v_record in
    select object_name, row_count from noven_archive_counts order by object_name
  loop
    execute format('select count(*) from noven_archive.%I', v_record.object_name)
      into v_after;
    if v_after <> v_record.row_count then
      raise exception 'Cambió el conteo de %: antes %, después %',
        v_record.object_name, v_record.row_count, v_after;
    end if;
  end loop;

  select count(*)::integer
    into v_client_acl
  from pg_namespace n
  cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) e
  left join pg_roles r on r.oid = e.grantee
  where n.nspname = 'noven_archive'
    and e.privilege_type = 'USAGE'
    and (e.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'));

  if v_client_acl <> 0 then
    raise exception 'El schema noven_archive conserva % grants USAGE de cliente', v_client_acl;
  end if;

  select count(*)::integer
    into v_client_acl
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) e
  left join pg_roles r on r.oid = e.grantee
  where n.nspname = 'noven_archive'
    and c.relname = any(v_expected)
    and (e.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'));

  if v_client_acl <> 0 then
    raise exception 'Los respaldos archivados conservan % privilegios de cliente', v_client_acl;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'noven_archive'
      and c.relname = any(v_expected)
      and not c.relrowsecurity
  ) then
    raise exception 'Un respaldo archivado perdió RLS';
  end if;
end
$$;
