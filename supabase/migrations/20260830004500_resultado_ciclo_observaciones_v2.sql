-- NOVEN · RESULTADO DE CICLO POR OBSERVACIONES V2
-- Corrige el ledger V1 para considerar todos los cambios de cantidad del ciclo.
-- Las subas de cantidad son entradas observadas y no descuentan ventas previas.
-- Cada baja positiva se atribuye al RAG vigente al comienzo del intervalo.

create or replace view public.v_resultado_vencimiento_tramos
with (security_invoker = true)
as
with terminales as (
  select
    a.id as accion_id,
    a.vencimiento_id,
    a.producto_id,
    a.sucursal_id,
    a.usuario_id as usuario_cierre_id,
    a.tipo,
    a.created_at as cierre_at,
    case when a.tipo = 'vendido' then 0::numeric else a.cantidad::numeric end as cantidad_terminal
  from public.acciones_operativas a
  where a.tipo in ('vendido', 'donacion', 'decomiso')
),
eventos as (
  select
    t.accion_id,
    t.vencimiento_id,
    t.producto_id,
    t.sucursal_id,
    o.observada_at as evento_at,
    10 as prioridad,
    ('obs:' || o.id::text) as evento_key,
    o.cantidad_comprometida::numeric as cantidad,
    o.usuario_id as usuario_evento_id
  from terminales t
  join public.vencimiento_observaciones o
    on o.vencimiento_id = t.vencimiento_id
   and o.observada_at <= t.cierre_at

  union all

  select
    t.accion_id,
    t.vencimiento_id,
    t.producto_id,
    t.sucursal_id,
    r.aplicado_at,
    20,
    ('rag:' || r.id::text),
    r.cantidad_comprometida_al_aplicar::numeric,
    r.usuario_id
  from terminales t
  join public.intervenciones_rag r
    on r.vencimiento_id = t.vencimiento_id
   and r.aplicado_at <= t.cierre_at

  union all

  select
    t.accion_id,
    t.vencimiento_id,
    t.producto_id,
    t.sucursal_id,
    t.cierre_at,
    30,
    ('cierre:' || t.accion_id::text),
    t.cantidad_terminal,
    t.usuario_cierre_id
  from terminales t
),
ordenados as (
  select
    e.*,
    lag(e.cantidad) over (
      partition by e.accion_id
      order by e.evento_at, e.prioridad, e.evento_key
    ) as cantidad_anterior,
    lag(e.evento_at) over (
      partition by e.accion_id
      order by e.evento_at, e.prioridad, e.evento_key
    ) as evento_anterior_at,
    lag(e.usuario_evento_id) over (
      partition by e.accion_id
      order by e.evento_at, e.prioridad, e.evento_key
    ) as usuario_anterior_id,
    row_number() over (
      partition by e.accion_id
      order by e.evento_at, e.prioridad, e.evento_key
    ) as evento_orden
  from eventos e
),
intervalos as (
  select
    o.accion_id,
    o.vencimiento_id,
    o.producto_id,
    o.sucursal_id,
    o.evento_orden - 1 as tramo_orden,
    rag.id as rag_id,
    rag.porcentaje_descuento as rag_porcentaje,
    o.cantidad_anterior as cantidad_inicio,
    o.cantidad as cantidad_fin,
    greatest(o.cantidad_anterior - o.cantidad, 0::numeric) as unidades_vendidas_observadas,
    o.evento_anterior_at as iniciado_at,
    o.evento_at as finalizado_at,
    coalesce(rag.usuario_id, o.usuario_anterior_id) as operador_id,
    case when rag.id is not null then 'rag' else 'observacion' end as atribucion_fuente
  from ordenados o
  left join lateral (
    select r.id, r.porcentaje_descuento, r.usuario_id
    from public.intervenciones_rag r
    where r.vencimiento_id = o.vencimiento_id
      and o.evento_anterior_at is not null
      and r.aplicado_at <= o.evento_anterior_at
      and (r.finalizado_at is null or r.finalizado_at > o.evento_anterior_at)
    order by r.aplicado_at desc, r.created_at desc, r.id desc
    limit 1
  ) rag on true
  where o.cantidad_anterior is not null
)
select
  accion_id,
  vencimiento_id,
  producto_id,
  sucursal_id,
  tramo_orden,
  rag_id,
  rag_porcentaje,
  cantidad_inicio,
  cantidad_fin,
  unidades_vendidas_observadas,
  iniciado_at,
  finalizado_at,
  operador_id,
  atribucion_fuente
