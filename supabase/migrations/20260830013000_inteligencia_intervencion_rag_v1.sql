-- NOVEN · INTELIGENCIA DE INTERVENCION RAG V1
--
-- Objetivo:
--   convertir el ledger ya existente en evidencia historica explicable sobre
--   respuesta de venta a cada intervencion RAG, sin presentar causalidad
--   econometrica ni recomendar porcentajes cuando la muestra es insuficiente.
--
-- Principios:
--   - usa solo ciclos cerrados del ledger V2;
--   - conserva sucursal, familia y operador;
--   - compara velocidad observada posterior vs. previa cuando existe evidencia;
--   - las subas de cantidad siguen siendo entradas, nunca ventas negativas;
--   - los niveles son madurez operativa de evidencia, no significancia estadistica;
--   - no agrega RPC de navegador.

begin;

create or replace view public.v_efectividad_intervencion_rag
with (security_invoker = true)
as
with post as (
  select
    t.rag_id,
    min(t.accion_id::text)::uuid as accion_id,
    count(*) as tramos_observados,
    sum(t.unidades_vendidas_observadas)::numeric as unidades_recuperadas_observadas,
    sum(
      case
        when t.finalizado_at > t.iniciado_at
          then extract(epoch from (t.finalizado_at - t.iniciado_at)) / 86400.0
        else 0
      end
    )::numeric as dias_observados,
    count(*) filter (where t.cantidad_fin > t.cantidad_inicio) as tramos_con_entrada
  from public.v_resultado_vencimiento_tramos t
  where t.rag_id is not null
  group by t.rag_id
),
base as (
  select
    r.id as rag_id,
    r.organizacion_id,
    r.sucursal_id,
    r.producto_id,
    p.familia_id,
    r.vencimiento_id,
    r.usuario_id as operador_id,
    r.porcentaje_descuento::numeric as rag_porcentaje,
    r.cantidad_comprometida_al_aplicar::numeric as unidades_expuestas_inicio,
    r.vmd_glaciar_al_aplicar::numeric as vmd_glaciar_al_aplicar,
    r.aplicado_at,
    r.finalizado_at,
    r.motivo_finalizacion,
    post.accion_id,
    coalesce(post.tramos_observados, 0) as tramos_observados,
    coalesce(post.unidades_recuperadas_observadas, 0::numeric) as unidades_recuperadas_observadas,
    coalesce(post.dias_observados, 0::numeric) as dias_observados,
    coalesce(post.tramos_con_entrada, 0) as tramos_con_entrada
  from public.intervenciones_rag r
  join public.productos p on p.id = r.producto_id
  left join post on post.rag_id = r.id
),
pre as (
  select
    b.rag_id,
    anterior.observada_at as pre_inicio_at,
    anterior.cantidad_comprometida::numeric as pre_cantidad_inicio,
    ultima.observada_at as pre_fin_at,
    ultima.cantidad_comprometida::numeric as pre_cantidad_fin,
    case
      when anterior.observada_at is not null
       and ultima.observada_at > anterior.observada_at
      then greatest(anterior.cantidad_comprometida - ultima.cantidad_comprometida, 0::numeric)
           / nullif(extract(epoch from (ultima.observada_at - anterior.observada_at)) / 86400.0, 0)
      else null
    end::numeric as velocidad_pre_rag
  from base b
  left join lateral (
    select o.id, o.observada_at, o.cantidad_comprometida
    from public.vencimiento_observaciones o
    where o.vencimiento_id = b.vencimiento_id
      and o.observada_at <= b.aplicado_at
    order by o.observada_at desc, o.id desc
    limit 1
  ) ultima on true
  left join lateral (
    select o.id, o.observada_at, o.cantidad_comprometida
    from public.vencimiento_observaciones o
    where o.vencimiento_id = b.vencimiento_id
      and ultima.id is not null
      and (o.observada_at, o.id) < (ultima.observada_at, ultima.id)
    order by o.observada_at desc, o.id desc
    limit 1
  ) anterior on true
)
select
  b.rag_id,
  b.organizacion_id,
  b.sucursal_id,
  b.producto_id,
  b.familia_id,
  b.vencimiento_id,
  b.operador_id,
  b.rag_porcentaje,
  b.aplicado_at,
  b.finalizado_at,
  b.motivo_finalizacion,
  b.unidades_expuestas_inicio,
  b.vmd_glaciar_al_aplicar,
  b.tramos_observados,
  b.dias_observados,
  b.unidades_recuperadas_observadas,
  b.tramos_con_entrada,
  case
    when b.unidades_expuestas_inicio > 0
      then b.unidades_recuperadas_observadas / b.unidades_expuestas_inicio
    else null
  end as proporcion_recuperada_observada,
  case
    when b.dias_observados > 0
      then b.unidades_recuperadas_observadas / b.dias_observados
    else null
  end as velocidad_post_rag,
  pre.pre_inicio_at,
  pre.pre_cantidad_inicio,
  pre.pre_fin_at,
  pre.pre_cantidad_fin,
  pre.velocidad_pre_rag,
  case
    when pre.velocidad_pre_rag > 0 and b.dias_observados > 0
      then ((b.unidades_recuperadas_observadas / b.dias_observados) - pre.velocidad_pre_rag)
           / pre.velocidad_pre_rag
    else null
  end as variacion_velocidad_vs_pre,
  case
    when pre.velocidad_pre_rag is null then 'sin_base_previa'
    when b.dias_observados <= 0 then 'sin_observacion_posterior'
    when (b.unidades_recuperadas_observadas / nullif(b.dias_observados, 0)) > pre.velocidad_pre_rag then 'mejoro'
    when (b.unidades_recuperadas_observadas / nullif(b.dias_observados, 0)) = pre.velocidad_pre_rag then 'sin_cambio'
    else 'empeoro'
  end as respuesta_velocidad,
  a.tipo as resultado_terminal,
  a.costo_unitario_sin_iva,
  case
    when a.costo_unitario_sin_iva is not null
      then b.unidades_recuperadas_observadas * a.costo_unitario_sin_iva
    else null
  end as valor_recuperado_atribuido_sin_iva
