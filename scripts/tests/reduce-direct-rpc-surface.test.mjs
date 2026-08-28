import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260828000180_reduce_direct_rpc_surface_v1.sql'),
  'utf8',
)

for (const signature of [
  'public.registrar_control_vencimiento(uuid, numeric, text)',
  'public.registrar_intervencion_rag(uuid, numeric, text)',
  'public.handle_updated_at()',
]) {
  assert.ok(
    migration.includes(`REVOKE EXECUTE ON FUNCTION ${signature}`),
    `Falta retirar ejecución directa de ${signature}`,
  )
}

assert.match(
  migration,
  /registrar_control_vencimiento\(uuid, numeric, text\)[\s\S]*?FROM PUBLIC, anon, authenticated/,
  'Control fragmentario debe quedar fuera de la superficie cliente',
)
assert.match(
  migration,
  /registrar_intervencion_rag\(uuid, numeric, text\)[\s\S]*?FROM PUBLIC, anon, authenticated/,
  'RAG fragmentario debe quedar fuera de la superficie cliente',
)
assert.match(
  migration,
  /handle_updated_at\(\)[\s\S]*?FROM PUBLIC, anon, authenticated/,
  'Función de trigger no debe ser invocable directamente por clientes',
)
assert.doesNotMatch(
  migration,
  /GRANT EXECUTE[\s\S]*?(registrar_control_vencimiento|registrar_intervencion_rag|handle_updated_at)[\s\S]*?TO authenticated/,
  'La migración no debe reabrir las funciones al rol authenticated',
)

console.log('✓ RPC fragmentarias y helper de trigger salen de la superficie directa autenticada')
