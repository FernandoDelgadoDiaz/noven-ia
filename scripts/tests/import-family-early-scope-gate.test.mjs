import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const source = fs.readFileSync(path.join(ROOT, 'netlify/functions/importar-familia.ts'), 'utf8')

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
assert.match(source, /if \(!perfilActor\?\.activo\)/, 'una cuenta inactiva debe quedar bloqueada antes de importar')
assert.match(source, /acceso\.rol === 'admin_organizacion'/, 'admin de organización debe conservar permiso')
assert.match(source, /acceso\.rol === 'gerente_zonal'/, 'gerente zonal debe conservar permiso')
assert.match(source, /acceso\.rol === 'gerente_sucursal'/, 'gerente de sucursal debe conservar permiso')
assert.match(source, /acceso\.rol === 'supervisor'/, 'supervisor debe conservar permiso')
assert.doesNotMatch(source, /acceso\.rol === 'operador'/, 'operador no debe habilitar la importación por familia')
assert.ok(permissionGatePos > accessGatePos, 'el permiso debe resolverse después de leer el scope propio')
assert.ok(fileDecodePos > permissionGatePos, 'no debe procesar el archivo antes de autorizar al actor')
assert.ok(serviceRolePos > permissionGatePos, 'service_role sólo puede crearse después del gate temprano')
assert.ok(privilegedCatalogPos > serviceRolePos, 'el catálogo privilegiado sólo puede leerse tras el gate')
assert.match(
  source,
  /supabase\.rpc\('aplicar_importacion_glaciar_familia_v1'/,
  'la RPC final autorizada debe mantenerse como segunda barrera',
)

console.log('✓ Importación por familia autoriza con RLS antes de cualquier lectura privilegiada')
