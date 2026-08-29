import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const helper = read('netlify/functions/_observability.ts')
const listar = read('netlify/functions/listar-pendientes-catalogo.ts')
const importar = read('netlify/functions/importar-asistido-completo.ts')
const resolver = read('netlify/functions/resolver-pendiente-catalogo.ts')
const adminAccesos = read('netlify/functions/admin-accesos.ts')
const adminSucursal = read('netlify/functions/admin-sucursal.ts')
const adminInvitaciones = read('netlify/functions/admin-invitaciones.ts')

// El log es JSON estructurado y usa el request id de Netlify cuando está disponible.
assert.match(helper, /x-nf-request-id/)
assert.match(helper, /x-request-id/)
assert.match(helper, /rawRequestId == null \? null : redactLogText\(rawRequestId\)/)
assert.match(helper, /request_id: requestId/)
assert.match(helper, /console\.error\(JSON\.stringify/)
assert.match(helper, /service: 'noven-netlify-function'/)

// Nunca registrar credenciales, emails, UUID completos ni blobs largos.
assert.match(helper, /Bearer/)
assert.match(helper, /'Bearer \[redacted\]'/)
assert.match(helper, /'\[email\]'/)
assert.match(helper, /'\[uuid\]'/)
assert.match(helper, /'\[token\]'/)
assert.match(helper, /'\[long-value\]'/)
assert.match(helper, /\.slice\(0, 320\)/)

for (const [name, source] of [
  ['listar-pendientes-catalogo', listar],
  ['importar-asistido-completo', importar],
  ['resolver-pendiente-catalogo', resolver],
  ['admin-accesos', adminAccesos],
  ['admin-sucursal', adminSucursal],
  ['admin-invitaciones', adminInvitaciones],
]) {
  assert.match(source, /import \{ logServerError \} from '\.\/_observability'/, `${name}: usa logger común`)
  assert.doesNotMatch(source, /console\.error\(/, `${name}: no imprime errores crudos`)
  assert.doesNotMatch(source, /No se pudo verificar la sesión: \$\{/, `${name}: no expone detalle de excepción de sesión`)
}

assert.match(listar, /operation: 'listar_productos_pendientes_catalogo_v2'/)
assert.match(importar, /operation: 'validar_operacion_local_server_v1'/)
assert.match(importar, /operation: 'aplicar_importacion_glaciar_masiva_v2'/)
assert.match(resolver, /operation: 'validar_resolucion_pendiente_server_v1'/)

// Admin distingue errores de negocio conocidos de fallos inesperados de DB/Auth.
for (const source of [adminAccesos, adminSucursal, adminInvitaciones]) {
  assert.match(source, /return 502/)
  assert.match(source, /operation: 'session_verify'/)
  assert.match(source, /statusCode: 502/)
}
assert.match(adminAccesos, /operation: 'registrar_invitacion_acceso_v1'/)
assert.match(adminSucursal, /operation: 'guardar_usuario_sucursal_admin_v1'/)
assert.match(adminSucursal, /operation: 'compensate_delete_auth_user'/)
assert.match(adminInvitaciones, /operation: 'delete_pending_auth_user'/)
assert.match(adminInvitaciones, /operation: 'rollback_invitation_after_auth_delete_failure'/)

// Los 5xx devuelven mensajes estables; el detalle queda sólo en Netlify.
assert.match(listar, /'No se pudo consultar el catálogo pendiente\.'/)
assert.match(importar, /'No se pudo aplicar la importación\.'/)
assert.match(adminAccesos, /'No se pudo consultar el contexto de accesos\.'/)
assert.match(adminSucursal, /'No se pudo completar el listado de usuarios\.'/)
assert.match(adminInvitaciones, /'No se pudo limpiar la cuenta pendiente en Auth\.'/)

console.log('✓ Functions críticas y administrativas emiten errores estructurados y redactados sin filtrar payloads sensibles')
