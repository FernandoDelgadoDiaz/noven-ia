import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260828000240_revoke_orphan_radar_summary_rpc_v1.sql'),
  'utf8',
)

assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.listar_resumen_radar_zonal_v1\(uuid\)[\s\S]*FROM PUBLIC, anon, authenticated;/,
  'la RPC huérfana debe dejar de ser ejecutable desde el navegador',
)
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.listar_resumen_radar_zonal_v1\(uuid\)[\s\S]*TO service_role;/,
  'se conserva service_role para compatibilidad server-side explícita',
)

console.log('✓ resumen Radar huérfano fuera de la superficie authenticated')
