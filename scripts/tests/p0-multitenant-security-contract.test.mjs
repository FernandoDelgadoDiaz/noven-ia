import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')

const migration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260828000050_p0_multitenant_security_hardening_v1.sql'),
  'utf8',
)
const push = fs.readFileSync(path.join(ROOT, 'netlify/functions/enviar-push.ts'), 'utf8')

assert.match(
  migration,
  /ALTER VIEW public\.v_acciones_operativas_historial[\s\S]*SET \(security_invoker = true\)/,
  'Historial debe ejecutar las tablas base con permisos del caller',
)
assert.match(
  migration,
  /'sucursal_id', NEW\.sucursal_id/,
  'El webhook urgente debe transportar la sucursal exacta del vencimiento',
)
assert.match(
  migration,
  /America\/Argentina\/Buenos_Aires/,
  'El push urgente no debe calcular días con CURRENT_DATE UTC',
)

assert.match(push, /\.from\('usuario_accesos'\)/, 'El push debe resolver accesos multitenant')
assert.match(push, /\.eq\('sucursal_id', sucursalId\)/, 'El push debe quedar acotado a la sucursal exacta')
assert.match(
  push,
  /\.from\('usuario_familias_sucursal'\)/,
  'El operador destinatario debe salir de la responsabilidad local de familia',
)
assert.doesNotMatch(
  push,
  /\.from\('usuarios'\)[\s\S]{0,200}\.eq\('rol',\s*'admin'\)/,
  'No se deben agregar admins globales por el rol legacy',
)
assert.doesNotMatch(
  push,
  /\.from\('usuario_familias'\)(?!_sucursal)/,
  'No se debe usar usuario_familias legacy para targeting',
)

for (const legacy of ['crear-usuario.ts', 'listar-usuarios.ts']) {
  assert.equal(
    fs.existsSync(path.join(ROOT, 'netlify/functions', legacy)),
    false,
    `${legacy} debe quedar retirado del deploy`,
  )
}

console.log('✓ P0: Historial respeta RLS, push urgente es local y endpoints legacy están retirados')
