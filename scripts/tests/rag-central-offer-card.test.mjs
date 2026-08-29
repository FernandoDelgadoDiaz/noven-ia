import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const hook = fs.readFileSync(path.join(ROOT, 'src/hooks/useVencimientos.ts'), 'utf8')
const card = fs.readFileSync(path.join(ROOT, 'src/components/dashboard/AlertaItem.tsx'), 'utf8')

assert.match(
  hook,
  /\.from\('intervenciones_rag'\)[\s\S]*?motivo_finalizacion[\s\S]*?nota_finalizacion/,
  'el dashboard debe leer la última intervención RAG y su motivo de finalización',
)
assert.match(
  hook,
  /row\.motivo_finalizacion === 'oferta_centralizada'/,
  'una finalización por oferta centralizada debe convertirse en estado visible',
)
assert.match(
  card,
  /✓ Oferta centralizada/,
  'la tarjeta debe mostrar la pastilla de oferta centralizada',
)
assert.match(
  card,
  /tieneIntervencionVisible[\s\S]*?filter\(\(accion\) => !\/\\bRAG\\b\/i\.test\(accion\)\)/,
  'con RAG activo u oferta centralizada no debe sugerirse gestionar RAG en paralelo',
)

console.log('✓ Oferta centralizada queda visible y evita una sugerencia RAG redundante')
