import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const migration = read('supabase/migrations/20260828000150_invitation_management_v1.sql')
const backend = read('netlify/functions/admin-invitaciones.ts')
const dock = read('src/components/admin/InvitationManagementDock.tsx')
const layout = read('src/components/layout/AppLayout.tsx')

assert.match(migration, /ALTER COLUMN usuario_id DROP NOT NULL/, 'la auditoría debe sobrevivir a la limpieza de Auth')
assert.match(migration, /ON DELETE SET NULL/, 'el historial de invitación no debe borrarse al eliminar Auth')
assert.match(migration, /puede_gestionar_invitacion_v1/, 'la gestión debe validar alcance server-side')
assert.match(migration, /ua\.rol = 'admin_organizacion'/, 'admin organización debe gestionarse explícitamente')
assert.match(migration, /ia\.rol = 'gerente_sucursal'[\s\S]*?ua\.rol = 'gerente_zonal'/, 'zonal sólo puede gestionar gerentes de sucursal de su zona')
assert.match(migration, /ia\.rol IN \('supervisor','operador'\)/, 'la gestión local debe limitarse a roles operativos')
assert.match(migration, /ia\.sucursal_id=p_sucursal_id/, 'el listado local debe quedar aislado a la sucursal seleccionada')
assert.match(migration, /ia\.estado='pendiente'/, 'sólo deben exponerse invitaciones pendientes para gestión')
assert.match(migration, /expires_at<=now\(\) THEN 'vencida'/, 'una pendiente vencida debe mostrarse como vencida')
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.listar_invitaciones_gestion_v1[\s\S]*?TO service_role/, 'el listado de gestión debe ser sólo service role')
assert.match(migration, /REVOKE ALL ON FUNCTION public\.anular_invitacion_gestion_v1[\s\S]*?authenticated/, 'authenticated no debe ejecutar anulaciones directas')

assert.match(backend, /validarSesion/, 'el endpoint debe exigir sesión antes de usar service role')
assert.match(backend, /accion === 'anular'/, 'debe existir anulación explícita')
assert.match(backend, /accion !== 'regenerar'/, 'debe existir regeneración explícita')
assert.match(backend, /auth\.admin\.deleteUser/, 'un link viejo debe invalidarse eliminando la cuenta Auth pendiente')
assert.match(backend, /estado: 'pendiente', anulada_at: null/, 'si falla limpieza Auth la anulación debe revertirse para permitir reintento')
assert.match(backend, /registrar_invitacion_acceso_v1/, 'regenerar jerarquía debe reutilizar el registrador endurecido')
assert.match(backend, /registrar_invitacion_local_v1/, 'regenerar local debe reutilizar el registrador endurecido')
assert.doesNotMatch(backend, /SUPABASE_SERVICE_ROLE_KEY[^\n]+body/i, 'service role nunca debe exponerse al cliente')

assert.match(dock, /pathname === '\/admin\/accesos'/, 'el panel debe aparecer en jerarquía')
assert.match(dock, /pathname === '\/admin'/, 'el panel debe aparecer en admin local')
assert.match(dock, /accion: 'regenerar'/, 'la UI debe permitir regenerar')
assert.match(dock, /accion: 'anular'/, 'la UI debe permitir anular')
assert.match(dock, /VENCIDA/, 'la UI debe distinguir invitaciones vencidas')
assert.match(layout, /<InvitationManagementDock \/>/, 'la gestión debe quedar montada en el layout autenticado')

console.log('✓ Invitaciones pendientes: listado por scope, anulación auditable y regeneración segura')
