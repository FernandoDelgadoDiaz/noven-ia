import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260828000240_revoke_orphan_radar_summary_rpc_v1.sql'),
  'utf8',
)

for (const signature of [
  'public.listar_resumen_radar_zonal_v1(uuid)',
  'noven_private.listar_resumen_radar_zonal_v1_impl(uuid)',
]) {
  assert.ok(
    migration.includes(`REVOKE ALL ON FUNCTION ${signature}`),
    `Falta cerrar EXECUTE de ${signature}`,
  )
  assert.match(
    migration,
    new RegExp(`${signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?FROM PUBLIC, anon, authenticated, service_role`),
    `${signature} debe quedar fuera de todos los roles de API`,
  )
}

assert.doesNotMatch(
  migration,
  /GRANT\s+EXECUTE[\s\S]*?listar_resumen_radar_zonal_v1/i,
  'La migración no debe reabrir la RPC huérfana',
)

console.log('✓ Resumen Radar Zonal huérfano queda dormido fuera de la superficie API')
