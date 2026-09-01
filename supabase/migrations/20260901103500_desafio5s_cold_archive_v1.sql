-- Desafío 5S · archivo en frío reversible dentro del mismo proyecto Supabase.
-- Objetivo: retirar 5S de la superficie pública de NoVen preservando íntegramente
-- objetos, filas y archivos para una restauración futura.

create schema if not exists desafio5s_archive authorization postgres;
comment on schema desafio5s_archive is
  'Archivo en frío del Desafío 5S. No forma parte de la superficie operativa de NoVen.';

revoke all on schema desafio5s_archive from public, anon, authenticated, service_role;

-- Si no existe ningún objeto 5S (por ejemplo en un replay limpio de NoVen),
-- la migración queda como no-op salvo por crear el schema privado de archivo.
do $$
declare
  v_expected_tables text[] := array[
    'desafio5s_admins',
    'desafio5s_asset_chunks',
    'desafio5s_evaluacion_preguntas',
    'desafio5s_evaluaciones',
    'desafio5s_participantes',
    'desafio5s_preguntas',
    'desafio5s_respuestas'
  ];
  v_expected_views text[] := array[
    'desafio5s_ranking_individual',
    'desafio5s_ranking_sectores'
  ];
  v_expected_functions text[] := array[
    'desafio5s_acceso_ranking',
    'desafio5s_admin_dashboard',
    'desafio5s_admin_habilitar_reevaluacion',
    'desafio5s_admin_iniciar_prueba',
    'desafio5s_admin_pendientes',
    'desafio5s_admin_persona_detalle',
    'desafio5s_admin_set_imagen',
    'desafio5s_admin_visuales',
    'desafio5s_asignar_preguntas',
    'desafio5s_asset',
    'desafio5s_es_admin',
    'desafio5s_iniciar',
    'desafio5s_pregunta',
    'desafio5s_ranking',
    'desafio5s_responder',
    'desafio5s_responder_v2',
    'desafio5s_resultado',
    'desafio5s_revision'
  ];
  v_actual_tables text[];
  v_actual_views text[];
  v_actual_functions text[];
  v_bucket_exists boolean;
  v_policy_count integer;
begin
  select coalesce(array_agg(c.relname order by c.relname), '{}'::text[])
    into v_actual_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname like 'desafio5s_%';

  select coalesce(array_agg(c.relname order by c.relname), '{}'::text[])
    into v_actual_views
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and c.relname like 'desafio5s_%';

  select coalesce(array_agg(p.proname order by p.proname), '{}'::text[])
    into v_actual_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like 'desafio5s_%';

  select exists(
    select 1 from storage.buckets where id = 'desafio5s-imagenes'
  ) into v_bucket_exists;

  if cardinality(v_actual_tables) = 0
     and cardinality(v_actual_views) = 0
     and cardinality(v_actual_functions) = 0
     and not v_bucket_exists then
    return;
  end if;

  if v_actual_tables is distinct from v_expected_tables then
    raise exception 'Inventario inesperado de tablas 5S: %', v_actual_tables;
  end if;

  if v_actual_views is distinct from v_expected_views then
    raise exception 'Inventario inesperado de vistas 5S: %', v_actual_views;
  end if;

  if v_actual_functions is distinct from v_expected_functions then
    raise exception 'Inventario inesperado de funciones 5S: %', v_actual_functions;
  end if;

  if not v_bucket_exists then
    raise exception 'Falta el bucket desafio5s-imagenes; se aborta el archivado';
  end if;

  select count(*)::integer
    into v_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'desafio5s_public_read',
      'desafio5s_admin_upload',
      'desafio5s_admin_update'
    );

  if v_policy_count <> 3 then
    raise exception 'Inventario inesperado de policies Storage 5S: %', v_policy_count;
  end if;
end
$$;

-- Snapshot transaccional de conteos. Se usa únicamente para demostrar que
-- el movimiento de schema conserva todas las filas y los objetos de Storage.
create temporary table desafio5s_archive_counts (
  object_name text primary key,
  row_count bigint not null
);

do $$
declare
  v_name text;
  v_count bigint;
begin
  foreach v_name in array array[
    'desafio5s_admins',
    'desafio5s_asset_chunks',
    'desafio5s_evaluacion_preguntas',
    'desafio5s_evaluaciones',
    'desafio5s_participantes',
    'desafio5s_preguntas',
    'desafio5s_respuestas'
  ] loop
    if to_regclass(format('public.%I', v_name)) is not null then
      execute format('select count(*) from public.%I', v_name) into v_count;
      insert into desafio5s_archive_counts(object_name, row_count)
      values (v_name, v_count);
    end if;
  end loop;

  if exists(select 1 from storage.buckets where id = 'desafio5s-imagenes') then
    select count(*) into v_count
    from storage.objects
    where bucket_id = 'desafio5s-imagenes';

    insert into desafio5s_archive_counts(object_name, row_count)
    values ('storage:desafio5s-imagenes', v_count);
  end if;
