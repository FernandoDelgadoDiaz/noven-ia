// CONTRATO: la oferta central se mide como cualquier otro tramo.
//
// EL HUECO, tal como se vio usando la app. La oferta central se registraba y no
// se evaluaba: la tarjeta decía «Oferta central activa» y nada más, sin
// cobertura ni velocidad ni estado.
//
// EL CÁLCULO SIEMPRE ESTUVO. `v_seguimiento_rag_actual` mide el PRIMER TRAMO
// ABIERTO sin filtrar por tipo —la decisión del bloque B— y el producto que lo
// destapó ya tenía todo computado. Lo que faltaba era mostrarlo: tres lugares
// de la interfaz usaban `rag_porcentaje != null` como si fuera «¿hay algo que
// medir?», y eso lo dice el tramo, no el porcentaje.
//
// POR QUÉ IMPORTA, Y NO ES SÓLO LA MALA NOTICIA. El caso real iba a 2,47 veces
// la velocidad que necesitaba: la oferta estaba funcionando muy bien y tampoco
// se mostraba. Sin esa medición alguien puede ponerle un RAG encima a un
// producto que se vende solo, y regalar margen sin motivo. ESCONDER «FUNCIONA»
// CUESTA TANTO COMO ESCONDER «NO FUNCIONA».
//
// Las cuatro propiedades, en orden de lo que costaría perderlas:
//
//   1. La noción «hay algo que medir» se declara UNA vez y la leen los tres.
//   2. Ningún lugar vuelve a usar `rag_porcentaje` como esa compuerta.
//   3. Las etiquetas dependen del TIPO de tramo: decir «RAG efectivo» sobre un
//      producto sin RAG sería pasar de no informar a informar mal, que es peor
//      que el hueco original.
//   4. «Todavía no hay nada medido» y «no hay intervención» no se ven igual.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ESTE CONTRATO EJERCITA LAS FUNCIONES REALES, no una copia de su texto: lo
// que tiene que cazar es que `etiquetaEstadoTramo` DEVUELVA «RAG efectivo»
// sobre una oferta central, y eso sólo se ve ejecutándola.
//
// Importar un `.ts` desde la suite depende del type-stripping de Node, que está
// activo por defecto desde 22.18. Es el primer contrato que lo hace, así que el
// requisito se comprueba acá: sin esto el fallo sería un `SyntaxError` en el
// import, antes de que corra una sola línea, y nadie sabría por qué.
const [mayor, menor] = process.versions.node.split('.').map(Number)
assert.ok(
  mayor > 22 || (mayor === 22 && menor >= 18),
  `este contrato importa TypeScript y necesita Node >= 22.18 (hay ${process.versions.node}). `
    + 'El workflow usa `node-version: 22`, que resuelve a la última 22.x.',
)

const {
  etiquetaEstadoTramo,
  hayTramoAbierto,
  salidaOfertaCentral,
  tipoTramo,
} = await import('../../src/lib/intervencion-medible.ts')

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../..')
const leer = (ruta) => fs.readFileSync(path.join(RAIZ, ruta), 'utf8')

const modulo = leer('src/lib/intervencion-medible.ts')
const badge = leer('src/components/dashboard/RagSeguimientoBadge.tsx')
const alerta = leer('src/components/dashboard/AlertaItem.tsx')
const modal = leer('src/components/dashboard/EditarVencimientoModalSeguro.tsx')

// --- 1. El cálculo del servidor no filtra por tipo ---------------------------
//
// Es la premisa de todo lo demás. Si alguien le agrega `tipo = 'rag'` al tramo,
// la oferta central deja de medirse y ninguna comprobación de interfaz lo
// notaría: se verían celdas vacías, no un error.

const vista = leer('supabase/migrations/20260906230000_convivencia_rag_oferta_central_v1.sql')
const tramoLateral = vista.match(
  /SELECT t\.intervencion_id, t\.inicio, t\.cantidad_al_iniciar[\s\S]*?\) tramo ON true/,
)?.[0] ?? ''
assert.ok(tramoLateral, 'no se encontró el LATERAL que elige el tramo medido')
assert.doesNotMatch(
  tramoLateral,
  /t\.tipo\s*=/,
  'el tramo que se mide no puede filtrar por tipo: una oferta central es tan medible como un RAG',
)

