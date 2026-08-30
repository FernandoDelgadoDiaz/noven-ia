import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = process.cwd()
const badge = fs.readFileSync(path.join(root, 'src/components/dashboard/RagSeguimientoBadge.tsx'), 'utf8')
const card = fs.readFileSync(path.join(root, 'src/components/dashboard/AlertaItem.tsx'), 'utf8')

assert.match(badge, /v_seguimiento_rag_actual/, 'la UI debe leer seguimiento RAG actual')
assert.match(badge, /estado_seguimiento_rag/, 'debe usar el estado derivado del RAG')
assert.match(badge, /velocidad_observada/, 'debe mostrar velocidad observada')
assert.match(badge, /velocidad_necesaria/, 'debe comparar contra velocidad necesaria')
assert.match(badge, /Intervención funcionando/, 'debe explicar cuando el RAG funciona')
assert.match(badge, /Revisar intervención/, 'debe advertir cuando la intervención es insuficiente')
assert.match(badge, /Control pendiente/, 'debe distinguir falta de evidencia de fracaso')
assert.match(card, /RagSeguimientoBadge/, 'la tarjeta de riesgo debe exponer el seguimiento')
assert.doesNotMatch(badge, /RAG 50% recomendado|RAG 20% recomendado|RAG 30% recomendado/, 'no debe inventar porcentaje recomendado')

console.log('✓ RAG activo muestra seguimiento explicable sin inventar porcentaje')
