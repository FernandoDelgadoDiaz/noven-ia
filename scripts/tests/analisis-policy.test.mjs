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
assert.match(policy, /UNIDADES Y DINERO tienen igual importancia/)
assert.match(policy, /PRIORIDAD OPERATIVA de PRIORIDAD ECONÓMICA/)
assert.match(policy, /NUNCA compare un trimestre abierto contra un trimestre completo/)
assert.match(policy, /CONTROL FÍSICO HOY/)
assert.match(policy, /No afirme estacionalidad/)

assert.match(source, /Noven no tiene RAG registrado/)
assert.match(source, /no informa el estado de Glaciar/)
assert.match(source, /no donar antes del umbral obligatorio/)
assert.match(source, /Seguimiento normal; no indicar RAG obligatorio/)
assert.match(source, /producto_costo_ultima_observacion/)
assert.match(source, /v_acciones_operativas_historial/)
assert.match(source, /Unidades expuestas actuales/)
assert.match(source, /Dinero en riesgo valorizado/)
assert.match(source, /PRIORIDAD ECONÓMICA/)
assert.match(source, /Ventana actual equivalente/)
assert.match(source, /Ventana anterior equivalente/)
assert.match(source, /NO comparar el trimestre abierto contra el trimestre anterior completo/)
assert.match(source, /Recurrencia demostrable entre ambas ventanas equivalentes/)
assert.match(source, /No afirmar estacionalidad/)
assert.match(source, /temperature: 0\.2/)
assert.doesNotMatch(source, /Glaciar no (?:tiene|posee|registra) RAG/i)

console.log('✓ Política gerencial del análisis económico protegida')
