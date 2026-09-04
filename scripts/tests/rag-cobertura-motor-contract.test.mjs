// Contrato del motor de reacción inmediata para RAG (Capa A).
//
// El motor decide si sugerir un escalamiento del descuento y de qué tamaño.
// Es la clase de lógica donde un error no se ve: nadie nota que la sugerencia
// llegó un día antes de tiempo, o que escaló de más, hasta que la operación
// deja de creerle. Por eso cada regla tiene su caso, y las guardas tienen el
// caso que las hace disparar Y el que las hace callar.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

async function importarTs(relativePath) {
  const js = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
}

const {
  calcularCobertura,
  escalonesPorCobertura,
  ventanaObservable,
  subirEscalones,
  evaluarSugerencia,
  coberturaComoPorcentaje,
} = await importarTs('src/lib/ragCobertura.ts')

/** La escala de La Anónima: 10..70 de a diez. */
const ESCALA = [10, 20, 30, 40, 50, 60, 70].map((porcentaje, i) => ({ escalon: i + 1, porcentaje }))

// --- 1. Cobertura -----------------------------------------------------------

assert.equal(calcularCobertura(1, 2), 0.5, 'cobertura es observada / necesaria')
assert.equal(calcularCobertura(3, 3), 1)
assert.equal(calcularCobertura(0, 2), 0, 'sin salida la cobertura es 0, no null')

// Una necesaria de 0 o negativa significa que ya no hay ventana comercial. Ahí
// la cobertura no está definida: devolver Infinity haría que un producto fuera
// de ventana pareciera perfectamente cubierto.
assert.equal(calcularCobertura(5, 0), null, 'sin ventana, la cobertura no está definida')
assert.equal(calcularCobertura(5, -1), null)
assert.equal(calcularCobertura(null, 2), null)
assert.equal(calcularCobertura(2, null), null)

// --- 2. Escalones por cobertura ---------------------------------------------

assert.equal(escalonesPorCobertura(1, 5), 0, 'cobertura 1 es exactamente el ritmo requerido')
assert.equal(escalonesPorCobertura(1.4, 5), 0, 'por encima del ritmo no se sugiere nada')
assert.equal(escalonesPorCobertura(0.99, 5), 1)
assert.equal(escalonesPorCobertura(0.5, 5), 1, '0,5 exacto pertenece al tramo de un escalón')
assert.equal(escalonesPorCobertura(0.49, 5), 2)
assert.equal(escalonesPorCobertura(0.1, 5), 2)

// Sin movimiento sube dos, como el déficit severo, pero por su propio camino:
// no depende de la cobertura, que con observada 0 vale 0 igual.
assert.equal(escalonesPorCobertura(0, 0), 2, 'sin movimiento sube dos escalones')
assert.equal(escalonesPorCobertura(null, 0), 2,
  'sin movimiento no necesita cobertura para decidir')
assert.equal(escalonesPorCobertura(null, 5), 0,
  'sin cobertura y con movimiento no se puede decidir: no se sugiere')

// --- 3. Ventana mínima observable -------------------------------------------
//
// El umbral se adapta al ritmo del producto en vez de fijar días iguales para
// todos: un SKU lento espera, uno rápido no.

assert.equal(ventanaObservable(1, 0.3), false,
  'necesita 0,3/día y pasó un día: no se distingue "no se vende" de granularidad')
assert.equal(ventanaObservable(4, 0.3), true, '4 días × 0,3 = 1,2: ya es observable')
assert.equal(ventanaObservable(1, 1), true, '1 día × 1/día = 1: en el límite, observable')
assert.equal(ventanaObservable(0.5, 4), true, 'medio día de un SKU rápido ya es observable')
assert.equal(ventanaObservable(null, 1), false)
assert.equal(ventanaObservable(3, null), false)

// --- 4. Subir escalones dentro de la escala ---------------------------------

assert.equal(subirEscalones(ESCALA, 20, 1), 30)
assert.equal(subirEscalones(ESCALA, 20, 2), 40)
assert.equal(subirEscalones(ESCALA, 60, 2), 70, 'el salto se recorta contra el tope')
assert.equal(subirEscalones(ESCALA, 70, 1), null, 'en el tope no hay a dónde subir')
assert.equal(subirEscalones(ESCALA, 80, 1), null, 'por encima del tope tampoco')

// Un porcentaje cargado a mano fuera de la escala se ancla en el peldaño más
// alto que no lo supere. Nunca se devuelve un valor fuera de la escala.
assert.equal(subirEscalones(ESCALA, 25, 1), 30, '25 se ancla en 20 y sube a 30')
assert.equal(subirEscalones(ESCALA, 25, 2), 40)
assert.equal(subirEscalones(ESCALA, 5, 1), 10, 'por debajo del primer peldaño sube al primero')

// Sin escala configurada no hay porcentaje posible.
assert.equal(subirEscalones([], 20, 1), null)

