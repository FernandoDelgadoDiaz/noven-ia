-- ═══════════════════════════════════════════════════════════════════════════
-- Deduplicación del par Cofler — el caso EAN-8
-- ═══════════════════════════════════════════════════════════════════════════
--
--   Glaciar  · 2986826  CHOCOLATE BLANCO CON MANI COFLER BLOCK (105 u, vmd 0.37)
--   Scanner  · 77981912 Chocolate blanco con mani              (167 u, vmd 0.00)
--
-- POR QUÉ ESTE CASO IMPORTA: `77981912` es un EAN-8. Tiene 8 dígitos, así que
-- **pasa el patrón `^\d{4,8}$` de un cod_art válido de Glaciar**:
-- `clasificarCodArt()` lo devuelve como sano y el badge "cod_art es un EAN"
-- nunca se le muestra. Ninguna heurística de formato puede atraparlo, porque el
-- espacio de los EAN-8 se solapa exactamente con el de los códigos legítimos.
--
-- Se detectó únicamente por el vínculo duro: el `codigo_barras` del registro de
-- Glaciar es exactamente el `cod_art` del escaneado. Esa es la comprobación que
-- se agregó a `reconciliar()` en `src/lib/importar-reconciliacion.ts`.
--
-- Mismo criterio que los pares anteriores: sobrevive el registro de Glaciar, el
-- escaneado queda con activo=false. Nada se borra. 0 vencimientos activos.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

insert into public.dedup_turrocklets_backup_20260805 (tabla, registro_id, datos)
select 'productos', p.id, to_jsonb(p)
from public.productos p
where p.cod_art in ('2986826', '77981912')
on conflict (tabla, registro_id) do nothing;

insert into public.dedup_turrocklets_backup_20260805 (tabla, registro_id, datos)
select 'vencimientos', v.id, to_jsonb(v)
from public.vencimientos v
join public.productos p on p.id = v.producto_id
where p.cod_art = '77981912'
on conflict (tabla, registro_id) do nothing;

-- Defensivo: hoy no hay vencimientos sobre el duplicado.
update public.vencimientos v
set producto_id = g.id,
    updated_at  = now()
from public.productos e
join public.productos g on g.codigo_barras = e.cod_art and g.id <> e.id
where v.producto_id = e.id
  and e.cod_art = '77981912';

update public.productos
set activo     = false,
    updated_at = now()
where cod_art = '77981912'
  and activo is distinct from false;

commit;

-- ─── Verificación: debe devolver 0 ───────────────────────────────────────────
/*
select count(*)
from productos p
where p.activo = true
  and exists (
    select 1 from productos q
    where q.activo = true and q.codigo_barras = p.cod_art and q.id <> p.id
  );
*/

-- ─── Rollback manual ─────────────────────────────────────────────────────────
/*
update public.productos p set activo = (b.datos->>'activo')::boolean
from public.dedup_turrocklets_backup_20260805 b
where b.tabla = 'productos' and b.registro_id = p.id and p.cod_art = '77981912';
*/
