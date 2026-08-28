import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260828000170_radar_operator_current_scope_v1.sql'),
  'utf8',
)

assert.match(
  migration,
  /CREATE OR REPLACE FUNCTION noven_private\.listar_mis_alertas_zonales_v1_impl/,
  'Debe endurecer la bandeja del operador',
)
assert.match(
  migration,
  /JOIN public\.usuarios u[\s\S]*?ua\.rol = 'operador'[\s\S]*?ua\.activo = true[\s\S]*?ufs\.familia_id = a\.familia_id[\s\S]*?ufs\.activo = true[\s\S]*?u\.activo = true/,
  'La bandeja debe exigir perfil, acceso operador y familia activos',
)
assert.match(
  migration,
  /CREATE OR REPLACE FUNCTION noven_private\.responder_alerta_zonal_v1_impl/,
  'Debe endurecer la respuesta de Radar Zonal',
)
assert.match(
  migration,
  /v_dest\.usuario_id IS DISTINCT FROM v_uid/,
  'La alerta debe seguir perteneciendo al UID que responde',
)
assert.match(
  migration,
  /IF NOT EXISTS \([\s\S]*?ua\.rol = 'operador'[\s\S]*?ua\.activo = true[\s\S]*?ufs\.familia_id = v_alerta\.familia_id[\s\S]*?ufs\.activo = true[\s\S]*?u\.activo = true[\s\S]*?\) THEN/,
  'Responder debe revalidar el alcance actual completo',
)

const gateIndex = migration.indexOf("IF NOT EXISTS (", migration.indexOf('CREATE OR REPLACE FUNCTION noven_private.responder_alerta_zonal_v1_impl'))
const revisarIndex = migration.indexOf("IF p_respuesta = 'revisar_despues'", gateIndex)
const noTengoIndex = migration.indexOf("IF p_respuesta = 'no_lo_tengo'", gateIndex)
assert.ok(gateIndex >= 0 && revisarIndex > gateIndex && noTengoIndex > gateIndex, 'El gate debe ocurrir antes de cualquier respuesta que escriba estado')

assert.match(
  migration,
  /REVOKE ALL ON FUNCTION noven_private\.responder_alerta_zonal_v1_impl[\s\S]*?FROM PUBLIC, anon;[\s\S]*?GRANT EXECUTE[\s\S]*?TO authenticated/,
  'Debe conservar la superficie privada necesaria para el wrapper autenticado',
)

console.log('✓ Radar Zonal revalida perfil + acceso operador + familia antes de listar o responder')
