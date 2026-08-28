import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260828000030_access_invitations_indexes_v1.sql'),
  'utf8',
)

for (const indexName of [
  'invitaciones_acceso_org_idx',
  'invitaciones_acceso_zona_org_idx',
  'invitaciones_acceso_sucursal_org_idx',
  'zonas_region_org_idx',
]) {
  assert.match(sql, new RegExp(`create index if not exists ${indexName}`), `Falta ${indexName}`)
}

assert.match(sql, /on public\.invitaciones_acceso\(zona_id, organizacion_id\)/)
assert.match(sql, /on public\.invitaciones_acceso\(sucursal_id, organizacion_id\)/)
assert.match(sql, /on public\.zonas\(region_id, organizacion_id\)/)

console.log('✓ Índices de soporte para invitaciones y jerarquía presentes')
