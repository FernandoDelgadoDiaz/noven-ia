import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8')

const routingSource = read('netlify/functions/_lib/admin-routing.ts')
const routingJavaScript = ts.transpileModule(routingSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const routing = await import(
  `data:text/javascript;base64,${Buffer.from(routingJavaScript).toString('base64')}`
)

for (const resource of ['accesos', 'sucursal', 'invitaciones']) {
  assert.equal(routing.adminLaneForPath(`/api/admin/read/${resource}`, resource), 'read')
  assert.equal(routing.adminLaneForPath(`/api/admin/write/${resource}`, resource), 'write')
  assert.equal(routing.adminLaneForPath(`/.netlify/functions/admin-${resource}`, resource), null)
}
assert.equal(routing.adminActionMatchesLane('read', 'listar'), true)
assert.equal(routing.adminActionMatchesLane('write', 'listar'), false)
assert.equal(routing.adminActionMatchesLane('write', 'invitar'), true)
assert.equal(routing.adminActionMatchesLane('write', 'editar'), true)
assert.equal(routing.adminActionMatchesLane('write', 'anular'), true)
assert.equal(routing.adminActionMatchesLane('write', 'regenerar'), true)

const readFunction = read('netlify/functions/admin-read.ts')
const writeFunction = read('netlify/functions/admin-write.ts')
const router = read('netlify/functions/_lib/admin-router.ts')

assert.match(readFunction, /path: '\/api\/admin\/read\/\*'/)
assert.match(readFunction, /windowLimit: 180/)
assert.match(readFunction, /windowSize: 60/)
assert.match(writeFunction, /path: '\/api\/admin\/write\/\*'/)
assert.match(writeFunction, /windowLimit: 20/)
assert.match(writeFunction, /windowSize: 60/)
for (const source of [readFunction, writeFunction]) {
  assert.match(source, /action: 'rate_limit'/)
  assert.match(source, /aggregateBy: \['ip', 'domain'\]/)
  assert.match(source, /export default dispatchAdminRequest/)
}

// Techo del proveedor: los planes básicos de Netlify admiten dos reglas
// `rateLimit` declaradas en código, y hoy ambas están consumidas por las dos
// rutas administrativas. Eso es una LIMITACIÓN CONOCIDA, no una invariante de
// arquitectura: está registrada como deuda D-1 en
// docs/PRE_PRODUCTION_HARDENING_PLAN.md, junto con el hecho de que las demás
// funciones —`analisis.ts` entre ellas— siguen sin ningún límite.
//
// Este contrato NO congela la cantidad de reglas. Afirmar `=== 2` convertía el
// techo del proveedor en un test que rompía cualquier intento de proteger otra
// función: escondía la deuda en lugar de señalarla, y el primer síntoma habría
// sido un test rojo en vez de un error de despliegue legible.
//
// Lo que sí exige: que las dos reglas conocidas sigan existiendo con sus
// valores, y que toda regla declarada —las de hoy y las que se agreguen— esté
// completa. Una regla a la que le falte un campo se despliega sin proteger
// nada y no falla en ningún lado.
const archivosFuncion = fs
  .readdirSync(path.join(ROOT, 'netlify/functions'))
  .filter((name) => name.endsWith('.ts'))

const archivosConRegla = archivosFuncion.filter((name) =>
  /rateLimit:\s*\{/.test(read(`netlify/functions/${name}`)),
)

// Las dos reglas administrativas no pueden desaparecer. Esto es un piso, no un
// techo: una tercera función que declare su propio límite pasa este contrato.
for (const conocida of ['admin-read.ts', 'admin-write.ts']) {
  assert.ok(
    archivosConRegla.includes(conocida),
    `${conocida} debe seguir declarando su regla rateLimit`,
  )
}

for (const nombre of archivosConRegla) {
  const source = read(`netlify/functions/${nombre}`)
  for (const campo of [
    /action: 'rate_limit'/,
    /windowLimit: \d+/,
    /windowSize: \d+/,
    /aggregateBy: \['ip', 'domain'\]/,
  ]) {
    assert.match(
      source,
      campo,
      `${nombre} declara rateLimit pero no satisface ${campo}: ` +
        'una regla incompleta se despliega sin proteger nada',
    )
  }
}

for (const resource of ['accesos', 'sucursal', 'invitaciones']) {
  assert.match(router, new RegExp(`'/api/admin/read/${resource}'`))
  assert.match(router, new RegExp(`'/api/admin/write/${resource}'`))
}

for (const [file, resource] of [
  ['netlify/functions/admin-accesos.ts', 'accesos'],
  ['netlify/functions/admin-sucursal.ts', 'sucursal'],
  ['netlify/functions/admin-invitaciones.ts', 'invitaciones'],
]) {
  const source = read(file)
  const routeGate = source.indexOf(`adminLaneForPath(event.path, '${resource}')`)
  const options = source.indexOf("event.httpMethod === 'OPTIONS'")
  assert.ok(routeGate >= 0 && routeGate < options, `${resource}: cierra el endpoint legacy antes de ejecutar`)
  assert.match(source, /adminActionMatchesLane\(lane, body\.accion\)/)
  assert.match(source, /Ruta administrativa inexistente/)
}

for (const file of [
  'src/pages/AdminAccesos.tsx',
  'src/pages/AdminSeguro.tsx',
  'src/components/admin/InvitationManagementDock.tsx',
]) {
  const source = read(file)
  assert.match(source, /body\.accion === 'listar' \? 'read' : 'write'/)
  assert.match(source, /res\.status === 429/)
  assert.doesNotMatch(source, /\.netlify\/functions\/admin-/)
}

for (const file of [
  'e2e/fixtures/noven-fixture.mjs',
  'e2e/fixtures/analysis-invitations-fixture.mjs',
]) {
  const source = read(file)
  assert.match(source, /api\\?\/admin|api\/admin/)
  assert.doesNotMatch(source, /\.netlify\/functions\/admin-(?:accesos|sucursal|invitaciones)/)
}

console.log('✓ Administración e invitaciones usan dos límites distribuidos, rutas canónicas y ningún bypass legacy')
