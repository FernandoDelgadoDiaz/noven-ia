-- NOVEN · RESULTADO DE CICLO POR TRAMOS RAG V1
-- El cierre terminal conserva su cantidad técnica histórica, pero el resultado
-- económico se deriva del ciclo completo: observación inicial → cambios de RAG → cierre.

create or replace view public.v_resultado_vencimiento_tramos
with (security_invoker = true)
as
with terminales as (
  select
    a.id as accion_id,
    a.vencimiento_id,
    a.producto_id,
    a.sucursal_id,
    a.tipo,
    a.created_at as cierre_at,
    case when a.tipo = 'vendido' then 0::numeric else a.cantidad::numeric end as cantidad_terminal,
    obs_inicial.cantidad_comprometida as cantidad_inicial,
    obs_inicial.observada_at as inicial_at,
    primer_rag.id as primer_rag_id,
    primer_rag.cantidad_comprometida_al_aplicar as cantidad_primer_rag,
    primer_rag.aplicado_at as primer_rag_at
  from public.acciones_operativas a
  left join lateral (
    select o.cantidad_comprometida, o.observada_at
    from public.vencimiento_observaciones o
    where o.vencimiento_id = a.vencimiento_id
    order by o.observada_at asc, o.id asc
    limit 1
  ) obs_inicial on true
  left join lateral (
    select r.id, r.cantidad_comprometida_al_aplicar, r.aplicado_at
    from public.intervenciones_rag r
    where r.vencimiento_id = a.vencimiento_id
      and r.aplicado_at <= a.created_at
    order by r.aplicado_at asc, r.created_at asc, r.id asc
    limit 1
  ) primer_rag on true
  where a.tipo in ('vendido', 'donacion', 'decomiso')
),
rag_ordenado as (
  select
    t.accion_id,
    r.id as rag_id,
    r.porcentaje_descuento as rag_porcentaje,
    r.cantidad_comprometida_al_aplicar as cantidad_inicio,
    r.aplicado_at as iniciado_at,
    lead(r.cantidad_comprometida_al_aplicar) over (
      partition by t.accion_id
      order by r.aplicado_at asc, r.created_at asc, r.id asc
    ) as cantidad_siguiente,
    lead(r.aplicado_at) over (
      partition by t.accion_id
      order by r.aplicado_at asc, r.created_at asc, r.id asc
    ) as siguiente_at,
    t.cantidad_terminal,
    t.cierre_at,
    row_number() over (
      partition by t.accion_id
      order by r.aplicado_at asc, r.created_at asc, r.id asc
    ) as rn
  from terminales t
  join public.intervenciones_rag r
    on r.vencimiento_id = t.vencimiento_id
   and r.aplicado_at <= t.cierre_at
),
tramo_pre_rag as (
  select
    t.accion_id,
    t.vencimiento_id,
    t.producto_id,
    t.sucursal_id,
    0::bigint as tramo_orden,
    null::uuid as rag_id,
    null::numeric as rag_porcentaje,
    t.cantidad_inicial as cantidad_inicio,
    coalesce(t.cantidad_primer_rag, t.cantidad_terminal) as cantidad_fin,
    greatest(t.cantidad_inicial - coalesce(t.cantidad_primer_rag, t.cantidad_terminal), 0::numeric) as unidades_vendidas_observadas,
    t.inicial_at as iniciado_at,
    coalesce(t.primer_rag_at, t.cierre_at) as finalizado_at
  from terminales t
  where t.cantidad_inicial is not null
),
tramos_rag as (
  select
    t.accion_id,
    t.vencimiento_id,
    t.producto_id,
    t.sucursal_id,
    r.rn as tramo_orden,
    r.rag_id,
    r.rag_porcentaje,
    r.cantidad_inicio,
    coalesce(r.cantidad_siguiente, r.cantidad_terminal) as cantidad_fin,
    greatest(r.cantidad_inicio - coalesce(r.cantidad_siguiente, r.cantidad_terminal), 0::numeric) as unidades_vendidas_observadas,
    r.iniciado_at,
    coalesce(r.siguiente_at, r.cierre_at) as finalizado_at
  from terminales t
  join rag_ordenado r on r.accion_id = t.accion_id
)
select * from tramo_pre_rag
union all
select * from tramos_rag;

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
  coalesce(ciclo.unidades_recuperadas, case when a.tipo = 'vendido' then a.cantidad::numeric else 0::numeric end) as unidades_recuperadas,
  case when a.tipo in ('donacion', 'decomiso') then a.cantidad::numeric else 0::numeric end as unidades_perdidas,
  case
    when a.costo_unitario_sin_iva is null then null
    else coalesce(ciclo.unidades_recuperadas, case when a.tipo = 'vendido' then a.cantidad::numeric else 0::numeric end) * a.costo_unitario_sin_iva
  end as valor_recuperado_sin_iva,
  case
    when a.costo_unitario_sin_iva is null then null
    when a.tipo in ('donacion', 'decomiso') then a.cantidad::numeric * a.costo_unitario_sin_iva
    else 0::numeric
  end as valor_perdido_sin_iva,
  (ciclo.tiene_observacion_inicial is true) as resultado_ciclo_completo,
  coalesce(ciclo.tramos, '[]'::jsonb) as tramos_resultado
from public.acciones_operativas a
join public.productos p on p.id = a.producto_id
left join lateral (
  select
    coalesce(sum(t.unidades_vendidas_observadas), 0::numeric) as unidades_recuperadas,
    bool_or(t.tramo_orden = 0) as tiene_observacion_inicial,
    jsonb_agg(
      jsonb_build_object(
        'orden', t.tramo_orden,
        'rag_porcentaje', t.rag_porcentaje,
        'cantidad_inicio', t.cantidad_inicio,
        'cantidad_fin', t.cantidad_fin,
        'unidades_vendidas', t.unidades_vendidas_observadas,
        'iniciado_at', t.iniciado_at,
        'finalizado_at', t.finalizado_at
      ) order by t.tramo_orden
    ) as tramos
  from public.v_resultado_vencimiento_tramos t
  where t.accion_id = a.id
) ciclo on true;

comment on view public.v_resultado_vencimiento_tramos is
  'Ledger derivado del ciclo de un vencimiento. Cada tramo atribuye la disminución observada al RAG vigente; el tramo 0 representa venta previa al primer RAG.';
comment on view public.v_acciones_operativas_historial is
  'Historial terminal con cantidad técnica original y resultado derivado del ciclo completo: unidades recuperadas, perdidas y tramos por intervención RAG.';