from base b
left join pre on pre.rag_id = b.rag_id
left join public.acciones_operativas a on a.id = b.accion_id
where b.accion_id is not null;

revoke all on public.v_efectividad_intervencion_rag from public, anon;
grant select on public.v_efectividad_intervencion_rag to authenticated;

comment on view public.v_efectividad_intervencion_rag is
  'Evidencia por intervencion RAG en ciclos cerrados. Mide respuesta observada y, cuando existe, compara velocidad pre/post. Es atribucion operativa, no causalidad econometrica.';

create or replace view public.v_efectividad_rag_resumen
with (security_invoker = true)
as
select
  e.organizacion_id,
  e.sucursal_id,
  e.familia_id,
  e.rag_porcentaje,
  count(*) as casos,
  count(*) filter (where e.velocidad_pre_rag is not null and e.dias_observados > 0) as casos_con_comparacion_pre_post,
  count(distinct e.operador_id) as operadores_distintos,
  sum(e.unidades_expuestas_inicio)::numeric as unidades_expuestas_inicio,
  sum(e.unidades_recuperadas_observadas)::numeric as unidades_recuperadas_observadas,
  sum(e.valor_recuperado_atribuido_sin_iva)::numeric as valor_recuperado_atribuido_sin_iva,
  sum(e.dias_observados)::numeric as dias_observados,
  case
    when sum(e.unidades_expuestas_inicio) > 0
      then sum(e.unidades_recuperadas_observadas) / sum(e.unidades_expuestas_inicio)
    else null
  end as proporcion_recuperada_observada,
  case
    when sum(e.dias_observados) > 0
      then sum(e.unidades_recuperadas_observadas) / sum(e.dias_observados)
    else null
  end as velocidad_post_ponderada,
  avg(e.variacion_velocidad_vs_pre) filter (where e.variacion_velocidad_vs_pre is not null) as variacion_velocidad_vs_pre_promedio,
  count(*) filter (where e.respuesta_velocidad = 'mejoro') as casos_mejoro_velocidad,
  count(*) filter (where e.tramos_con_entrada > 0) as casos_con_entradas,
  case
    when count(*) < 5 then 'insuficiente'
    when count(*) < 15 then 'inicial'
    when count(*) < 30 then 'moderada'
    else 'alta'
  end as madurez_evidencia,
  case
    when count(*) >= 15
     and count(*) filter (where e.velocidad_pre_rag is not null and e.dias_observados > 0) >= 8
      then true
    else false
  end as habilita_recomendacion_historica
from public.v_efectividad_intervencion_rag e
group by e.organizacion_id, e.sucursal_id, e.familia_id, e.rag_porcentaje;

revoke all on public.v_efectividad_rag_resumen from public, anon;
grant select on public.v_efectividad_rag_resumen to authenticated;

comment on view public.v_efectividad_rag_resumen is
  'Resumen de evidencia por sucursal, familia y porcentaje RAG. Madurez: <5 insuficiente, 5-14 inicial, 15-29 moderada, >=30 alta. El gate historico exige >=15 casos y >=8 comparaciones pre/post; no implica significancia estadistica.';

create or replace view public.v_efectividad_rag_operador
with (security_invoker = true)
as
select
  e.organizacion_id,
  e.sucursal_id,
  e.operador_id,
  e.familia_id,
  e.rag_porcentaje,
  count(*) as casos,
  sum(e.unidades_recuperadas_observadas)::numeric as unidades_recuperadas_observadas,
  sum(e.valor_recuperado_atribuido_sin_iva)::numeric as valor_recuperado_atribuido_sin_iva,
  avg(e.variacion_velocidad_vs_pre) filter (where e.variacion_velocidad_vs_pre is not null) as variacion_velocidad_vs_pre_promedio
from public.v_efectividad_intervencion_rag e
where e.operador_id is not null
group by e.organizacion_id, e.sucursal_id, e.operador_id, e.familia_id, e.rag_porcentaje;

revoke all on public.v_efectividad_rag_operador from public, anon;
grant select on public.v_efectividad_rag_operador to authenticated;

comment on view public.v_efectividad_rag_operador is
  'Corte operativo por sucursal y operador para auditoria de intervenciones RAG. No representa causalidad individual.';

commit;
