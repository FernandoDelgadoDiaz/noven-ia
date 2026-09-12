import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const activation = fs.readFileSync(path.join(ROOT, 'src/pages/ActivarCuenta.tsx'), 'utf8')

const passwordBlock = activation.match(
  /const \{ error: passwordError \}[\s\S]*?if \(activacionError/,
)?.[0] ?? ''

assert.ok(passwordBlock, 'debe existir el tramo contraseña → aceptación')
assert.match(passwordBlock, /passwordError\.code !== 'same_password'/,
  'el reintento debe reconocer el código estable de Supabase')
assert.match(passwordBlock, /passwordError && passwordError\.code !== 'same_password'[\s\S]*?return/,
  'un error de contraseña distinto debe detener la activación')
assert.doesNotMatch(passwordBlock, /passwordError\.code === 'same_password'[\s\S]*?return/,
  'same_password no debe impedir que se ejecute la aceptación pendiente')
assert.match(passwordBlock, /supabase\.rpc\('aceptar_invitacion_acceso_v1'\)/,
  'después de same_password debe continuar hacia el RPC endurecido')

console.log('✓ el reintento retoma la activación si la contraseña ya quedó guardada')
