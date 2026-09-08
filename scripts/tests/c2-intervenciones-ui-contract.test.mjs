import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const modal = read('src/components/dashboard/EditarVencimientoModalSeguro.tsx')
const card = read('src/components/dashboard/AlertaItem.tsx')
const hook = read('src/hooks/useVencimientos.ts')

for (const rpc of [
  'informar_oferta_central',
  'finalizar_oferta_central',
  'finalizar_rag_vigente',
]) {
  assert.match(modal, new RegExp(`supabase\\.rpc\\('${rpc}'`), `${rpc} debe tener caller explicito`)
}
assert.doesNotMatch(
  modal,
  /FINALIZAR_RAG\|/,
  'la UI nueva no puede esconder una operacion dentro de una nota libre',
)

for (const texto of [
  'Informar oferta central',
  'Finalizar oferta central',
  'Sólo se cerrará la oferta central. El RAG seguirá vigente si está activo.',
  'Registrá primero el control para que la oferta comience con ese stock conocido.',
]) {
  assert.ok(modal.includes(texto), `falta el contrato visible: ${texto}`)
}

assert.match(
  modal,
  /\.select\('dias_donacion,[^']*hay_oferta_central, intervenciones_abiertas, medicion_atribuible'\)/,
  'el modal debe leer convivencia desde la vista server-side',
)
assert.match(
  modal,
  /intervenciones_abiertas > 1[\s\S]{0,300}?salida observada es combinada y no se atribuye/,
  'cuando conviven dos intervenciones la UI no puede fingir atribucion individual',
)

assert.match(hook, /\.select\('vencimiento_id, tipo, porcentaje_descuento, nota,/)
assert.match(hook, /row\.tipo === 'rag'/)
assert.match(hook, /row\.tipo === 'oferta_central'/)
assert.doesNotMatch(
  hook,
  /if \(estadoPorVencimiento\.has\(row\.vencimiento_id\)\) continue/,
  'tomar sólo la intervención más reciente vuelve a ocultar la convivencia',
)

assert.match(card, /const tieneOfertaCentralizada = vencimiento\.oferta_centralizada === true/)
assert.doesNotMatch(
  card,
  /const tieneOfertaCentralizada = !tieneRagActivo/,
  'una oferta central no desaparece porque también haya RAG',
)
for (const estado of ['RAG activo', 'Oferta central activa', 'Transferencia informada']) {
  assert.ok(card.includes(estado), `la tarjeta debe mostrar ${estado}`)
}
assert.ok(card.includes('Ver {accionesRestantes} más'), 'un contador aislado no explica qué quedó oculto')

assert.match(modal, /supabase\.rpc\(\s*'contexto_salida_control'/)
assert.match(modal, /evaluarSalidaAnomala/)
assert.match(modal, /supabase\.rpc\('declarar_salida_no_venta'/)
assert.match(hook, /ultima\?\.no_venta_respuesta === 'transferencia'/)

console.log('✓ C2 conserva las pantallas, muestra convivencia y separa transferencia de venta')
