import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const workflow = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')

assert.match(
  workflow,
  /push:\s*\n\s+branches:\s*\n\s+- master(?:\s*\n|$)/,
  'Noven CI debe ejecutar push sobre master',
)
assert.match(
  workflow,
  /pull_request:\s*\n\s+branches:\s*\n\s+- master(?:\s*\n|$)/,
  'Noven CI debe validar pull requests contra master',
)
assert.doesNotMatch(
  workflow,
  /feat\/multitenant-architecture-v1/,
  'la rama histórica fusionada no debe conservar un trigger dedicado',
)

console.log('OK: los triggers de Noven CI quedan limitados a master y sus pull requests')