// Una escala distinta produce saltos distintos: la escala es política de la
// organización, no del producto.
const ESCALA_OTRA = [15, 35, 55].map((porcentaje, i) => ({ escalon: i + 1, porcentaje }))
assert.equal(subirEscalones(ESCALA_OTRA, 15, 1), 35,
  'con otra escala, subir un escalón da otro porcentaje')
assert.equal(subirEscalones(ESCALA_OTRA, 15, 2), 55)

// --- 5. Guardas: el caso que dispara y el que calla -------------------------

/** Un caso base que SÍ produce sugerencia, para mutar desde ahí. */
const BASE = {
  estado: 'insuficiente',
  velocidadObservada: 1,
  velocidadNecesaria: 4,      // cobertura 0,25 → dos escalones
  diasComercialesRestantes: 10,
  diasObservados: 3,          // 3 × 4 = 12 ≥ 1
  diasDesdeUltimoRag: 3,
  ragPorcentaje: 20,
}

const base = evaluarSugerencia(BASE, ESCALA)
assert.equal(base.hay, true, 'el caso base debe producir sugerencia')
assert.equal(base.escalones, 2)
assert.equal(base.desde, 20)
assert.equal(base.hasta, 40, 'dos escalones desde 20 llegan a 40')
assert.equal(base.cobertura, 0.25)
assert.equal(base.sinMovimiento, false)
assert.equal(base.factorRequerido, 4, 'hace falta cuadruplicar la salida actual')
assert.equal(base.topeInsuficiente, false)

const con = (cambios) => evaluarSugerencia({ ...BASE, ...cambios }, ESCALA)

const CASOS_SIN_SUGERENCIA = [
  ['RAG efectivo', { estado: 'efectivo' }, 'rag_efectivo'],
  ['efectivo por VMD', { estado: 'efectivo_por_vmd' }, 'rag_efectivo'],
  ['ventana de donación', { estado: 'donacion' }, 'ventana_cerrada'],
  ['vencido', { estado: 'decomiso' }, 'ventana_cerrada'],
  ['sin días comerciales', { diasComercialesRestantes: 0 }, 'ventana_cerrada'],
  ['sin RAG vigente', { estado: 'sin_rag', ragPorcentaje: null }, 'sin_rag'],
  ['pendiente de control', { estado: 'pendiente_control_operador' }, 'sin_observacion_posterior'],
  ['dato a revisar', { estado: 'dato_a_revisar' }, 'sin_observacion_posterior'],
  ['ya en el tope', { ragPorcentaje: 70 }, 'tope_de_escala'],
  ['cobertura suficiente', { velocidadObservada: 4 }, 'rag_efectivo'],
]

for (const [nombre, cambios, motivo] of CASOS_SIN_SUGERENCIA) {
  const r = con(cambios)
  assert.equal(r.hay, false, `no debe sugerir: ${nombre}`)
  assert.equal(r.motivo, motivo, `motivo esperado para ${nombre}`)
}

// Guarda 2 · ventana mínima observable.
// Un SKU lento con un día de observación espera; el mismo día alcanza si el
// producto es rápido.
// El SKU lento: necesita 0,3/día y está saliendo a 0,1/día (cobertura 0,33).
const lento = { velocidadNecesaria: 0.3, velocidadObservada: 0.1 }
assert.equal(con({ ...lento, diasObservados: 1, diasDesdeUltimoRag: 1 }).motivo, 'ventana_no_observable',
  'un día de un SKU que necesita 0,3/día no distingue "no se vende" de granularidad')
const lentoObservable = con({ ...lento, diasObservados: 4, diasDesdeUltimoRag: 4 })
assert.equal(lentoObservable.hay, true, 'con cuatro días el mismo SKU lento ya es observable')
assert.equal(lentoObservable.escalones, 2, 'cobertura 0,33 → dos escalones')

// El mismo día que era insuficiente para el lento alcanza para uno rápido: la
// guarda se adapta al ritmo del producto, no fija días iguales para todos.
assert.equal(con({ velocidadNecesaria: 4, velocidadObservada: 1, diasObservados: 1, diasDesdeUltimoRag: 1 }).hay, true,
  'un día de un SKU que necesita 4/día ya es observable')

// Guarda 3 · enfriamiento. Se cuenta desde el último cambio de RAG, no desde la
// última observación: si no, se sugiere 30 el lunes y 40 el martes sin haberle
// dado chance al 30.
const recienCambiado = con({ diasDesdeUltimoRag: 0.1 })
assert.equal(recienCambiado.hay, false, 'un RAG recién cambiado no se vuelve a escalar')
assert.equal(recienCambiado.motivo, 'enfriamiento')

// Y la guarda es independiente de la observación: se puede tener una
// observación vieja y suficiente con un RAG cambiado hace un rato.
assert.equal(con({ diasObservados: 10, diasDesdeUltimoRag: 0.1 }).motivo, 'enfriamiento',
  'el enfriamiento no se satisface con una observación previa al cambio de RAG')

