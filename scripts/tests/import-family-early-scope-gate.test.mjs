import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const source = fs.readFileSync(path.join(ROOT, 'netlify/functions/importar-familia.ts'), 'utf8')
const serverScope = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260828000230_server_write_scope_v1.sql'),
  'utf8',
)

const actorClientPos = source.indexOf('const actorSupabase = createClient(supabaseUrl, anonKey')
const profileGatePos = source.indexOf(".from('usuarios')")
const branchGatePos = source.indexOf(".from('sucursales')")
const accessGatePos = source.indexOf(".from('usuario_accesos')")
const permissionGatePos = source.indexOf('if (!puedeImportar)')
const fileDecodePos = source.indexOf('Buffer.from(archivoBase64')
const serviceRolePos = source.indexOf('const supabase = createClient(supabaseUrl, serviceRoleKey')
const privilegedCatalogPos = source.indexOf(".from('familias')")

assert.ok(actorClientPos >= 0, 'debe crear un cliente RLS con la identidad del actor')
assert.match(source, /accessToken:\s*async \(\) => token/, 'el cliente del actor debe usar el JWT validado')
assert.ok(profileGatePos > actorClientPos, 'debe validar el perfil propio mediante RLS')
assert.ok(branchGatePos > actorClientPos, 'debe validar la sucursal mediante RLS')
assert.ok(accessGatePos > actorClientPos, 'debe leer sólo los accesos propios mediante RLS')
assert.match(source, /if \(!perfilActor\?\.activo\)/, 'una cuenta inactiva debe quedar bloqueada')
assert.match(source, /acceso\.rol === 'gerente_sucursal'/, 'gerente local conserva importación')
assert.match(source, /acceso\.rol === 'supervisor'/, 'supervisor local conserva importación')
assert.doesNotMatch(source, /acceso\.rol === 'gerente_zonal'/,
  'gerente zonal es sólo lectura y no debe entrar al endpoint de importación')
assert.doesNotMatch(source, /acceso\.rol === 'admin_organizacion'/,
  'admin de jerarquía no debe ampliar scope operativo')
assert.doesNotMatch(source, /acceso\.rol === 'operador'/, 'operador no entra al flujo de importación')
assert.match(source, /acceso\.sucursal_id === sucursalId/,
  'el permiso de importación debe exigir la sucursal exacta')
assert.ok(permissionGatePos > accessGatePos)
assert.ok(fileDecodePos > permissionGatePos, 'el archivo no se procesa antes del gate local')
assert.ok(serviceRolePos > permissionGatePos, 'service_role sólo existe después del gate local')
assert.ok(privilegedCatalogPos > serviceRolePos)

// La capa SQL repite la misma barrera para que un caller server-side nuevo no
// pueda saltarse el alcance local.
assert.match(source, /supabase\.rpc\('aplicar_importacion_glaciar_familia_v1'/)
assert.match(serverScope, /CREATE FUNCTION public\.aplicar_importacion_glaciar_familia_v1/)
assert.match(
  serverScope,
  /aplicar_importacion_glaciar_familia_v1[\s\S]*?validar_operacion_local_server_v1\(p_usuario_id,p_sucursal_id\)/,
  'el commit final debe exigir gate local gerente/supervisor',
)
assert.match(
  serverScope,
  /validar_operacion_local_server_v1[\s\S]*?ua\.rol IN \('gerente_sucursal','supervisor'\)/,
  'gerente_zonal y admin_organizacion no deben entrar al gate de escritura',
)
assert.match(
  serverScope,
  /REVOKE ALL ON FUNCTION public\.aplicar_importacion_glaciar_familia_legacy_v1[\s\S]*?service_role/,
  'service_role tampoco debe poder saltar directo a la implementación legacy',
)

console.log('✓ Importación familia: endpoint + RPC final exigen scope operativo local')
