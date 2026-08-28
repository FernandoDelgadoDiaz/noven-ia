import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const SRC = path.join(ROOT, 'src')
const migration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260828000210_reduce_fragmented_scanner_rpc_surface_v1.sql'),
  'utf8',
)

const fragmentarias = [
  'crear_vencimiento_operador',
  'actualizar_vencimiento_operador',
  'actualizar_stock_producto_sucursal_scanner',
]

function archivosFuente(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...archivosFuente(abs))
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(abs)
  }
  return out
}

for (const abs of archivosFuente(SRC)) {
  const source = fs.readFileSync(abs, 'utf8')
  for (const rpc of fragmentarias) {
    const re = new RegExp(String.raw`\.rpc\(\s*['\"]${rpc}['\"]`)
    assert.doesNotMatch(
      source,
      re,
      `${path.relative(ROOT, abs)} no debe volver a invocar directamente ${rpc}`,
    )
  }
}

assert.match(
  migration,
  /noven_private\.crear_vencimiento_operador_impl\(/,
  'La RPC atómica debe crear vencimientos mediante la implementación privada',
)
assert.match(
  migration,
  /noven_private\.actualizar_vencimiento_operador_impl\(/,
  'La RPC atómica debe actualizar vencimientos mediante la implementación privada',
)
assert.match(
  migration,
  /noven_private\.upsert_stock_producto_sucursal_scanner\(/,
  'La RPC atómica debe actualizar stock mediante la implementación privada',
)

for (const rpc of fragmentarias) {
  assert.match(
    migration,
    new RegExp(`REVOKE ALL ON FUNCTION public\\.${rpc}\\([\\s\\S]*?FROM PUBLIC, anon, authenticated;`, 'i'),
    `${rpc} debe salir de la superficie directa de authenticated`,
  )
}

assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.crear_vencimiento_operador[\s\S]*?TO service_role;/i,
  'Se conserva compatibilidad server-side explícita para crear vencimiento',
)

console.log('✓ Scanner usa una única escritura atómica y las RPC fragmentarias dejan de ser browser API')
