import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260828000130_local_user_invitations_v1.sql'), 'utf8')
const backend = fs.readFileSync(path.join(root, 'netlify/functions/admin-sucursal.ts'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'src/pages/AdminSeguro.tsx'), 'utf8')

assert.match(migration, /ADD COLUMN IF NOT EXISTS familias_ids uuid\[\] NOT NULL/)
assert.match(migration, /gerente_zonal','gerente_sucursal','supervisor','operador/)
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.registrar_invitacion_local_v1/)
assert.match(migration, /p_rol NOT IN \('supervisor','operador'\)/)
assert.match(migration, /ua\.rol = 'admin_organizacion'/)
assert.match(migration, /ua\.rol = 'gerente_zonal'/)
assert.match(migration, /ua\.rol = 'gerente_sucursal'/)
assert.match(migration, /guardar_usuario_sucursal_admin_v1\([\s\S]*?false/)
assert.match(migration, /usuario_familias_sucursal[\s\S]*?activo[\s\S]*?false/)
assert.match(migration, /ia\.rol IN \('gerente_sucursal','supervisor','operador'\)/)
assert.match(migration, /SET activo = true,[\s\S]*?usuario_familias_sucursal/)
assert.match(migration, /REVOKE ALL ON FUNCTION public\.registrar_invitacion_local_v1[\s\S]*?PUBLIC, anon, authenticated/)
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.registrar_invitacion_local_v1[\s\S]*?TO service_role/)

assert.match(backend, /body\.accion === 'crear'/)
assert.match(backend, /alta directa con contraseña inicial fue retirada/)
assert.match(backend, /body\.accion === 'invitar'/)
assert.match(backend, /generateLink\(/)
assert.match(backend, /inviteUserByEmail\(/)
assert.match(backend, /registrar_invitacion_local_v1/)
assert.match(backend, /eliminarAuthUser\(supabaseUrl, serviceRoleKey, usuarioId\)/)
assert.doesNotMatch(backend, /password\?: string/)
assert.doesNotMatch(backend, /crearAuthUser/)

assert.match(ui, /accion: 'invitar'/)
assert.match(ui, /Link \/ WhatsApp/)
assert.match(ui, /Enviar email/)
assert.match(ui, /define su propia contraseña/)
assert.match(ui, /Seleccioná al menos una familia responsable para el operador/)
assert.match(ui, /Crear invitación/)
assert.doesNotMatch(ui, /Contraseña inicial/)
assert.doesNotMatch(ui, /password:/)

console.log('✓ Alta local usa invitaciones seguras y no contraseñas iniciales')
