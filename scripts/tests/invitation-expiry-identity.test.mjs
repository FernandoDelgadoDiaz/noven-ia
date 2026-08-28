import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const migration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260828000110_invitation_expiry_identity_v1.sql'),
  'utf8',
)
const admin = fs.readFileSync(path.join(ROOT, 'netlify/functions/admin-accesos.ts'), 'utf8')
const activation = fs.readFileSync(path.join(ROOT, 'src/pages/ActivarCuenta.tsx'), 'utf8')
const sql = migration.replace(/^\s*--.*$/gm, '')

assert.match(sql, /ADD COLUMN IF NOT EXISTS expires_at timestamptz/, 'la invitación debe tener caducidad propia')
assert.match(sql, /interval '72 hours'/g, 'la vigencia Noven debe ser de 72 horas')
assert.match(sql, /CHECK \(expires_at > created_at\)/, 'la caducidad debe ser posterior a la creación')
assert.match(sql, /FROM auth\.users u[\s\S]*?WHERE u\.id = v_uid/, 'la aceptación debe resolver la identidad Auth real')
assert.match(sql, /lower\(btrim\(ia\.email\)\) = v_email/, 'el email invitado debe coincidir con el email autenticado')
assert.match(sql, /ia\.expires_at <= now\(\)/, 'las invitaciones vencidas deben detectarse server-side')
assert.match(sql, /SET estado = 'anulada'/, 'una invitación vencida debe quedar terminalmente anulada')
assert.match(sql, /ia\.expires_at > now\(\)/g, 'sólo invitaciones vigentes pueden activar acceso')
assert.match(sql, /REVOKE ALL ON FUNCTION public\.aceptar_invitacion_acceso_v1\(\) FROM PUBLIC, anon/, 'anon no puede aceptar invitaciones')
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.aceptar_invitacion_acceso_v1\(\) TO authenticated, service_role/, 'el usuario autenticado conserva la activación deliberada')
assert.match(admin, /type: 'invite'/, 'la invitación sigue naciendo desde Supabase Auth')
assert.match(admin, /data\.properties\.action_link/, 'el canal link sigue entregando el token opaco de Supabase')
assert.match(activation, /supabase\.rpc\('aceptar_invitacion_acceso_v1'\)/, 'la UI activa acceso sólo mediante el RPC endurecido')

console.log('✓ Invitaciones: identidad Auth + caducidad Noven de 72 h + aceptación autenticada')