from intervalos;

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
  a.valorizacion_metodo,
  case
    when a.tipo = 'vendido' and ciclo.tiene_evidencia then coalesce(ciclo.unidades_recuperadas, 0::numeric)
    when a.tipo = 'vendido' then a.cantidad::numeric
    else 0::numeric
  end as unidades_recuperadas,
  case when a.tipo in ('donacion', 'decomiso') then a.cantidad::numeric else 0::numeric end as unidades_perdidas,
  case
    when a.costo_unitario_sin_iva is null then null
    when a.tipo = 'vendido' and ciclo.tiene_evidencia then coalesce(ciclo.unidades_recuperadas, 0::numeric) * a.costo_unitario_sin_iva
    when a.tipo = 'vendido' then a.cantidad::numeric * a.costo_unitario_sin_iva
    else 0::numeric
  end as valor_recuperado_sin_iva,
  case
    when a.costo_unitario_sin_iva is null then null
    when a.tipo in ('donacion', 'decomiso') then a.cantidad::numeric * a.costo_unitario_sin_iva
    else 0::numeric
  end as valor_perdido_sin_iva,
  coalesce(ciclo.tiene_evidencia, false) as resultado_ciclo_completo,
  coalesce(ciclo.tramos, '[]'::jsonb) as tramos_resultado
from public.acciones_operativas a
join public.productos p on p.id = a.producto_id
left join lateral (
  select
    count(*) > 0 as tiene_evidencia,
    coalesce(sum(t.unidades_vendidas_observadas), 0::numeric) as unidades_recuperadas,
    jsonb_agg(
      jsonb_build_object(
        'orden', t.tramo_orden,
        'rag_porcentaje', t.rag_porcentaje,
        'cantidad_inicio', t.cantidad_inicio,
        'cantidad_fin', t.cantidad_fin,
        'unidades_vendidas', t.unidades_vendidas_observadas,
        'iniciado_at', t.iniciado_at,
        'finalizado_at', t.finalizado_at,
        'operador_id', t.operador_id,
        'atribucion_fuente', t.atribucion_fuente
      ) order by t.tramo_orden
    ) as tramos
  from public.v_resultado_vencimiento_tramos t
  where t.accion_id = a.id
) ciclo on true;

create or replace view public.v_resultado_operador_rag
with (security_invoker = true)
as
select
  t.sucursal_id,
  t.operador_id,
  t.rag_porcentaje,
  t.atribucion_fuente,
  count(distinct t.accion_id) as casos,
  sum(t.unidades_vendidas_observadas) as unidades_recuperadas_observadas
from public.v_resultado_vencimiento_tramos t
where t.unidades_vendidas_observadas > 0
  and t.operador_id is not null
group by t.sucursal_id, t.operador_id, t.rag_porcentaje, t.atribucion_fuente;

revoke all on public.v_resultado_vencimiento_tramos from public, anon;
revoke all on public.v_resultado_operador_rag from public, anon;
grant select on public.v_resultado_vencimiento_tramos to authenticated;
grant select on public.v_resultado_operador_rag to authenticated;

comment on view public.v_resultado_vencimiento_tramos is
  'Ledger derivado por intervalos de observacion. Suma solo bajas positivas, conserva subas como entradas y atribuye cada baja al RAG vigente al inicio del intervalo.';
comment on view public.v_resultado_operador_rag is
  'Resultado fisico observado agrupable por sucursal, operador y porcentaje RAG; atribucion operativa, no causalidad econometrica.';
