import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8')

const helperSource = read('netlify/functions/_lib/auth-directory.ts')
const helperJavaScript = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const helper = await import(
  `data:text/javascript;base64,${Buffer.from(helperJavaScript).toString('base64')}`
)

assert.equal(helper.esEmailDuplicadoAuth({ code: 'email_exists' }), true)
assert.equal(helper.esEmailDuplicadoAuth({ code: 'user_already_exists' }), true)
assert.equal(helper.esEmailDuplicadoAuth({ code: 'conflict' }), false)
assert.equal(
  helper.esEmailDuplicadoAuth({ message: 'User already exists' }),
  false,
  'los errores de Auth deben clasificarse por code estable, no por texto',
)

const consultas = []
let simultaneas = 0
let maxSimultaneas = 0
const authAdmin = {
  async getUserById(userId) {
    consultas.push(userId)
    simultaneas++
    maxSimultaneas = Math.max(maxSimultaneas, simultaneas)
    await new Promise((resolve) => setTimeout(resolve, 1))
    simultaneas--
    if (userId === 'eliminado') {
      return { data: { user: null }, error: { code: 'user_not_found' } }
    }
    return { data: { user: { email: `${userId}@noven.test` } }, error: null }
  },
}

const emails = await helper.resolverEmailsAuthPorIds(authAdmin, [
  'usuario-2',
  'usuario-1',
  'usuario-2',
  ' ',
  'eliminado',
  ...Array.from({ length: 12 }, (_, index) => `extra-${index}`),
])

assert.equal(consultas.filter((id) => id === 'usuario-2').length, 1, 'cada identidad se consulta una sola vez')
assert.equal(emails.get('usuario-1'), 'usuario-1@noven.test')
assert.equal(emails.get('eliminado'), '', 'una identidad ya eliminada conserva el usuario local sin email')
assert.ok(maxSimultaneas <= 8, 'las consultas puntuales a Auth deben tener concurrencia acotada')

await assert.rejects(
  helper.resolverEmailsAuthPorIds({
    async getUserById() {
      return { data: { user: null }, error: { code: 'unexpected_failure' } }
    },
  }, ['usuario-1']),
  (error) => error?.code === 'unexpected_failure',
)

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(absolute) : [absolute]
  })
}

const functionSources = walk(path.join(ROOT, 'netlify/functions'))
  .filter((filename) => filename.endsWith('.ts'))
  .map((filename) => fs.readFileSync(filename, 'utf8'))
  .join('\n')

assert.doesNotMatch(functionSources, /\.listUsers\s*\(/, 'ninguna Function puede recorrer el directorio Auth')
assert.doesNotMatch(functionSources, /\/auth\/v1\/admin\/users\?/, 'ninguna Function puede paginar usuarios Auth')
assert.doesNotMatch(functionSources, /per_page=\d+/, 'ninguna Function puede reconstruir un listado global por páginas')

const adminAccesos = read('netlify/functions/admin-accesos.ts')
const adminSucursal = read('netlify/functions/admin-sucursal.ts')
for (const source of [adminAccesos, adminSucursal]) {
  assert.match(source, /esEmailDuplicadoAuth\(err\)/)
  assert.doesNotMatch(source, /emailYaExiste|listarEmailsAuth|verify_invite_email/)
}
assert.match(adminSucursal, /resolverEmailsAuthPorIds\(supabase\.auth\.admin, ids\)/)
const rpcScopeIndex = adminSucursal.indexOf("supabase.rpc('listar_admin_sucursal_v1'")
const scopedIdsIndex = adminSucursal.indexOf('const ids = (payload.usuarios ?? [])')
const authLookupIndex = adminSucursal.indexOf('resolverEmailsAuthPorIds(supabase.auth.admin, ids)')
assert.ok(
  rpcScopeIndex >= 0 && scopedIdsIndex > rpcScopeIndex && authLookupIndex > scopedIdsIndex,
  'los IDs de Auth deben provenir exclusivamente del resultado ya acotado por el RPC',
)
assert.match(helperSource, /getUserById\(userId\)/)

console.log('✓ Auth se consulta sólo por identidades autorizadas y los duplicados se resuelven atómicamente')
