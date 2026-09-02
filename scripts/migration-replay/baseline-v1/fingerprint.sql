
with core_tables as (
 select c.oid,c.relowner,c.relacl,n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','noven_private') and c.relkind='r'
   and c.relname not in (
     'dedup_turrocklets_backup_20260805',
     'productos_descripcion_backup_20260805',
     'productos_familia_backup_20260806'
   )
), core_views as (
 select c.oid,c.relowner,c.relacl,n.nspname,c.relname,c.reloptions
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','noven_private') and c.relkind='v'
), core_columns as (
 select ct.oid,ct.nspname,ct.relname,a.attnum,a.attname,a.atttypid,a.atttypmod,
        a.attnotnull,a.attidentity,a.attgenerated,a.attcollation,
        t.typcollation,ad.adbin,ad.adrelid
 from core_tables ct
 join pg_attribute a on a.attrelid=ct.oid and a.attnum>0 and not a.attisdropped
 join pg_type t on t.oid=a.atttypid
 left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
), core_sequences as (
 select distinct s.oid,s.relowner,s.relacl,ns.nspname,s.relname,
        cc.nspname table_schema,cc.relname table_name,cc.attname column_name
 from core_columns cc
 join pg_class s on s.oid=to_regclass(pg_get_serial_sequence(format('%I.%I',cc.nspname,cc.relname),cc.attname))
 join pg_namespace ns on ns.oid=s.relnamespace
 where cc.attidentity<>''
), core_functions as (
 select p.*,n.nspname,l.lanname,pg_get_function_identity_arguments(p.oid) identity_args
 from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace
 join pg_language l on l.oid=p.prolang
 where n.nspname in ('public','noven_private') and p.prokind='f'
), relevant_grantees as (
 select 0::oid oid,'PUBLIC'::text name
 union all select oid,rolname from pg_roles where rolname in ('anon','authenticated','service_role')
), schema_acl as (
 select n.nspname,
        case when e.grantee=0 then 'PUBLIC' else g.name end grantee,
        e.privilege_type,e.is_grantable
 from pg_namespace n
 cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) e
 join relevant_grantees g on g.oid=e.grantee
 where n.nspname in ('public','noven_private')
), all_relations as (
 select oid,relowner,relacl,nspname,relname,'r'::"char" relkind from core_tables
 union all
 select oid,relowner,relacl,nspname,relname,'v'::"char" relkind from core_views
 union all
 select oid,relowner,relacl,nspname,relname,'S'::"char" relkind from core_sequences
), relation_acl as (
 select ar.nspname,ar.relname,ar.relkind::text relkind,
        case when e.grantee=0 then 'PUBLIC' else g.name end grantee,
        e.privilege_type,e.is_grantable
 from all_relations ar
 cross join lateral aclexplode(coalesce(ar.relacl,acldefault(case when ar.relkind='S' then 'S'::"char" else 'r'::"char" end,ar.relowner))) e
 join relevant_grantees g on g.oid=e.grantee
), function_acl as (
 select f.nspname,f.proname,f.identity_args,
        case when e.grantee=0 then 'PUBLIC' else g.name end grantee,
        e.privilege_type,e.is_grantable
 from core_functions f
 cross join lateral aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) e
 join relevant_grantees g on g.oid=e.grantee
), policy_roles as (
 select pol.oid,
        coalesce(jsonb_agg(case when x.role_oid=0 then 'PUBLIC' else r.rolname end
          order by case when x.role_oid=0 then '' else r.rolname end),'[]'::jsonb) roles
 from pg_policy pol
 cross join lateral unnest(pol.polroles) x(role_oid)
 left join pg_roles r on r.oid=x.role_oid
 group by pol.oid
), fingerprint as (
 select jsonb_build_object(
   'version',1,
   'schemas',(
     select coalesce(jsonb_agg(jsonb_build_object('schema',x.nspname) order by x.nspname),'[]'::jsonb)
     from (select nspname from pg_namespace where nspname in ('public','noven_private')) x
   ),
   'tables',(
     select coalesce(jsonb_agg(jsonb_build_object('schema',nspname,'name',relname)
       order by nspname,relname),'[]'::jsonb) from core_tables
   ),
   'columns',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'schema',cc.nspname,'table',cc.relname,'ordinal',cc.attnum,'name',cc.attname,
       'type',pg_catalog.format_type(cc.atttypid,cc.atttypmod),
       'not_null',cc.attnotnull,'identity',cc.attidentity,'generated',cc.attgenerated,
       'default',case when cc.adbin is null then null else pg_get_expr(cc.adbin,cc.adrelid,true) end,
       'collation',case when cc.attcollation<>0 and cc.attcollation<>cc.typcollation
         then (select format('%I.%I',n.nspname,c.collname) from pg_collation c join pg_namespace n on n.oid=c.collnamespace where c.oid=cc.attcollation)
         else null end,
       'identity_sequence',case when cc.attidentity<>'' then pg_get_serial_sequence(format('%I.%I',cc.nspname,cc.relname),cc.attname) else null end
     ) order by cc.nspname,cc.relname,cc.attnum),'[]'::jsonb) from core_columns cc
   ),
   'constraints',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'schema',ct.nspname,'table',ct.relname,'name',con.conname,'type',con.contype::text,
       'deferrable',con.condeferrable,'initially_deferred',con.condeferred,'validated',con.convalidated,
       'definition_sha256',encode(extensions.digest(pg_get_constraintdef(con.oid,true),'sha256'),'hex')
     ) order by ct.nspname,ct.relname,con.conname),'[]'::jsonb)
     from core_tables ct join pg_constraint con on con.conrelid=ct.oid
     where con.contype in ('p','u','c','f')
   ),
   'indexes',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'schema',ct.nspname,'table',ct.relname,'name',ic.relname,
       'unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready,
       'definition_sha256',encode(extensions.digest(pg_get_indexdef(i.indexrelid,0,true),'sha256'),'hex')
     ) order by ct.nspname,ct.relname,ic.relname),'[]'::jsonb)
     from core_tables ct join pg_index i on i.indrelid=ct.oid join pg_class ic on ic.oid=i.indexrelid
     where not exists(select 1 from pg_constraint con where con.conindid=i.indexrelid)
   ),
   'functions',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'schema',f.nspname,'name',f.proname,'identity_arguments',f.identity_args,
       'result',pg_get_function_result(f.oid),'language',f.lanname,'kind',f.prokind::text,
       'volatility',f.provolatile::text,'parallel',f.proparallel::text,
       'security_definer',f.prosecdef,'leakproof',f.proleakproof,'strict',f.proisstrict,
       'returns_set',f.proretset,'config',to_jsonb(f.proconfig),
       'definition_sha256',encode(extensions.digest(pg_get_functiondef(f.oid),'sha256'),'hex')
     ) order by f.nspname,f.proname,f.identity_args),'[]'::jsonb) from core_functions f
   ),
   'views',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'schema',v.nspname,'name',v.relname,'options',to_jsonb(v.reloptions),
       'definition_sha256',encode(extensions.digest(pg_get_viewdef(v.oid,true),'sha256'),'hex')
     ) order by v.nspname,v.relname),'[]'::jsonb) from core_views v
   ),
   'triggers',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'schema',ct.nspname,'table',ct.relname,'name',t.tgname,'enabled',t.tgenabled::text,
       'constraint',t.tgconstraint<>0,'deferrable',t.tgdeferrable,'initially_deferred',t.tginitdeferred,
       'definition_sha256',encode(extensions.digest(pg_get_triggerdef(t.oid,true),'sha256'),'hex')
     ) order by ct.nspname,ct.relname,t.tgname),'[]'::jsonb)
     from core_tables ct join pg_trigger t on t.tgrelid=ct.oid where not t.tgisinternal
   ),
   'rls',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'schema',nspname,'table',relname,'enabled',relrowsecurity,'force',relforcerowsecurity
     ) order by nspname,relname),'[]'::jsonb) from core_tables
   ),
   'policies',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'schema',ct.nspname,'table',ct.relname,'name',pol.polname,
       'permissive',pol.polpermissive,'command',pol.polcmd::text,'roles',pr.roles,
       'using',case when pol.polqual is null then null else pg_get_expr(pol.polqual,pol.polrelid,true) end,
       'with_check',case when pol.polwithcheck is null then null else pg_get_expr(pol.polwithcheck,pol.polrelid,true) end
     ) order by ct.nspname,ct.relname,pol.polname),'[]'::jsonb)
     from core_tables ct join pg_policy pol on pol.polrelid=ct.oid join policy_roles pr on pr.oid=pol.oid
   ),
   'identity_sequences',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'schema',nspname,'name',relname,'table_schema',table_schema,'table',table_name,'column',column_name
     ) order by nspname,relname),'[]'::jsonb) from core_sequences
   ),
   'acl',jsonb_build_object(
     'schemas',(select coalesce(jsonb_agg(jsonb_build_object(
       'schema',nspname,'grantee',grantee,'privilege',privilege_type,'grantable',is_grantable
     ) order by nspname,grantee,privilege_type),'[]'::jsonb) from schema_acl),
     'relations',(select coalesce(jsonb_agg(jsonb_build_object(
       'schema',nspname,'name',relname,'kind',relkind,'grantee',grantee,'privilege',privilege_type,'grantable',is_grantable
     ) order by nspname,relname,relkind,grantee,privilege_type),'[]'::jsonb) from relation_acl),
     'functions',(select coalesce(jsonb_agg(jsonb_build_object(
       'schema',nspname,'name',proname,'identity_arguments',identity_args,
       'grantee',grantee,'privilege',privilege_type,'grantable',is_grantable
     ) order by nspname,proname,identity_args,grantee,privilege_type),'[]'::jsonb) from function_acl)
   )
 ) value
)
select value::text from fingerprint;
