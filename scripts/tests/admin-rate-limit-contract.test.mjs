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

const functionSources = fs
  .readdirSync(path.join(ROOT, 'netlify/functions'))
  .filter((name) => name.endsWith('.ts'))
  .map((name) => read(`netlify/functions/${name}`))
  .join('\n')
assert.equal(
  [...functionSources.matchAll(/rateLimit:\s*\{/g)].length,
  2,
  'los planes básicos de Netlify admiten dos reglas en código; no excederlas',
)

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
