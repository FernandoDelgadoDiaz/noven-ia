import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const vite = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8')

assert.match(
  vite,
  /seed:\s*[1-9]\d*/,
  'la ofuscación de producción debe usar una semilla fija no nula para generar builds reproducibles',
)
assert.doesNotMatch(
  vite,
  /seed:\s*0\b/,
  'seed 0 vuelve aleatoria la ofuscación y rompe la reproducibilidad de hashes/tamaños entre builds idénticos',
)

console.log('✓ Ofuscación de producción usa una semilla reproducible')
