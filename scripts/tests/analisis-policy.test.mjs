import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const policy = fs.readFileSync(path.join(root, 'netlify/functions/_analisis_policy.ts'), 'utf8')
const source = fs.readFileSync(path.join(root, 'netlify/functions/analisis.ts'), 'utf8')

assert.match(policy, /Noven NO está integrado directamente con Glaciar/)
assert.match(policy, /NUNCA afirme que en Glaciar no existe RAG/)
assert.match(policy, /NO recomiende donación anticipada/)
assert.match(policy, /SEGURO: seguimiento normal/)
assert.match(policy, /DONACIÓN \+ DECOMISO/)
assert.match(policy, /No afirme estacionalidad/)

assert.match(source, /RAG en Noven: sin intervención registrada/)
assert.match(source, /Esto NO confirma el estado en Glaciar/)
assert.match(source, /no donar antes del umbral obligatorio/)
assert.match(source, /Seguimiento normal; no indicar RAG obligatorio/)
assert.match(source, /Resultado terminal combinado DONACIÓN \+ DECOMISO/)
assert.match(source, /temperature: 0\.2/)
assert.doesNotMatch(source, /RAG: sin intervención registrada'/)

console.log('✓ Política gerencial del análisis protegida')