// --- 2. La noción se declara una vez ----------------------------------------

assert.equal(hayTramoAbierto({ ragPorcentaje: 30, hayOfertaCentral: false }), true)
assert.equal(hayTramoAbierto({ ragPorcentaje: null, hayOfertaCentral: true }), true,
  'una oferta central sin RAG es una intervención medible')
assert.equal(hayTramoAbierto({ ragPorcentaje: null, hayOfertaCentral: false }), false)
// Un RAG en 0 no es un RAG: era el criterio original y se conserva.
assert.equal(hayTramoAbierto({ ragPorcentaje: 0, hayOfertaCentral: false }), false)

assert.equal(tipoTramo({ ragPorcentaje: 30, hayOfertaCentral: true }), 'ambos')
assert.equal(tipoTramo({ ragPorcentaje: 30, hayOfertaCentral: false }), 'rag')
assert.equal(tipoTramo({ ragPorcentaje: null, hayOfertaCentral: true }), 'oferta_central')
assert.equal(tipoTramo({ ragPorcentaje: null, hayOfertaCentral: false }), null)

// --- 3. Ningún lugar usa `rag_porcentaje` como compuerta --------------------
//
// Es la regresión exacta que este cambio corrige, y la más fácil de reintroducir
// sin querer: `rag_porcentaje` está a mano en las tres pantallas.

export function revisarCompuerta(fuente, nombre) {
  assert.doesNotMatch(
    fuente,
    /activo=\{tieneRagActivo\}/,
    `${nombre}: la medición se muestra por tramo abierto, no por «tiene RAG»`,
  )
}

