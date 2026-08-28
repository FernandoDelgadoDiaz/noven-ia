import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const migration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260828000160_local_admin_scope_boundary_v2.sql'),
  'utf8',
)

assert.match(
  migration,
  /WHERE actor\.id = p_actor_id[\s\S]*?AND actor\.activo = true/,
  'actor local debe tener perfil global activo además del acceso',
)
assert.match(
  migration,
  /'activo', ua\.activo/,
  'el estado mostrado por Admin local debe ser usuario_accesos.activo',
)
assert.match(
  migration,
  /'perfil_activo', u\.activo/,
  'el payload debe distinguir el estado global del perfil',
)
assert.match(
  migration,
  /'editable', \(u\.activo AND ua\.rol IN \('supervisor', 'operador'\)\)/,
  'sólo Supervisor/Operador con cuenta activa deben ser editables localmente',
)
assert.match(
  migration,
  /IF p_rol_legacy NOT IN \('supervisor', 'operador'\) THEN/,
  'la RPC local no debe aceptar admin/gerente como rol editable',
)
assert.match(
  migration,
  /El usuario no tiene un acceso local existente en esta sucursal\. Usá una invitación\./,
  'debe exigir acceso local previo y evitar adjuntar UUID arbitrarios',
)
assert.match(
  migration,
  /IF NOT v_perfil_activo THEN[\s\S]*?La cuenta debe completar su activación/,
  'una invitación pendiente no debe poder habilitarse desde Admin local',
)
assert.match(
  migration,
  /IF v_rol_actual = 'gerente_sucursal' THEN[\s\S]*?Accesos y jerarquía/,
  'los gerentes deben quedar fuera de la edición local',
)
assert.doesNotMatch(
  migration,
  /INSERT INTO public\.usuarios/i,
  'Admin local no debe crear perfiles directamente',
)

const profileUpdateMatch = migration.match(
  /UPDATE public\.usuarios u\n([\s\S]*?)\n\s*UPDATE public\.usuario_accesos ua/,
)
assert.ok(profileUpdateMatch, 'debe existir una actualización acotada del perfil antes del acceso local')
const profileUpdate = profileUpdateMatch[1]
assert.match(profileUpdate, /SET nombre = btrim\(p_nombre\)/, 'sólo se permite corregir el nombre de cuenta')
assert.doesNotMatch(profileUpdate, /\bactivo\s*=/i, 'Admin local no debe escribir usuarios.activo global')
assert.doesNotMatch(profileUpdate, /\brol\s*=/i, 'Admin local no debe escribir usuarios.rol legacy')
assert.doesNotMatch(profileUpdate, /\bsucursal_id\s*=/i, 'Admin local no debe escribir usuarios.sucursal_id legacy')

assert.match(
  migration,
  /UPDATE public\.usuario_accesos ua[\s\S]*?SET rol = v_rol_scope,[\s\S]*?activo = p_activo/,
  'rol y estado deben actualizarse solamente sobre el acceso local',
)
assert.match(
  migration,
  /UPDATE public\.usuario_familias_sucursal[\s\S]*?activo = false/,
  'la edición local debe conservar gestión transaccional de familias',
)
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.guardar_usuario_sucursal_admin_v1[\s\S]*?PUBLIC, anon, authenticated/,
  'la RPC de escritura debe continuar cerrada a clientes directos',
)
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.guardar_usuario_sucursal_admin_v1[\s\S]*?TO service_role/,
  'la RPC debe seguir siendo server-only',
)

console.log('✓ Admin local sólo edita accesos existentes de Supervisor/Operador y no toca el perfil global')
