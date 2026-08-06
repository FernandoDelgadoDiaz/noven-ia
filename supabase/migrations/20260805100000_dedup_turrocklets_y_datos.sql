-- ═══════════════════════════════════════════════════════════════════════════
-- P2 · Correcciones de datos aprobadas (auditoría 2026-08-05)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Tres puntos, todos NO DESTRUCTIVOS: nada se borra, todo queda respaldado en
-- `public.dedup_turrocklets_backup_20260805` con la query de rollback al final.
--
-- ORDEN CRÍTICO: `productos_codigo_barras_key` es un índice ÚNICO, así que hay
-- que liberar el codigo_barras del duplicado ANTES de asignárselo al que
-- sobrevive. Invertir esos dos pasos hace fallar la migración entera.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Respaldo ────────────────────────────────────────────────────────────────

create table if not exists public.dedup_turrocklets_backup_20260805 (
  tabla       text        not null,
  registro_id uuid        not null,
  datos       jsonb       not null,
  respaldo_at timestamptz not null default now(),
  primary key (tabla, registro_id)
);

alter table public.dedup_turrocklets_backup_20260805 enable row level security;

drop policy if exists dedup_backup_admin on public.dedup_turrocklets_backup_20260805;
create policy dedup_backup_admin
  on public.dedup_turrocklets_backup_20260805
  for select to authenticated
  using (public.rol_actual() = 'admin');

insert into public.dedup_turrocklets_backup_20260805 (tabla, registro_id, datos)
select 'productos', p.id, to_jsonb(p)
from public.productos p
where p.id in (
  'c4fba8e2-ec28-45ff-a199-6dc340a8e941',  -- Turrocklets duplicado (cod_art 0000000)
  'be277e9a-0dfe-42a3-82db-a3e8dbd898fc'   -- TURROCKLETS correcto  (cod_art 3328533)
)
on conflict (tabla, registro_id) do nothing;

insert into public.dedup_turrocklets_backup_20260805 (tabla, registro_id, datos)
select 'vencimientos', v.id, to_jsonb(v)
from public.vencimientos v
where v.producto_id = 'c4fba8e2-ec28-45ff-a199-6dc340a8e941'
on conflict (tabla, registro_id) do nothing;

insert into public.dedup_turrocklets_backup_20260805 (tabla, registro_id, datos)
select 'usuarios', u.id, to_jsonb(u)
from public.usuarios u
where u.id = '691b1a0c-28e7-43a8-87c5-a3f541708c31'  -- gerente091 (admin)
on conflict (tabla, registro_id) do nothing;

-- Respaldo del grupo de EAN-como-cod_art que se toca más abajo.
insert into public.dedup_turrocklets_backup_20260805 (tabla, registro_id, datos)
select 'productos', p.id, to_jsonb(p)
from public.productos p
where p.cod_art ~ '^\d{12,14}$' and p.codigo_barras is null
on conflict (tabla, registro_id) do nothing;

-- ─── P2.1 · Reactivar al admin ───────────────────────────────────────────────
-- gerente091@gmail.com figuraba con activo=false. No era la causa del bug de
-- borrado (ni AdminRoute ni PrivateRoute filtran por `activo`) pero es una
-- inconsistencia: el panel Admin lo muestra como inactivo.

update public.usuarios
set activo = true
where id = '691b1a0c-28e7-43a8-87c5-a3f541708c31'
  and activo is distinct from true;

-- ─── P2.2 · Deduplicar Turrocklets ───────────────────────────────────────────
-- Sobrevive `3328533` (stock 169, venta media 3.15), que es el dato de Glaciar.
-- El `0000000` fue cargado a mano desde el Scanner y quedó desalineado: la app
-- mostraba 127 unidades contra 169 reales, y el motor de riesgo contaba doble.

-- (1) Liberar el codigo_barras del duplicado — obligatorio por el índice único.
update public.productos
set codigo_barras = null,
    updated_at    = now()
