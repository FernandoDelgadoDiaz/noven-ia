import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260830170000_ciclos_problema_economico_v1.sql'),
  'utf8',
)

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.problemas_economicos_ciclos/)
assert.match(migration, /abierto_at/)
assert.match(migration, /resuelto_at/)
assert.match(migration, /apertura_metodo/)
assert.match(migration, /'evento', 'backfill_actual'/)
assert.match(migration, /WHERE resuelto_at IS NULL/,
  'debe existir como máximo un ciclo abierto por vencimiento')
assert.match(migration, /'vuelto_seguro'/,
  'volver a Seguro debe ser una resolución propia, no cierre terminal')
for (const resolucion of ['vendido', 'donacion', 'decomiso', 'anulado', 'fuera_circuito', 'inactivo_sin_resultado']) {
  assert.match(migration, new RegExp(`'${resolucion}'`), `falta resolución ${resolucion}`)
}
assert.match(migration, /timezone\('America\/Argentina\/Buenos_Aires', p_evento_at\)/)
assert.match(migration, /vencimientos_problema_economico_v1/)
assert.match(migration, /UPDATE OF cantidad, fecha_vencimiento, nivel_actual, producto_id, activo/)
assert.match(migration, /producto_sucursal_problema_economico_v1/)
assert.match(migration, /UPDATE OF venta_media_diaria/)
assert.match(migration, /producto_costo_problema_economico_v1/)
assert.match(migration, /UPDATE OF costo_unitario, observado_at/)
assert.match(migration, /v_problemas_economicos_historial/)
assert.match(migration, /segundos_hasta_resolucion/)
assert.match(migration, /apertura_metodo = 'evento'/,
  'el backfill no debe contaminar métricas de tiempo de resolución')
assert.match(migration, /REVOKE ALL ON public\.problemas_economicos_ciclos FROM PUBLIC, anon, authenticated/)
assert.match(migration, /REVOKE ALL ON public\.v_problemas_economicos_historial FROM PUBLIC, anon, authenticated/)
assert.doesNotMatch(migration, /CREATE POLICY/i,
  'la tabla server-only no necesita políticas browser')
assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\./i,
  'no debe ampliar la superficie RPC pública del navegador')

console.log('✓ Ciclos de problema económico: apertura, resolución, reapertura y trazabilidad formal protegidas')
