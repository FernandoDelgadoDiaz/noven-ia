import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const migration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260828000170_global_profile_active_auth_boundary_v1.sql'),
  'utf8',
)

function funcion(nombre) {
  const escaped = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = migration.match(
    new RegExp(`CREATE OR REPLACE FUNCTION ${escaped}\\([\\s\\S]*?\\n\\$\\$;`, 'i'),
  )
  assert.ok(match, `No se encontró la definición de ${nombre}`)
  return match[0]
}

for (const nombre of [
  'noven_private.tiene_acceso_organizacion',
  'noven_private.tiene_acceso_sucursal',
  'noven_private.puede_ver_familia_sucursal',
]) {
  const body = funcion(nombre)
  assert.match(body, /JOIN public\.usuarios u/i, `${nombre} debe resolver el perfil global`)
  assert.match(body, /u\.id\s*=\s*\(SELECT auth\.uid\(\)\)/i, `${nombre} debe atar el perfil al JWT`)
  assert.match(body, /u\.activo\s*=\s*true/i, `${nombre} debe rechazar perfiles globalmente inactivos`)
  assert.match(body, /ua\.activo\s*=\s*true/i, `${nombre} debe seguir exigiendo acceso activo`)
}

const familia = funcion('noven_private.puede_ver_familia_sucursal')
assert.match(
  familia,
  /JOIN public\.familias f[\s\S]*?f\.organizacion_id\s*=\s*s\.organizacion_id/i,
  'La familia debe pertenecer a la misma organización que la sucursal',
)
assert.match(
  familia,
  /ufs\.organizacion_id\s*=\s*s\.organizacion_id/i,
  'La responsabilidad de operador debe conservar aislamiento por organización',
)

const radar = funcion('noven_private.listar_resumen_radar_zonal_v1_impl')
assert.match(radar, /JOIN public\.usuarios u/i, 'Radar zonal debe resolver el perfil global del actor')
assert.match(radar, /u\.id\s*=\s*v_uid/i, 'Radar zonal debe atar el perfil al JWT')
assert.match(radar, /u\.activo\s*=\s*true/i, 'Radar zonal debe rechazar perfiles globalmente inactivos')
assert.match(radar, /ua\.activo\s*=\s*true/i, 'Radar zonal debe conservar el gate de acceso activo')

console.log('✓ Perfil global inactivo corta RLS y RPC aunque subsista un acceso activo')