where id = 'c4fba8e2-ec28-45ff-a199-6dc340a8e941';

-- (2) El sobreviviente hereda el EAN y se corrige su familia.
--     Hoy figura en 014 COPETIN por el bug C7 (el importador reasignaba la
--     familia de todo producto que matcheaba). Glaciar lo ubica en 003.
--     Sin heredar el EAN, al escanear el producto la app no lo encontraría y
--     crearía un TERCER duplicado.
update public.productos
set familia_id    = '1c4d345c-254a-4065-b111-f744f966faaa',  -- 003 GOLOSINAS Y CHOCOLATES
    codigo_barras = '0000077993540',
    updated_at    = now()
where id = 'be277e9a-0dfe-42a3-82db-a3e8dbd898fc';

-- (3) Migrar el vencimiento activo al registro que sobrevive.
--     Sin colisión con uq_vencimiento_activo_por_producto_sucursal: el
--     sobreviviente no tenía ningún vencimiento. `usuario_id` NO se toca, así
--     que el registro sigue perteneciendo a Repositora Golosinas, que es la
--     operadora de 003.
update public.vencimientos
set producto_id = 'be277e9a-0dfe-42a3-82db-a3e8dbd898fc',
    updated_at  = now()
where producto_id = 'c4fba8e2-ec28-45ff-a199-6dc340a8e941';

-- (4) Baja lógica del duplicado. NO se borra.
update public.productos
set activo     = false,
    updated_at = now()
where id = 'c4fba8e2-ec28-45ff-a199-6dc340a8e941';

-- ─── P2.3 (parcial) · EAN guardado en el campo equivocado ────────────────────
-- 10 productos cargados desde el Scanner tienen un EAN-13 en `cod_art`. No se
-- puede inventar su cod_art real de Glaciar, pero sí preservar el EAN en el
-- campo correcto: así el Scanner y el fallback por codigo_barras del importador
-- pueden encontrarlos. `cod_art` queda como está (es NOT NULL y único).
--
-- Lo que NO se hace acá y queda pendiente:
--   · asignar familia a los 59 productos con familia_id NULL — no se puede
--     determinar sin los CSV de Glaciar
--   · reemplazar el cod_art EAN por el cod_art real — ídem

update public.productos p
set codigo_barras = p.cod_art,
    updated_at    = now()
where p.cod_art ~ '^\d{12,14}$'
  and p.codigo_barras is null
  and not exists (
    select 1 from public.productos q
    where q.codigo_barras = p.cod_art and q.id <> p.id
  );

commit;

-- ─── Verificación ────────────────────────────────────────────────────────────
/*
select cod_art, descripcion, stock_actual, venta_media_diaria, codigo_barras,
       familia_id, activo
from productos where descripcion ilike 'turrocklets' order by cod_art;

select v.id, p.cod_art, v.cantidad, v.activo
from vencimientos v join productos p on p.id = v.producto_id
where p.descripcion ilike 'turrocklets';
*/

-- ─── Rollback manual ─────────────────────────────────────────────────────────
/*
begin;
update public.vencimientos v set producto_id = (b.datos->>'producto_id')::uuid
from public.dedup_turrocklets_backup_20260805 b
where b.tabla = 'vencimientos' and b.registro_id = v.id;

update public.productos p set
  cod_art       = b.datos->>'cod_art',
  codigo_barras = b.datos->>'codigo_barras',
  familia_id    = (b.datos->>'familia_id')::uuid,
  activo        = (b.datos->>'activo')::boolean
from public.dedup_turrocklets_backup_20260805 b
where b.tabla = 'productos' and b.registro_id = p.id;

update public.usuarios u set activo = (b.datos->>'activo')::boolean
from public.dedup_turrocklets_backup_20260805 b
where b.tabla = 'usuarios' and b.registro_id = u.id;
commit;
*/
