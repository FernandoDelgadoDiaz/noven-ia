import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const functionsDir = path.join(root, 'netlify/functions')
const files = fs.readdirSync(functionsDir).filter((name) => name.endsWith('.ts'))

const offenders = []
for (const file of files) {
  const source = fs.readFileSync(path.join(functionsDir, file), 'utf8')
  if (/\bverificarAdmin\b/.test(source)) offenders.push(`${file}: verificarAdmin`)
  if (/rol\s*!==?\s*['"]admin['"]|rol\s*===?\s*['"]admin['"]/.test(source)) {
    offenders.push(`${file}: autorización por rol legacy admin`)
  }
}

assert.deepEqual(
  offenders,
  [],
  `Netlify Functions no deben reintroducir autorización por el rol legacy admin: ${offenders.join(', ')}`,
)

const authHelper = fs.readFileSync(path.join(functionsDir, '_auth.ts'), 'utf8')
assert.match(authHelper, /export function getCorsHeaders/, '_auth debe conservar el helper CORS usado por endpoints activos')
assert.match(authHelper, /NO autoriza roles ni alcances de Noven/, 'el helper debe documentar explícitamente que no es frontera de autorización')

console.log(`✓ ${files.length} Netlify Functions sin verificador legacy de rol admin`)