end
$$;

-- Las vistas conservan sus dependencias por OID al cambiar de schema.
do $$
declare
  v_name text;
begin
  foreach v_name in array array[
    'desafio5s_ranking_individual',
    'desafio5s_ranking_sectores'
  ] loop
    if to_regclass(format('public.%I', v_name)) is not null then
      execute format('alter view public.%I set schema desafio5s_archive', v_name);
    end if;
  end loop;
end
$$;

-- Mover las funciones conserva sus ACL actuales para facilitar una restauración.
-- El schema privado no concede USAGE a clientes ni a service_role.
do $$
declare
  v_record record;
begin
  for v_record in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'desafio5s_%'
    order by p.proname
  loop
    execute format(
      'alter function public.%I(%s) set schema desafio5s_archive',
      v_record.proname,
      v_record.args
    );
  end loop;
end
$$;

-- Tablas, índices, constraints y tipos de fila asociados se conservan al mover
-- las tablas al schema privado.
do $$
declare
  v_name text;
begin
  foreach v_name in array array[
    'desafio5s_admins',
    'desafio5s_asset_chunks',
    'desafio5s_evaluacion_preguntas',
    'desafio5s_evaluaciones',
    'desafio5s_participantes',
    'desafio5s_preguntas',
    'desafio5s_respuestas'
  ] loop
    if to_regclass(format('public.%I', v_name)) is not null then
      execute format('alter table public.%I set schema desafio5s_archive', v_name);
    end if;
  end loop;
end
$$;

-- El bucket permanece con todos sus objetos, pero deja de ser público.
update storage.buckets
set public = false
where id = 'desafio5s-imagenes';

-- Mantener las policies existentes permite restaurar su lógica futura sin
-- reconstruir expresiones. Durante el archivo quedan limitadas a service_role.
do $$
begin
  if exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'desafio5s_public_read'
  ) then
    alter policy desafio5s_public_read on storage.objects to service_role;
  end if;

  if exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'desafio5s_admin_upload'
  ) then
    alter policy desafio5s_admin_upload on storage.objects to service_role;
  end if;

  if exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'desafio5s_admin_update'
  ) then
    alter policy desafio5s_admin_update on storage.objects to service_role;
  end if;
end
$$;

revoke all on schema desafio5s_archive from public, anon, authenticated, service_role;

-- Verificación final dentro de la misma transacción de migración.
do $$
declare
  v_record record;
  v_after bigint;
  v_public_objects integer;
  v_archive_tables integer;
  v_archive_views integer;
  v_archive_functions integer;
  v_storage_public boolean;
begin
  select count(*)::integer into v_public_objects
  from (
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname like 'desafio5s_%'
    union all
    select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'desafio5s_%'
  ) x;

  if v_public_objects <> 0 then
    raise exception 'Quedaron objetos desafio5s_* en public: %', v_public_objects;
  end if;

  select count(*)::integer into v_archive_tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'desafio5s_archive' and c.relkind = 'r'
    and c.relname like 'desafio5s_%';

  select count(*)::integer into v_archive_views
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'desafio5s_archive' and c.relkind = 'v'
    and c.relname like 'desafio5s_%';

  select count(*)::integer into v_archive_functions
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'desafio5s_archive' and p.proname like 'desafio5s_%';

  if exists(select 1 from desafio5s_archive_counts where object_name like 'desafio5s_%') then
    if v_archive_tables <> 7 or v_archive_views <> 2 or v_archive_functions <> 18 then
      raise exception 'Archivo 5S incompleto: tablas %, vistas %, funciones %',
        v_archive_tables, v_archive_views, v_archive_functions;
    end if;
  end if;

  for v_record in
    select object_name, row_count
    from desafio5s_archive_counts
    where object_name like 'desafio5s_%'
  loop
    execute format('select count(*) from desafio5s_archive.%I', v_record.object_name)
      into v_after;
    if v_after <> v_record.row_count then
      raise exception 'Cambió el conteo de %: antes %, después %',
        v_record.object_name, v_record.row_count, v_after;
    end if;
  end loop;

  if exists(
    select 1 from desafio5s_archive_counts
    where object_name = 'storage:desafio5s-imagenes'
  ) then
    select count(*) into v_after
    from storage.objects
    where bucket_id = 'desafio5s-imagenes';

    if v_after <> (
      select row_count from desafio5s_archive_counts
      where object_name = 'storage:desafio5s-imagenes'
    ) then
      raise exception 'Cambió el conteo de objetos del bucket 5S';
    end if;

    select public into v_storage_public
    from storage.buckets
    where id = 'desafio5s-imagenes';

    if coalesce(v_storage_public, true) then
      raise exception 'El bucket desafio5s-imagenes continúa público';
    end if;
  end if;
end
$$;