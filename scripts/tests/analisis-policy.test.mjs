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
assert.match(policy, /urgencia temporal, intervención RAG que no responde y exposición económica/)
assert.match(policy, /No use una sola de ellas como ranking absoluto/)
assert.match(policy, /unidades recuperadas, \$ protegidos\/recuperados, unidades perdidas y \$ perdidos/)
assert.match(policy, /Sólo compare períodos cuando/)
assert.match(policy, /NO calcule porcentajes/)
assert.match(policy, /No afirme estacionalidad/)

assert.match(source, /producto_costo_ultima_observacion/)
assert.match(source, /v_acciones_operativas_historial/)
assert.match(source, /PRIORIDADES NO EXCLUYENTES/)
assert.match(source, /Mayor exposición económica/)
assert.match(source, /Intervención RAG que no responde/)
assert.match(source, /Base comparable previa: NO/)
assert.match(source, /Ventana previa equivalente/)
assert.match(source, /Unidades recuperadas por venta/)
assert.match(source, /\$ protegidos\/recuperados a costo s\/IVA/)
assert.match(source, /Noven no tiene RAG registrado/)
assert.match(source, /no informa el estado de Glaciar/)
assert.match(source, /temperature: 0\.2/)
assert.doesNotMatch(source, /Comparativa terminal combinada/)
assert.doesNotMatch(source, /Glaciar no (?:tiene|posee|registra) RAG/i)

console.log('✓ Política gerencial y económica del análisis protegida')