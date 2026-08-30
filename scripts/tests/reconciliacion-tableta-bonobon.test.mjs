import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260830163500_reconciliar_tableta_bonobon_3449476.sql'),
  'utf8',
)

assert.match(migration, /3443479/)
assert.match(migration, /3449476/)
assert.match(migration, /7790580117979/)
assert.match(migration, /1961\.67/)
assert.match(migration, /UPDATE public\.producto_codigos/)
assert.match(migration, /UPDATE public\.vencimientos/)
assert.match(migration, /UPDATE public\.vencimiento_observaciones/)
assert.match(migration, /activo = false/)
assert.doesNotMatch(migration, /DELETE FROM public\.productos/i,
  'la corrección debe preservar el producto erróneo inactivo para auditoría')
assert.doesNotMatch(migration, /DELETE FROM public\.producto_sucursal/i,
  'no debe destruir el estado local legado del registro erróneo')

console.log('✓ Reconciliación Bon o Bon: EAN y vencimiento migran al SKU 0258 sin borrar auditoría')