// Sin escala configurada no se inventa un porcentaje. RISK_AND_RAG_RULES §7.
const sinEscala = evaluarSugerencia(BASE, [])
assert.equal(sinEscala.hay, false)
assert.equal(sinEscala.motivo, 'sin_escala')

// --- 6. Sin movimiento se marca aparte --------------------------------------

const quieto = con({ estado: 'sin_movimiento', velocidadObservada: 0 })
assert.equal(quieto.hay, true)
assert.equal(quieto.sinMovimiento, true, 'sin movimiento se marca: no es "poco", es nada')
assert.equal(quieto.escalones, 2)
assert.equal(quieto.hasta, 40)
assert.equal(quieto.factorRequerido, null,
  'con salida cero no hay factor por el cual multiplicar: no se muestra un número inventado')

// --- 7. El límite se muestra, no se disimula --------------------------------
//
// Cuando el salto llega al tope y la cobertura sigue por debajo de 1, el
// descuento máximo autorizado puede no alcanzar. Decirlo es honesto; inventar
// un salto mayor no lo sería.

const enElTope = con({ ragPorcentaje: 60, velocidadObservada: 1, velocidadNecesaria: 4 })
assert.equal(enElTope.hasta, 70, 'el salto se recorta al tope de la escala')
assert.equal(enElTope.topeInsuficiente, true,
  'en el tope y con cobertura < 1, hay que avisar que puede no alcanzar')
assert.equal(enElTope.factorRequerido, 4)

// En cambio, llegar al tope con la cobertura ya casi cubierta no amerita alarma.
const topeSuficiente = con({ ragPorcentaje: 60, velocidadObservada: 3.9, velocidadNecesaria: 4 })
assert.equal(topeSuficiente.hasta, 70)
assert.equal(topeSuficiente.topeInsuficiente, true,
  'sigue por debajo de 1: el aviso corresponde')

// --- 8. El tiempo entra por la cobertura, sin regla de urgencia aparte ------
//
// Mismo stock y misma salida; sólo se achica la ventana. La necesaria sube, la
// cobertura cae y la sugerencia escala sola.

const ventanaAmplia = evaluarSugerencia({
  ...BASE, velocidadNecesaria: 1.2, velocidadObservada: 1, diasComercialesRestantes: 10,
}, ESCALA)
const ventanaCorta = evaluarSugerencia({
  ...BASE, velocidadNecesaria: 6, velocidadObservada: 1, diasComercialesRestantes: 2,
}, ESCALA)

assert.equal(ventanaAmplia.escalones, 1, 'cobertura 0,83 → un escalón')
assert.equal(ventanaCorta.escalones, 2, 'la misma salida con la ventana achicada → dos escalones')
assert.ok(ventanaCorta.cobertura < ventanaAmplia.cobertura,
  'al achicarse la ventana la cobertura cae sin ninguna regla de urgencia adicional')

// --- 9. Nunca un porcentaje fuera de la escala ------------------------------

const porcentajesValidos = new Set(ESCALA.map((e) => e.porcentaje))
for (const porcentaje of [5, 10, 12, 20, 25, 30, 44, 50, 60, 65, 70, 90]) {
  for (const escalones of [1, 2]) {
    const destino = subirEscalones(ESCALA, porcentaje, escalones)
    if (destino == null) continue
    assert.ok(porcentajesValidos.has(destino),
      `subirEscalones devolvió ${destino}, que no está en la escala`)
    assert.ok(destino > porcentaje, 'un escalamiento nunca puede bajar el descuento')
  }
}

// --- 10. Presentación -------------------------------------------------------

assert.equal(coberturaComoPorcentaje(0.25), '25%')
assert.equal(coberturaComoPorcentaje(1), '100%')
assert.equal(coberturaComoPorcentaje(null), '—', 'la ausencia se muestra como ausencia, no como 0%')

// --- 11. Determinismo y pureza ----------------------------------------------
//
// Sin reloj propio, sin red, sin LLM. Dos llamadas con la misma entrada dan
// exactamente lo mismo, y la entrada no se muta.

const entradaCongelada = Object.freeze({ ...BASE })
const a = evaluarSugerencia(entradaCongelada, ESCALA)
const b = evaluarSugerencia(entradaCongelada, ESCALA)
assert.deepEqual(a, b, 'el motor es determinístico')

const escalaOriginal = JSON.stringify(ESCALA)
evaluarSugerencia(BASE, ESCALA)
assert.equal(JSON.stringify(ESCALA), escalaOriginal, 'no muta la escala recibida')

const fuente = read('src/lib/ragCobertura.ts')
for (const prohibido of [/\bfetch\s*\(/, /Date\.now/, /new Date\b/, /Math\.random/, /supabase/i]) {
  assert.doesNotMatch(fuente, prohibido,
    'el motor es puro: sin red, sin reloj propio, sin azar y sin acceso a datos')
}

console.log('✓ Cobertura, escalones y las tres guardas, con su caso que dispara y su caso que calla')
console.log('✓ Nunca sugiere un porcentaje fuera de la escala; la escala es de la organización')
