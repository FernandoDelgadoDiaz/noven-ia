import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const raiz = path.resolve(AQUI, '../..')
const source = fs.readFileSync(path.join(raiz, 'netlify/functions/analisis.ts'), 'utf8')

const patronCanonico = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const sucursal091 = '00000000-0000-0000-0000-000000000001'

assert.equal(patronCanonico.test(sucursal091), true, 'La sucursal 091 productiva debe ser un UUID aceptado por el endpoint de análisis')
assert.match(
  source,
  /\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$/i,
  'El endpoint de análisis debe validar la forma UUID canónica sin exigir bits RFC de versión/variante',
)
assert.doesNotMatch(
  source,
  /\[1-5\]\[0-9a-f\]\{3\}.*\[89ab\]\[0-9a-f\]\{3\}/i,
  'No debe volver a rechazarse la sucursal 091 por una validación RFC 4122 demasiado estricta',
)

console.log('analisis-store-id-contract: OK')
