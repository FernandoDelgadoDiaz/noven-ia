// Contrato del secret scanning en CI.
//
// El riesgo que esto cubre no es el commit deliberado de una credencial —eso se
// rota y se sabe— sino el archivo de diagnóstico pegado dentro de un PR sin
// mirar qué contenía. El repositorio maneja la `service_role` de Supabase, que
// bypassa RLS entera, claves de proveedor de inferencia y la privada de VAPID.
//
// Lo que este contrato protege es que el escaneo siga siendo capaz de fallar.
// Un paso que corre pero no rompe el build, o una versión flotante que un día
// cambia de comportamiento, dan la misma sensación de cobertura y ninguna
// cobertura.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')
const config = fs.readFileSync(path.join(root, '.gitleaks.toml'), 'utf8')

// --- El paso existe y puede romper el build --------------------------------

assert.match(ci, /- name: Secret scanning/,
  'CI debe tener un paso de secret scanning')

// Se recorta hasta el siguiente paso, sea cual sea: usar un nombre fijo como
// límite hace que al mover el paso el slice quede invertido y el test falle
// por un motivo que no es el real.
function extraerPaso(yaml, nombre) {
  const inicio = yaml.indexOf(`- name: ${nombre}`)
  assert.notEqual(inicio, -1, `no se encontró el paso "${nombre}"`)
  const resto = yaml.slice(inicio + 1)
  const siguiente = resto.search(/\n {6}- name: /)
  return siguiente === -1 ? yaml.slice(inicio) : resto.slice(0, siguiente)
}

const paso = extraerPaso(ci, 'Secret scanning')

assert.match(paso, /--exit-code 1/,
  'el escaneo tiene que fallar el build al encontrar algo; sin esto es decorativo')
assert.doesNotMatch(paso, /continue-on-error/,
  'continue-on-error convierte el hallazgo en una advertencia que nadie lee')
assert.doesNotMatch(paso, /\|\|\s*true/,
  '`|| true` tapa el código de salida y anula el paso entero')
assert.match(paso, /--config \.gitleaks\.toml/,
  'debe usar la configuración del repositorio, no sólo las reglas por defecto')
assert.match(paso, /--redact/,
  'el hallazgo no debe imprimir el secreto en un log público')

// --- Versión fija ----------------------------------------------------------
// Una versión flotante cambia de reglas sin que nadie lo decida: un día el
// build se rompe por un hallazgo nuevo, o deja de marcar algo que marcaba.

const version = /GITLEAKS_VERSION:\s*'([\d.]+)'/.exec(ci)
assert.ok(version, 'la versión de gitleaks debe estar declarada')
assert.match(paso, new RegExp(`download/v\\$\\{GITLEAKS_VERSION\\}`),
  'la descarga debe usar la versión declarada, no `latest`')
assert.doesNotMatch(paso, /releases\/latest/,
  'nunca `latest`: la versión se cambia a propósito y se ve en el diff')

// --- Corre antes que el resto ----------------------------------------------
// Una credencial filtrada no mejora porque los tests pasen.

const posEscaneo = ci.indexOf('- name: Secret scanning')
for (const posterior of ['- name: Tests', '- name: Lint', '- name: Build']) {
  const pos = ci.indexOf(posterior)
  if (pos === -1) continue
  assert.ok(posEscaneo < pos,
    `el secret scanning debe correr antes de ${posterior.replace('- name: ', '')}`)
}

// --- Las reglas propias del proyecto existen -------------------------------
//
// Las reglas genéricas no distinguen una `anon` key —pública por diseño, viaja
// en el bundle— de la `service_role`, que bypassa RLS entera. Esa distinción
// es la razón de tener configuración propia.

for (const regla of [
  'supabase-service-role-jwt',
  'supabase-secret-key',
  'openai-api-key',
  'deepseek-api-key',
  'vapid-private-key',
]) {
  assert.match(config, new RegExp(`id = "${regla}"`),
    `falta la regla ${regla}, que cubre una credencial que este repositorio maneja`)
}

assert.match(config, /useDefault = true/,
  'las reglas propias suman a las genéricas, no las reemplazan')

// --- La regla de service_role cubre las tres alineaciones de base64 --------
//
// `service_role` viaja dentro del payload en base64, y base64 codifica de a
// tres bytes: el mismo texto produce tres cadenas distintas según en qué offset
// caiga dentro del JSON. Un solo literal deja pasar dos de cada tres casos.
//
// Esto no es teórico: la primera versión de la regla tenía un solo literal y
// NO disparó contra un JWT de prueba con `role: service_role`. Lo cazó la regla
// genérica `jwt`, así que el escaneo "funcionaba" y la regla propia era
// decorativa. Se notó sólo porque el reporte dice qué regla encontró qué.

const reglaServiceRole = config.slice(
  config.indexOf('id = "supabase-service-role-jwt"'),
  config.indexOf('id = "supabase-secret-key"'),
)
for (const alineacion of ['c2VydmljZV9yb2xl', 'cnZpY2Vfcm9s', 'ZXJ2aWNlX3Jv']) {
  assert.match(reglaServiceRole, new RegExp(alineacion),
    `la regla debe cubrir la alineación base64 ${alineacion}; con una sola deja pasar dos de cada tres`)
}

// --- La anon key no se marca -----------------------------------------------
// Marcarla generaría un hallazgo en cada build y enseñaría a ignorar la alerta,
// que es el modo en que muere una herramienta como ésta.
assert.doesNotMatch(config, /id = "supabase-anon/,
  'la anon key es pública por diseño y no debe generar hallazgos')

// --- La allowlist no puede vaciar el escaneo -------------------------------

const allowlist = config.slice(config.indexOf('[allowlist]'))
assert.doesNotMatch(allowlist, /'''\^\.\*'''|'''\.\*'''|paths = \[\s*'''\^'''/,
  'una allowlist que matchea todo apaga el escaneo sin que el paso falle')

console.log('✓ Secret scanning fija versión, rompe el build al encontrar y distingue service_role de anon')
