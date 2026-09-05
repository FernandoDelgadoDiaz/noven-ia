// Contrato de la regla que decide si preguntar por la causa de una caída.
//
// Es una pregunta que se le hace a alguien parado en la góndola con el teléfono
// en una mano. Si aparece seguido, la va a descartar sin leerla y el dato va a
// ser peor que no tenerlo. Así que las guardas que la CALLAN importan más que
// la que la dispara, y cada una tiene acá su caso de disparo y su caso de
// silencio.
//
// Los números de los casos salen de producción, no de la imaginación: los 44
// tramos entre controles consecutivos con caída, medidos antes de escribir la
// regla.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const transpilar = (relativePath) =>
  ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText

const urlDe = (js) => `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`

// `salidaAnomala` importa `ventanaObservable` de `ragCobertura` — a propósito,
// para no tener la guarda de ventana mínima escrita dos veces. Un `data:` URL
// no resuelve rutas relativas, así que la dependencia se transpila primero y su
// especificador se reescribe. Cargar el módulo REAL, y no una copia de la
// guarda, es parte de lo que este contrato verifica.
const urlCobertura = urlDe(transpilar('src/lib/ragCobertura.ts'))
const jsSalida = transpilar('src/lib/salidaAnomala.ts').replace(
  /(['"])\.\/ragCobertura\1/g,
  JSON.stringify(urlCobertura),
)

const { evaluarSalidaAnomala, CAUSAS_NO_VENTA } = await import(urlDe(jsSalida))

// El caso base es DELIBERADAMENTE silencioso: 20 unidades en 2 días son 10 por
// día contra una necesaria de 2, o sea 5× — la mitad del umbral. Si el base
// disparara, la autoprueba del final no probaría nada.
const base = {
  cantidadPrevia: 100,
  cantidadActual: 80,
  bajada: 20,
  dias: 2,
  velocidadNecesaria: 2,
  umbral: 10,
  yaDeclarada: false,
}
const con = (extra) => evaluarSalidaAnomala({ ...base, ...extra })

// --- 1. El caso real que motivó todo esto -----------------------------------
//
// POSTRE DE MANI LA ANONIMA 3, cod_art 1710102. De 231 unidades a 69 en 3,822
// días: 162 unidades que no se vendieron, fueron transferidas. Velocidad
// observada 42,38 contra una necesaria de 2,227 ⇒ 19,0×.

const postreTransferencia = con({
  cantidadPrevia: 231,
  cantidadActual: 69,
  bajada: 162,
  dias: 3.822,
  velocidadNecesaria: 2.227,
})
assert.equal(postreTransferencia.preguntar, true,
  'la transferencia real del POSTRE DE MANI tiene que disparar la pregunta')
assert.equal(postreTransferencia.bajada, 162,
  'la caída se le muestra al operador: es la resta que no tuvo que hacer')
assert.ok(Math.abs(postreTransferencia.multiplo - 19.03) < 0.05)

// Y sus movimientos legítimos, del mismo producto y la misma ventana, NO
// disparan. Es la separación que justifica haber elegido la velocidad necesaria
// como referencia: 2,0× y 3,5× contra 19,0×.
assert.equal(con({ bajada: 4, dias: 0.889, velocidadNecesaria: 2.227 }).preguntar, false,
  '4 unidades en un día es venta normal bajo un RAG, no una anomalía')
assert.equal(con({ bajada: 9, dias: 1.163, velocidadNecesaria: 2.227 }).preguntar, false,
  '9 unidades en 1,16 días tampoco: 3,5× está lejos del umbral')

// --- 2. Sin control previo no se pregunta -----------------------------------
//
// Nada en el esquema garantiza que exista un control inicial: nueve de los
// treinta y siete vencimientos históricos no lo tienen. Sin referencia previa
// no hay velocidad, y no se inventa una.

assert.equal(con({ cantidadPrevia: null, dias: null }).motivo, 'sin_control_previo')
assert.equal(con({ cantidadPrevia: null, dias: null }).preguntar, false)

// --- 3. Sin caída no hay nada que explicar ----------------------------------

assert.equal(con({ bajada: 0 }).motivo, 'sin_caida')
assert.equal(con({ bajada: -5 }).motivo, 'sin_caida',
  'que el stock suba es otro problema y no se resuelve preguntando por salidas')

// --- 4. La ventana mínima observable, que hace el trabajo pesado ------------
//
// En producción descarta 33 de los 44 tramos con caída. Sin ella la pregunta
// saltaría en cada doble control y en ningún lugar útil.

// Dos controles con un minuto y medio de diferencia: 0,001 días y 77 unidades
// dan 117.987 unidades/día, que es 19.767× la necesaria. Es exactamente el tipo
// de caso que el umbral solo NO frena.
const dobleControl = con({ bajada: 77, dias: 0.001, velocidadNecesaria: 5.969 })
assert.equal(dobleControl.preguntar, false,
  'dos controles seguidos no son una anomalía por más que el múltiplo sea enorme')
assert.equal(dobleControl.motivo, 'ventana_no_observable')

// Y el caso que la guarda deja pasar: 20 unidades en 0,65 días con una
// necesaria de 0,25 da 122,6×, pero 0,65 × 0,25 = 0,16 < 1. La ventana no
// alcanza para que la velocidad signifique algo, aunque el múltiplo sea alto.
assert.equal(con({ bajada: 20, dias: 0.652, velocidadNecesaria: 0.25 }).motivo,
  'ventana_no_observable',
  'un múltiplo alto sobre una ventana corta no es evidencia')

// La misma guarda se adapta al ritmo: un SKU que necesita mover mucho por día
// alcanza la ventana observable enseguida.
assert.equal(con({ bajada: 60, dias: 0.5, velocidadNecesaria: 6 }).preguntar, true,
  'con necesaria alta, medio día ya es ventana observable')

// --- 5. El umbral ------------------------------------------------------------

assert.equal(con({ bajada: 40, dias: 2, velocidadNecesaria: 2 }).preguntar, true,
  '10× exacto dispara: el umbral es inclusivo')
assert.equal(con({ bajada: 39, dias: 2, velocidadNecesaria: 2 }).preguntar, false,
  'por debajo del umbral no se pregunta')
assert.equal(con({ bajada: 39, dias: 2, velocidadNecesaria: 2 }).motivo, 'velocidad_normal')

// El umbral viene de la organización, no del código. Con uno más exigente, el
// mismo caso deja de preguntar.
assert.equal(con({ bajada: 40, dias: 2, velocidadNecesaria: 2, umbral: 25 }).preguntar, false,
  'el umbral es política de cada organización y tiene que poder moverlo')

// Sin umbral o sin necesaria no se adivina.
assert.equal(con({ umbral: null }).motivo, 'datos_insuficientes')
assert.equal(con({ velocidadNecesaria: null }).motivo, 'datos_insuficientes')

// --- 6. Ya declarada --------------------------------------------------------
//
// Va última a propósito: el informe tiene que poder distinguir "no correspondía
// preguntar" de "correspondía y ya se respondió".

const declarada = con({ bajada: 40, dias: 2, velocidadNecesaria: 2, yaDeclarada: true })
assert.equal(declarada.preguntar, false)
assert.equal(declarada.motivo, 'ya_declarada')
assert.ok(declarada.multiplo >= 10,
  'una ya declarada conserva su múltiplo: se sabe que ameritaba la pregunta')

// Una que no ameritaba la pregunta no se reporta como ya_declarada aunque lo
// esté, porque el motivo real es otro.
assert.equal(con({ bajada: 1, dias: 2, velocidadNecesaria: 2, yaDeclarada: true }).motivo,
  'velocidad_normal')

// --- 7. Las causas que ve el operador ---------------------------------------

const valores = CAUSAS_NO_VENTA.map((c) => c.valor)
assert.deepEqual(valores,
  ['venta', 'transferencia', 'rotura', 'decomiso_parcial', 'no_declarado'],
  'las causas y su orden son parte del contrato con la operación')
assert.equal(valores[0], 'venta',
  'la respuesta más frecuente va primero: casi siempre la caída ES venta')
assert.equal(valores[valores.length - 1], 'no_declarado',
  '"No sé" va último y existe: si no se puede salir sin responder, se responde cualquier cosa')
assert.ok(CAUSAS_NO_VENTA.every((c) => c.etiqueta && !/unidades|cantidad|\d/.test(c.etiqueta)),
  'ninguna etiqueta le pide al operador un número: cuenta lo que hay, no calcula restas')

// --- 8. Autoprueba del detector ---------------------------------------------
//
// Si `evaluarSalidaAnomala` devolviera siempre false, todas las aserciones de
// silencio pasarían y el contrato no valdría nada.
assert.equal(con({}).preguntar, false, 'el caso base no dispara')
assert.equal(con({ bajada: 100, dias: 2, velocidadNecesaria: 2 }).preguntar, true,
  'y sin embargo la regla SÍ puede disparar: el contrato no pasa en vacío')

console.log('✓ La pregunta por salidas no-venta dispara sólo cuando corresponde')
