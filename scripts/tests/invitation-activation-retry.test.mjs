import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const activation = fs.readFileSync(path.join(ROOT, 'src/pages/ActivarCuenta.tsx'), 'utf8')
const guardMigration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260912211542_validar_invitacion_antes_password_v1.sql'),
  'utf8',
)

const identityGuard = activation.match(
  /const \{ data: identidad,[\s\S]*?const \{ data: passwordData, error: passwordError \}/,
)?.[0] ?? ''

assert.ok(identityGuard, 'debe existir el tramo identidad → validación → contraseña')
assert.match(identityGuard, /supabase\.auth\.getUser\(\)/,
  'la identidad debe verificarse contra Auth antes de cambiar la contraseña')
assert.match(identityGuard, /usuarioValidado\.id !== session\?\.user\.id[\s\S]*?return/,
  'una carrera entre el provider y Auth debe detener el flujo')
assert.match(identityGuard, /\.rpc\('validar_invitacion_pendiente_v1'\)/,
  'el servidor debe confirmar la invitación de la identidad actual')
assert.match(identityGuard, /invitacionesValidas < 1[\s\S]*?return/,
  'una sesión sin invitación debe detenerse antes de tocar Auth')
assert.ok(
  activation.indexOf(".rpc('validar_invitacion_pendiente_v1')")
    < activation.indexOf('supabase.auth.updateUser'),
  'la prevalidación debe ocurrir antes del cambio de contraseña',
)

assert.match(guardMigration, /JOIN auth\.users au[\s\S]*?au\.id = \(SELECT auth\.uid\(\)\)/,
  'la prevalidación debe resolver la identidad exclusivamente con auth.uid()')
assert.match(guardMigration, /au\.id = ia\.usuario_id/,
  'la identidad Auth debe coincidir con el destinatario de la invitación')
assert.match(guardMigration, /lower\(btrim\(au\.email\)\) = lower\(btrim\(ia\.email\)\)/,
  'el correo Auth debe coincidir con el correo invitado')
assert.match(guardMigration, /ia\.estado = 'pendiente'[\s\S]*?ia\.expires_at > now\(\)/,
  'sólo una invitación pendiente y vigente habilita el formulario')
assert.match(guardMigration, /REVOKE ALL ON FUNCTION public\.validar_invitacion_pendiente_v1\(\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role/,
  'la función no debe conservar privilegios implícitos')
assert.match(guardMigration, /GRANT EXECUTE ON FUNCTION public\.validar_invitacion_pendiente_v1\(\)[\s\S]*?TO authenticated, service_role/,
  'sólo identidades autenticadas y servicio pueden prevalidar')

const passwordBlock = activation.match(
  /const \{ data: passwordData, error: passwordError \}[\s\S]*?if \(activacionError/,
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
