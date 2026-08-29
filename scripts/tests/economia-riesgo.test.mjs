import assert from 'node:assert/strict'
import fs from 'node:fs'

const economia = fs.readFileSync(new URL('../../src/lib/economia-riesgo.ts', import.meta.url), 'utf8')
const endpoint = fs.readFileSync(new URL('../../netlify/functions/costos-riesgo.ts', import.meta.url), 'utf8')

assert.match(economia, /cantidad - \(vmd \* dias\)/, 'las unidades expuestas deben descontar la venta esperable hasta el retiro')
assert.match(economia, /unidades \* costo/, 'el dinero en riesgo debe valorizar las unidades expuestas')
assert.match(economia, /costo unitario sin IVA/i, 'el contrato debe documentar que el costo normativo es sin IVA')
assert.match(endpoint, /costo_unitario, observado_at/, 'el endpoint debe usar Costo Unit. observado, no Costo Final')
assert.doesNotMatch(endpoint, /costo_final/, 'el endpoint económico no debe mezclar Costo Final')
assert.match(endpoint, /v_vencimientos_operativos/, 'el alcance debe derivarse de la vista operativa autorizada')
assert.match(endpoint, /costo_unitario_sin_iva/, 'la respuesta debe declarar el criterio económico')

console.log('✓ Riesgo económico: unidades expuestas + Costo Unit. sin IVA')
