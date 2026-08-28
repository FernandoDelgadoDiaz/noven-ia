import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const migration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260828000100_revoke_anon_surface_v1.sql'),
  'utf8',
)
const sql = migration.replace(/^\s*--.*$/gm, '')

const objetos = [
  'acciones_operativas',
  'familias',
  'invitaciones_acceso',
  'productos',
  'productos_familia_backup_20260806',
  'push_subscriptions',
  'regiones',
  'sectores',
  'sucursales',
  'usuario_familias',
  'usuarios',
  'vencimientos',
  'vw_usuarios_completos',
]

for (const objeto of objetos) {
  assert.match(
    sql,
    new RegExp(`REVOKE ALL ON TABLE public\\.${objeto} FROM anon;`),
    `${objeto} debe revocar todos los grants directos de anon`,
  )
}

assert.match(
  sql,
  /REVOKE EXECUTE ON FUNCTION public\.handle_updated_at\(\) FROM PUBLIC, anon;/,
  'la trigger function no debe seguir ejecutable directamente por anon/PUBLIC',
)
assert.doesNotMatch(
  sql,
  /FROM authenticated/,
  'P1-F no debe revocar permisos de usuarios autenticados',
)
assert.doesNotMatch(
  sql,
  /desafio5s_/i,
  'P1-F no debe tocar el otro proyecto compartido',
)

console.log('✓ Superficie SQL anónima de Noven queda cerrada sin tocar authenticated')
