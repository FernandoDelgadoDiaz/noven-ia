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
const analisis = read('netlify/functions/analisis.ts')
const aprenderFamilia = read('netlify/functions/aprender-pendientes-familia.ts')
const importarFamilia = read('netlify/functions/importar-familia.ts')
const radarPush = read('netlify/functions/enviar-push-radar-zonal.ts')
const urgentPush = read('netlify/functions/enviar-push.ts')

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
  ['analisis', analisis],
  ['aprender-pendientes-familia', aprenderFamilia],
  ['importar-familia', importarFamilia],
  ['enviar-push-radar-zonal', radarPush],
  ['enviar-push', urgentPush],
]) {
  assert.match(source, /import \{ logServerError \} from '\.\/_observability'/, `${name}: usa logger común`)
  assert.doesNotMatch(source, /console\.error\(/, `${name}: no imprime errores crudos`)
  assert.doesNotMatch(source, /No se pudo (verificar|validar) la sesión: \$\{/, `${name}: no expone detalle de excepción de sesión`)
}

assert.match(listar, /operation: 'listar_productos_pendientes_catalogo_v2'/)
assert.match(importar, /operation: 'validar_operacion_local_server_v1'/)
assert.match(importar, /operation = 'aplicar_importacion_glaciar_masiva_v2'/)
assert.match(importar, /operation = 'aplicar_importacion_0258_masiva_v1'/)
assert.match(importar, /logServerError\(event, \{ endpoint: ENDPOINT, operation, statusCode: status, error \}\)/)
assert.match(resolver, /operation: 'validar_resolucion_pendiente_server_v1'/)
assert.match(aprenderFamilia, /operation: 'session_verify'/)
assert.match(aprenderFamilia, /operation: 'validar_operacion_local_server_v1'/)
for (const operation of [
  'session_verify',
  'load_actor_scope',
  'load_actor_access',
  'load_family',
  'load_catalog_candidates',
  'load_family_catalog',
  'load_local_store_state',
]) {
  assert.match(importarFamilia, new RegExp(`operation: '${operation}'`), `importar-familia: registra ${operation}`)
}
for (const operation of [
  'server_config',
  'load_alert',
  'load_product',
  'load_origin_store',
  'load_destinations',
  'load_push_subscriptions',
  'send_notification',
  'delete_expired_subscriptions',
  'mark_dispatch_processed',
]) {
  assert.match(radarPush, new RegExp(`operation: '${operation}'`), `radar push: registra ${operation}`)
}
for (const operation of [
  'server_config',
  'load_expiry',
  'load_product',
  'load_local_accesses',
  'load_family_responsibles',
  'load_push_subscriptions',
  'send_notification',
  'delete_expired_subscriptions',
]) {
  assert.match(urgentPush, new RegExp(`operation: '${operation}'`), `urgent push: registra ${operation}`)
}

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

// Análisis IA registra sólo errores técnicos mínimos; nunca prompt, body del proveedor ni detalles crudos al cliente.
for (const operation of [
  'server_config',
  'session_verify',
  'load_profile',
  'load_store',
  'load_access_scope',
  'load_expiries',
  'load_family_names',
  'load_rag',
  'load_current_costs',
  'load_economic_history',
  'deepseek_http',
  'deepseek_empty',
  'deepseek_request',
]) {
  assert.match(analisis, new RegExp(`operation: '${operation}'`), `analisis: registra ${operation}`)
}
assert.doesNotMatch(analisis, /dsRes\.text\(/, 'analisis: no registra body de error de DeepSeek')
assert.doesNotMatch(analisis, /logServerError[^\n]*datosFormateados/, 'analisis: no envía prompt al logger')
assert.doesNotMatch(analisis, /\$\{(?:perfilError|sucursalError|accesosError|vErr|ragError|costosError|histActualError|histAnteriorError).*?\.message\}/, 'analisis: no devuelve mensajes internos de Supabase')
assert.match(analisis, /'No se pudo completar el análisis con el modelo\.'/)
assert.match(analisis, /'No se pudo contactar el modelo de análisis\.'/)

// Importaciones de catálogo no filtran excepciones de Auth/Supabase al navegador.
assert.doesNotMatch(importarFamilia, /\$\{(?:errCod|errEan|errPorFamilia|errEstados).*?\.message\}/)
assert.doesNotMatch(importarFamilia, /error: errAplicado\.message/)
assert.doesNotMatch(aprenderFamilia, /error: error\.message/)
assert.match(aprenderFamilia, /'No se pudo completar el aprendizaje de catálogo\.'/)
assert.match(importarFamilia, /'No se pudo reconstruir la reconciliación del catálogo\.'/)
assert.match(importarFamilia, /'No se pudo cargar el catálogo de la familia\.'/)
assert.match(importarFamilia, /'No se pudo cargar el estado local de la sucursal\.'/)
assert.match(importarFamilia, /'No se pudo aplicar la importación de la familia\.'/)

// Radar: una falla técnica al leer suscripciones debe abortar ANTES de marcar
// notificada_at. De otro modo se pierde la posibilidad de reintento.
const subsFailureStart = radarPush.indexOf('if (subsError)')
const markDispatchStart = radarPush.indexOf(".update({ notificada_at: new Date().toISOString() })")
assert.ok(subsFailureStart >= 0, 'radar push: controla subsError')
assert.ok(markDispatchStart > subsFailureStart, 'radar push: marca despacho después de resolver suscripciones')
const subsFailureBlock = radarPush.slice(subsFailureStart, markDispatchStart)
assert.match(subsFailureBlock, /return \{ statusCode: 500/, 'radar push: aborta si falla la consulta de suscripciones')
assert.match(radarPush, /'No se pudieron leer suscripciones push'/)

// Push urgente: los fallos técnicos previos al envío conservan los status y
// mensajes funcionales existentes; fallos posteriores al envío sólo se registran
// para no inducir reintentos que puedan duplicar notificaciones.
assert.match(urgentPush, /'No se pudo resolver el vencimiento'/)
assert.match(urgentPush, /'No se pudieron resolver destinatarios'/)
assert.match(urgentPush, /'No se pudieron leer suscripciones push'/)
assert.match(urgentPush, /const \{ error: cleanupError \} = await supabase/)
assert.match(urgentPush, /if \(cleanupError\)/)

// Los 5xx devuelven mensajes estables; el detalle queda sólo en Netlify.
assert.match(listar, /'No se pudo consultar el catálogo pendiente\.'/)
assert.match(importar, /'No se pudo aplicar la importación\.'/)
assert.match(adminAccesos, /'No se pudo consultar el contexto de accesos\.'/)
assert.match(adminSucursal, /'No se pudo completar el listado de usuarios\.'/)
assert.match(adminInvitaciones, /'No se pudo limpiar la cuenta pendiente en Auth\.'/)

console.log('✓ Functions críticas, administrativas, Análisis IA, importaciones y pushes emiten errores estructurados; Radar conserva retry ante fallo de suscripciones')