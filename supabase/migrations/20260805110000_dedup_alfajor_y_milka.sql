-- ═══════════════════════════════════════════════════════════════════════════
-- Deduplicación de los dos pares detectados por código de barras
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Mismo criterio que Turrocklets: sobrevive el registro de Glaciar, hereda el
-- codigo_barras, el escaneado queda con activo=false. Nada se borra.
--
-- CÓMO SE DETECTARON: el `codigo_barras` del registro de Glaciar es exactamente
-- el `cod_art` del registro escaneado. Ese es el vínculo duro. El par Milka NO
-- lo detecta la similaridad de descripción ("Chocolate leche" contra "CHOCOLATE
-- CONLECHE MILKA Un(240" da 0,591, muy por debajo del umbral de 0,85).
--
--   Par 1 · 3210595 ALFAJORES DE MAICENA      ← 7798267200044 Alfajor de maicena
--   Par 2 · 2319100 CHOCOLATE CONLECHE MILKA  ← 7622210795625 Chocolate leche
--
-- Ninguno de los 4 registros tiene vencimientos activos, así que no hay riesgo
-- de colisión con uq_vencimiento_activo_por_producto_sucursal ni de dejar
-- vencimientos huérfanos. El bloque de migración de vencimientos se incluye
-- igual por si el estado cambió entre el diagnóstico y la aplicación.
--
-- NOTA: acá el codigo_barras ya está en el registro de Glaciar (a diferencia de
-- Turrocklets, donde lo tenía el escaneado). No hay que moverlo: solo hay que
-- liberar el cod_art del duplicado del campo equivocado, que se logra dándolo
-- de baja. El cod_art NO se toca (es NOT NULL y único).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Respaldo ────────────────────────────────────────────────────────────────

insert into public.dedup_turrocklets_backup_20260805 (tabla, registro_id, datos)
select 'productos', p.id, to_jsonb(p)
from public.productos p
where p.cod_art in ('3210595', '7798267200044', '2319100', '7622210795625')
on conflict (tabla, registro_id) do nothing;

insert into public.dedup_turrocklets_backup_20260805 (tabla, registro_id, datos)
select 'vencimientos', v.id, to_jsonb(v)
from public.vencimientos v
join public.productos p on p.id = v.producto_id
where p.cod_art in ('7798267200044', '7622210795625')
on conflict (tabla, registro_id) do nothing;

-- ─── Migrar vencimientos del duplicado al que sobrevive ──────────────────────
-- Defensivo: hoy no hay ninguno. Si aparecieran y el sobreviviente ya tuviera
-- uno activo en la misma sucursal, el índice único haría fallar la migración
-- entera antes de dejar datos a medias — que es el comportamiento deseado.

update public.vencimientos v
set producto_id = g.id,
    updated_at  = now()
from public.productos e
join public.productos g on g.codigo_barras = e.cod_art and g.id <> e.id
where v.producto_id = e.id
  and e.cod_art in ('7798267200044', '7622210795625');

-- ─── Baja lógica de los duplicados escaneados ────────────────────────────────

update public.productos
set activo     = false,
    updated_at = now()
where cod_art in ('7798267200044', '7622210795625')
  and activo is distinct from false;

commit;

-- ─── Verificación ────────────────────────────────────────────────────────────
/*
select p.cod_art, p.descripcion, p.stock_actual, p.venta_media_diaria,
       p.codigo_barras, p.activo,
       (select count(*) from vencimientos v where v.producto_id = p.id and v.activo) as venc
from productos p
where p.cod_art in ('3210595','7798267200044','2319100','7622210795625')
order by p.descripcion, p.cod_art;
*/

-- ─── Rollback manual ─────────────────────────────────────────────────────────
/*
update public.productos p set activo = (b.datos->>'activo')::boolean
from public.dedup_turrocklets_backup_20260805 b
where b.tabla = 'productos' and b.registro_id = p.id
  and p.cod_art in ('7798267200044','7622210795625');
*/