revisarCompuerta(alerta, 'AlertaItem')
assert.match(
  alerta,
  /hayIntervencion=\{hayTramoAbierto\(\{/,
  'AlertaItem tiene que decidir con la noción compartida',
)
assert.match(
  badge,
  /hayIntervencion: boolean/,
  'el prop del badge nombra lo que significa: hay un tramo abierto, de cualquier tipo',
)
// Antes ni siquiera consultaba cuando no había RAG: el número existía y nadie
// lo pedía.
assert.match(
  badge,
  /if \(!hayIntervencion\) \{\s*\n\s*setRow\(null\)/,
  'el badge consulta siempre que haya un tramo abierto',
)
assert.match(
  badge,
  /hay_oferta_central'\)/,
  'el badge necesita el tipo para nombrar la intervención, y viene en la fila',
)

// --- 4. Las etiquetas dependen del tipo --------------------------------------

/**
 * Toma la función como parámetro para que el mutante de abajo ejercite ESTE
 * mismo camino con una implementación rota, y no una comprobación paralela.
 */
export function revisarEtiquetas(etiqueta) {
  assert.equal(etiqueta('efectivo', 'rag'), 'RAG efectivo')
  assert.equal(etiqueta('insuficiente', 'rag'), 'RAG insuficiente')
  assert.equal(etiqueta('efectivo', 'oferta_central'), 'Oferta central efectiva')
  assert.equal(etiqueta('insuficiente', 'oferta_central'), 'Oferta central insuficiente')
  // Con las dos abiertas la medición es combinada: atribuirla a una sería
  // afirmar de más, y la vista ya marca `medicion_atribuible = false`.
  assert.equal(etiqueta('efectivo', 'ambos'), 'Intervención efectivo')
  // Y el caso que motivó esta mitad del cambio.
  assert.doesNotMatch(
    etiqueta('efectivo', 'oferta_central'),
    /RAG/,
    'decir «RAG efectivo» sobre un producto sin RAG es peor que no decir nada',
  )
}

revisarEtiquetas(etiquetaEstadoTramo)

// El mapa viejo, que decía «RAG» en todos los casos, ya no existe.
assert.doesNotMatch(
  modal,
  /RAG_ESTADO_LABEL/,
  'las etiquetas viven en un solo lugar y dependen del tipo',
)
assert.match(
  modal,
  /etiquetaEstadoTramo\(/,
  'el modal usa las etiquetas compartidas',
)

// --- 5. La medición de la oferta central va en SU tarjeta -------------------
//
// No destapando la del RAG: cada tarjeta habla de su propia intervención.

const tarjetaOferta = modal.slice(modal.indexOf('Oferta central'))
for (const [fragmento, porque] of [
  ['Vel. observada', 'la velocidad observada'],
  ['Vel. necesaria', 'la velocidad necesaria'],
  ['Cobertura', 'la cobertura'],
  ['salidaOfertaCentral', 'la salida binaria'],
]) {
  assert.ok(
    tarjetaOferta.includes(fragmento),
    `${porque} tiene que estar en la tarjeta de oferta central`,
  )
}
// La cobertura sale de la vista: `evaluarSugerencia` corta a propósito sin
// porcentaje de RAG, así que pedirle ese número sería preguntar mal.
assert.match(
  modal,
  /estado_seguimiento_rag, cobertura, hay_oferta_central/,
  'la cobertura se lee del servidor y no se recalcula en el cliente',
)

// --- 6. Salida binaria, y el estado sin evidencia tiene voz ------------------

export function revisarSalida() {
  assert.match(salidaOfertaCentral('efectivo'), /no hace falta agregar RAG/)
  assert.match(salidaOfertaCentral('insuficiente'), /evaluá agregar RAG encima/)
  assert.match(salidaOfertaCentral('sin_movimiento'), /evaluá agregar RAG encima/)
  // Tramo abierto sin control posterior es un estado LEGÍTIMO: la pantalla
  // tiene que nombrarlo, no mostrar celdas vacías. Es la misma regla de
  // siempre — «no hay nada medido todavía» y «no hay intervención» no pueden
  // verse igual.
  assert.match(salidaOfertaCentral('pendiente_control_operador'), /registrá uno para poder medirla/)
  assert.match(salidaOfertaCentral('ventana_insuficiente'), /Lleva muy poco tiempo/)
  // Con oferta central NO se sugieren escalones: el porcentaje no lo maneja la
  // sucursal.
  for (const estado of ['efectivo', 'insuficiente', 'sin_movimiento', 'pendiente_control_operador']) {
    assert.doesNotMatch(
      salidaOfertaCentral(estado),
      /\d+\s*%|escal[óo]n/i,
      `la salida de la oferta central es binaria: «${estado}» no puede proponer un porcentaje`,
    )
  }
}

revisarSalida()

// --- Mutantes, en las dos direcciones ---------------------------------------

assert.throws(
  () => revisarCompuerta('<RagSeguimientoBadge vencimientoId={v.id} activo={tieneRagActivo} />', 'mutante'),
  /no por «tiene RAG»/,
  'volver a compuertar por `rag_porcentaje` tiene que hacer fallar el contrato',
)

// El mapa viejo: una etiqueta por estado, ciega al tipo. Es exactamente lo que
// había antes de este cambio, y lo que haría decir «RAG efectivo» sin RAG.
const ETIQUETA_CIEGA_AL_TIPO = (estado) => ({
  efectivo: 'RAG efectivo',
  insuficiente: 'RAG insuficiente',
}[estado] ?? estado)

assert.throws(
  () => revisarEtiquetas(ETIQUETA_CIEGA_AL_TIPO),
  /decir «RAG efectivo» sobre un producto sin RAG|Oferta central efectiva/,
  'una etiqueta ciega al tipo tiene que hacer fallar el contrato',
)

// Y en la otra dirección: una que nombre SIEMPRE la oferta central tampoco
// sirve, porque el RAG dejaría de nombrarse.
assert.throws(
  () => revisarEtiquetas(() => 'Oferta central efectiva'),
  /RAG efectivo/,
  'nombrar todo como oferta central rompe el caso del RAG y también tiene que fallar',
)

console.log('oferta central medible: OK')
