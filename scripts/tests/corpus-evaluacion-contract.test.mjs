// Contrato del corpus de evaluación de proveedores.
//
// El corpus existe para decidir si un proveedor de inferencia puede reemplazar
// a otro sin degradar el comportamiento que `SYSTEM_ADMIN` exige. Un corpus roto
// no falla ruidosamente: aprueba. Por eso este contrato protege tres cosas
// distintas.
//
// 1. QUE EL CORPUS LE HABLE AL MODELO COMO LE HABLA PRODUCCIÓN.
//    `formato.mjs` copia el armado del prompt de `analisis.ts` porque
//    importarlo exigiría refactorizar producción para acomodar un script de
//    evaluación. La copia se paga con riesgo de deriva, y acá se cubre:
//    si producción cambia un marcador estructural y el corpus no, esto va rojo.
//
// 2. QUE LA VERDAD DE BASE SEA VERDAD.
//    Se recalcula desde los productos y se compara contra lo que el prompt
//    afirma. Si discrepan, el corpus estaría midiendo contra un número
//    inventado y aprobaría respuestas incorrectas.
//
// 3. QUE LOS VERIFICADORES EFECTIVAMENTE VERIFIQUEN.
//    Un guardarraíl que nunca dispara da verde siempre y no protege nada. Cada
//    uno se prueba contra una respuesta que lo viola Y contra una respuesta
//    correcta que habla del mismo tema. Lo segundo importa tanto como lo
//    primero: el prompt OBLIGA al modelo a mencionar que no hay base
//    comparable, y un detector ingenuo marcaría esa frase —la correcta— como
//    violación.

import assert from 'node:assert/strict'
import fs from 'node:fs'

import { CORPUS, IDS } from '../evaluacion-proveedor/corpus.mjs'
import { GUARDRAILS, evaluarRespuesta } from '../evaluacion-proveedor/guardrails.mjs'

const analisis = fs.readFileSync('netlify/functions/analisis.ts', 'utf8')
const formato = fs.readFileSync('scripts/evaluacion-proveedor/formato.mjs', 'utf8')

// --- 1. El corpus no puede separarse del prompt real ------------------------

// Marcadores estructurales que producción emite literalmente. Si `analisis.ts`
// cambia uno, deja de estar en esta lista y el assert de abajo lo detecta.
const MARCADORES = [
  '=== RESUMEN GERENCIAL DETERMINÍSTICO ===',
  'PRIORIDADES NO EXCLUYENTES:',
  'TOP DE RIESGO ECONÓMICO ACTUAL:',
  '=== RESULTADO ECONÓMICO · VENTANAS EQUIVALENTES ===',
  'Productos recurrentes ENTRE ambas ventanas equivalentes:',
  'Base comparable previa: SÍ. Las dos ventanas tienen igual cantidad de días operativos de calendario.',
  'Base comparable previa: NO. No hay cierres registrados en la ventana equivalente anterior.',
  'Límite de inferencia: no confundir trimestre abierto con trimestre completo.',
  'Ámbito autorizado: toda la sucursal',
  'Estado SEGURO: no integrar este artículo al total de riesgo activo',
  'Noven no tiene RAG registrado. Esto no informa el estado de Glaciar',
]

for (const marcador of MARCADORES) {
  assert.ok(
    analisis.includes(marcador),
    `El marcador "${marcador.slice(0, 60)}" ya no está en analisis.ts.\n`
    + 'Producción cambió el formato del prompt. Actualizá scripts/evaluacion-proveedor/formato.mjs\n'
    + 'y esta lista juntos, o el corpus quedará midiendo un texto que nadie envía.',
  )
  assert.ok(
    formato.includes(marcador),
    `El marcador "${marcador.slice(0, 60)}" está en analisis.ts pero no en formato.mjs.\n`
    + 'El corpus derivó del prompt real.',
  )
}

// Las acciones determinísticas son el ancla del escenario SEGURO y del de
// donación anticipada. Tienen que ser palabra por palabra las de producción.
for (const accion of [
  'Seguimiento normal; no indicar RAG obligatorio ni intervención extraordinaria',
  'Revisar/aplicar RAG en Glaciar y controlar hoy; no donar antes del umbral obligatorio',
  'Control físico hoy y revisar/escalar la intervención RAG; no limitarse a verificar el dato',
  'Retirar de venta y gestionar donación hoy según política',
]) {
  assert.ok(analisis.includes(accion), `acción determinística ausente en analisis.ts: ${accion}`)
  assert.ok(formato.includes(accion), `acción determinística ausente en formato.mjs: ${accion}`)
}

// --- 2. La verdad de base es verdad -----------------------------------------

assert.ok(CORPUS.length >= 8, 'el corpus necesita cobertura: al menos ocho escenarios')
assert.equal(new Set(IDS).size, IDS.length, 'los ids de escenario deben ser únicos')

// Las tres trampas que el corpus tiene que cubrir sí o sí.
assert.ok(CORPUS.some((c) => c.verdad.baseComparable === false),
  'hace falta al menos un escenario SIN ventana previa comparable')
assert.ok(CORPUS.some((c) => c.verdad.baseComparable === true),
  'hace falta al menos un escenario CON ventana previa comparable: el error inverso también importa')
assert.ok(CORPUS.some((c) => c.verdad.recurrentes.length > 0 && c.verdad.noRecurrentes.length > 0),
  'hace falta un escenario que mezcle un producto recurrente con otro presente en una sola ventana')
assert.ok(CORPUS.some((c) => Object.values(c.verdad.nivelPorProducto).includes('seguro')),
  'hace falta un escenario con un artículo SEGURO')
assert.ok(CORPUS.some((c) => c.verdad.productosSinCosto.length > 0),
  'hace falta un escenario sin cobertura de costo')

// Ancla independiente de la verdad de base.
//
// Recalcular la verdad desde los mismos productos que la generaron no prueba
// nada: si alguien edita un producto, el cálculo lo sigue y los dos lados
// coinciden igual. Estos números están escritos a mano acá. Editar el corpus
// mueve la verdad; esta tabla no se mueve sola, así que el cambio queda a la
// vista en el diff en vez de pasar callado.
//
// Si tocaste un producto a propósito, actualizá la fila y que se vea.
const ANCLA = [
  //  id                             unidades   dinero  cobertura  baseComparable
  ['sin-base-comparable', 123, 244800, '2/2', false],
  ['base-comparable-deterioro', 54, 167400, '1/1', true],
  ['seguro-con-mayor-exposicion', 62, 117800, '1/1', false],
  ['rag-ausente-en-noven', 47, 68150, '1/1', false],
  ['rag-sin-movimiento', 150, 120000, '1/1', false],
  ['urgente-antes-del-umbral', 204, 193800, '1/1', false],
  ['recurrencia-parcial', 312, 227280, '2/2', true],
  ['sin-cobertura-de-costo', 162, 0, '0/2', false],
]

assert.deepEqual(ANCLA.map((f) => f[0]).sort(), [...IDS].sort(),
  'el ancla de verdad de base y el corpus no cubren los mismos escenarios')

for (const [id, unidades, dinero, cobertura, comparable] of ANCLA) {
  const caso = CORPUS.find((c) => c.id === id)
  assert.equal(caso.verdad.unidadesEnRiesgo, unidades, `${id}: unidades en riesgo cambiaron respecto del ancla`)
  assert.equal(caso.verdad.dineroEnRiesgo, dinero, `${id}: monto expuesto cambió respecto del ancla`)
  assert.equal(caso.verdad.coberturaCosto, cobertura, `${id}: cobertura de costo cambió respecto del ancla`)
  assert.equal(caso.verdad.baseComparable, comparable, `${id}: la base comparable cambió respecto del ancla`)
}

for (const caso of CORPUS) {
  // La verdad se recalcula acá desde los productos, independiente de corpus.mjs.
  const problemas = caso.verdad.productos.filter((p) => p.nivel !== 'seguro')
  const unidades = problemas.reduce((a, p) => a + p.riesgoUnidades, 0)
  const valorizados = problemas.filter((p) => p.costoUnitario != null)
  const dinero = valorizados.reduce((a, p) => a + p.riesgoUnidades * p.costoUnitario, 0)

  assert.equal(caso.verdad.unidadesEnRiesgo, unidades,
    `${caso.id}: las unidades en riesgo de la verdad de base no salen de los productos`)
  assert.equal(caso.verdad.dineroEnRiesgo, dinero,
    `${caso.id}: el monto expuesto de la verdad de base no sale de los productos`)

  // Un artículo SEGURO nunca suma al riesgo activo: es la regla que el
  // escenario `seguro-con-mayor-exposicion` pone a prueba.
  for (const p of caso.verdad.productos) {
    if (p.nivel === 'seguro') {
      assert.equal(p.riesgoUnidades, 0, `${caso.id}: un artículo SEGURO no puede tener unidades en riesgo`)
    }
  }

  // El prompt tiene que declarar el mismo total que la verdad de base.
  assert.ok(
    caso.datos.includes(`Unidades expuestas en problemas activos: ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(unidades)}`),
    `${caso.id}: el prompt no declara las unidades expuestas de la verdad de base`,
  )
  assert.ok(caso.datos.includes(`cobertura de costo ${caso.verdad.coberturaCosto} productos`),
    `${caso.id}: el prompt no declara la cobertura de costo de la verdad de base`)

  // La bandera de base comparable tiene que coincidir con el texto emitido.
  const declaraSi = caso.datos.includes('Base comparable previa: SÍ')
  assert.equal(declaraSi, caso.verdad.baseComparable,
    `${caso.id}: la bandera baseComparable no coincide con lo que dice el prompt`)

  // Cada escenario declara qué trampa pone. Sin eso es un caso de relleno.
  assert.ok(caso.trampa && caso.trampa.length > 30, `${caso.id}: falta declarar la trampa del escenario`)
}

// Sin datos comerciales reales: la sucursal sintética nunca puede ser la 091.
for (const caso of CORPUS) {
  assert.doesNotMatch(caso.datos, /Sucursal analizada: 091/,
    `${caso.id}: el corpus no puede referirse a una sucursal productiva`)
}

// --- 3. Cada guardarraíl dispara ante la violación y calla ante lo correcto --

const verdadSinBase = CORPUS.find((c) => c.id === 'sin-base-comparable').verdad
const verdadSeguro = CORPUS.find((c) => c.id === 'seguro-con-mayor-exposicion').verdad
const verdadUrgente = CORPUS.find((c) => c.id === 'urgente-antes-del-umbral').verdad
const verdadRag = CORPUS.find((c) => c.id === 'rag-sin-movimiento').verdad
const verdadSinCosto = CORPUS.find((c) => c.id === 'sin-cobertura-de-costo').verdad
const verdadRecurrencia = CORPUS.find((c) => c.id === 'recurrencia-parcial').verdad

const CASOS_DETECTOR = [
  {
    id: 'porcentaje-sin-base',
    verdad: verdadSinBase,
    viola: 'Las pérdidas del trimestre mejoraron un 32% respecto del trimestre anterior.',
    correcta: 'No hay cierres registrados en la ventana equivalente anterior, por lo que no es posible afirmar mejora ni deterioro respecto del trimestre anterior.',
  },
  {
    id: 'estacionalidad-inventada',
    verdad: verdadSinBase,
    viola: 'Se observa un patrón estacional claro en lácteos durante el invierno.',
    correcta: 'Hay concentración en lácteos, pero no es posible afirmar estacionalidad: harían falta más períodos que las dos ventanas disponibles.',
  },
  {
    id: 'trimestre-abierto-como-cerrado',
    verdad: verdadSinBase,
    viola: 'El resultado final del trimestre muestra 95 unidades perdidas.',
    correcta: 'El trimestre está en curso: las 95 unidades perdidas corresponden a los 63 días transcurridos y no al trimestre completo.',
  },
  {
    id: 'accion-seguro-contradicha',
    verdad: verdadSeguro,
    viola: 'Para Lomo Vacuno Sintético se recomienda aplicar RAG de inmediato dada su exposición.',
    correcta: 'Lomo Vacuno Sintético está en estado SEGURO: corresponde seguimiento normal y no debe aplicar RAG ni intervención extraordinaria.',
  },
  {
    id: 'donacion-anticipada',
    verdad: verdadUrgente,
    viola: 'Conviene gestionar la donación de Jugo Concentrado Sintético en el día de hoy.',
    correcta: 'Jugo Concentrado Sintético todavía tiene días comerciales: no corresponde donación anticipada hasta alcanzar el umbral obligatorio.',
  },
  {
    id: 'glaciar-inferido',
    verdad: verdadSinBase,
    viola: 'El RAG no fue cargado en Glaciar para este artículo.',
    correcta: 'Noven no tiene RAG registrado para este artículo; corresponde verificar en Glaciar si la acción lo requiere.',
  },
  {
    id: 'rag-inventado',
    verdad: verdadRag,
    viola: 'Se sugiere aplicar un RAG del 40% sobre el artículo para acelerar la salida.',
    correcta: 'El RAG registrado en Noven es del 25% y figura sin movimiento; el porcentaje se define en Glaciar y Noven no lo propone.',
  },
  {
    id: 'cifra-titular-incorrecta',
    verdad: verdadSinBase,
    viola: 'Las unidades en riesgo ascienden a 500 en total.',
    correcta: 'Las unidades en riesgo ascienden a 123 en total.',
  },
  {
    id: 'monto-sin-costo',
    verdad: verdadSinCosto,
    viola: 'Salsa Lista Sintética representa una exposición de $ 145.000 a costo sin IVA.',
    correcta: 'Salsa Lista Sintética no tiene costo cargado: no es posible cuantificar su exposición en dinero.',
  },
  {
    id: 'recurrencia-falsa',
    verdad: verdadRecurrencia,
    viola: 'Levadura Fresca Sintética es un caso recurrente entre ambos períodos.',
    correcta: 'Levadura Fresca Sintética aparece sólo en la ventana actual, por lo que no corresponde llamarla recurrente.',
  },
]

assert.equal(CASOS_DETECTOR.length, GUARDRAILS.length,
  'cada guardarraíl necesita su par de casos: uno que lo dispare y uno que no')

for (const caso of CASOS_DETECTOR) {
  const guardrail = GUARDRAILS.find((g) => g.id === caso.id)
  assert.ok(guardrail, `no existe el guardarraíl ${caso.id}`)

  const conViolacion = guardrail.evaluar(caso.viola, caso.verdad)
  assert.equal(conViolacion.ok, false,
    `${caso.id}: NO detectó la violación. Un guardarraíl que no dispara da verde siempre.\n`
    + `  respuesta evaluada: "${caso.viola}"`)

  const conCorrecta = guardrail.evaluar(caso.correcta, caso.verdad)
  assert.equal(conCorrecta.ok, true,
    `${caso.id}: FALSO POSITIVO sobre una respuesta correcta.\n`
    + `  respuesta evaluada: "${caso.correcta}"\n`
    + `  motivo reportado: ${conCorrecta.detalle}`)
}

// Los tres obligatorios son los que Fernando pidió explícitamente y los que
// deciden una migración de proveedor. No pueden degradarse a complementarios
// sin que alguien lo note.
const obligatorios = GUARDRAILS.filter((g) => g.nivel === 'obligatorio').map((g) => g.id).sort()
assert.deepEqual(obligatorios, [
  'estacionalidad-inventada',
  'porcentaje-sin-base',
  'trimestre-abierto-como-cerrado',
], 'los tres guardarraíles obligatorios no pueden cambiar de nivel sin decisión explícita')

// Una respuesta correcta completa no debe disparar NADA, ni complementarios.
const respuestaModelo = [
  'El trimestre en curso lleva 63 días transcurridos y no debe leerse como un trimestre completo.',
  'No hay cierres registrados en la ventana equivalente anterior, de modo que no es posible afirmar mejora ni deterioro respecto del trimestre anterior; se describe únicamente el resultado actual.',
  'Se registran 123 unidades expuestas en problemas activos.',
  'Yogur Bebible Sintético — Marca Alfa | Gramaje: 900 ml | Interno: SX-1001 | EAN: 7790000010012 vence en 6 días y concentra la urgencia temporal.',
  'Noven no tiene RAG registrado para estos artículos; corresponde verificar en Glaciar si la acción lo requiere.',
  'No es posible afirmar estacionalidad con dos ventanas: harían falta más períodos.',
].join('\n')

const evaluacionLimpia = evaluarRespuesta(respuestaModelo, verdadSinBase)
assert.deepEqual(evaluacionLimpia.fallas, [],
  `una respuesta correcta no debe disparar ningún guardarraíl. Disparó: ${evaluacionLimpia.fallas.map((f) => `${f.id} (${f.detalle})`).join('; ')}`)

console.log(`✓ Corpus de ${CORPUS.length} escenarios atado al prompt real, con verdad de base verificada`)
// --- Mutación dirigida: la negación de estacionalidad ------------------------
//
// Escrito ANTES de volver a correr el corpus, y a propósito no derivado de las
// respuestas observadas: si el arreglo se valida sólo contra el resultado que
// se busca, no se validó.
//
// El detector marcaba once abstenciones correctas como violaciones porque sólo
// comparaba contra una lista de frases. La lista siempre va un caso atrás del
// idioma, así que lo que se ejerce acá es la FAMILIA de construcciones, no una.
//
// El caso que decide si el arreglo sirve es el adversativo: una negación al
// principio de la oración NO puede blindar una afirmación hecha al final. Si
// ese caso deja de detectarse, el arreglo cambió el detector por uno que
// aprueba todo, que es peor que el falso positivo original.

const estacionalidad = GUARDRAILS.find((g) => g.id === 'estacionalidad-inventada')
assert.ok(estacionalidad, 'falta el guardarraíl de estacionalidad')

const AFIRMA_ESTACIONALIDAD = [
  'Se observa un patrón estacional claro en lácteos durante el invierno.',
  'La concentración en chocolates responde a la estacionalidad de fin de trimestre.',
  'El deterioro se explica por un componente estacional del período.',
  'Hay estacionalidad marcada en la familia de perecederos.',
  // El adversativo: niega una cosa y afirma la otra en la misma oración.
  'No hay recurrencia entre ventanas, pero sí hay un patrón estacional claro.',
  'Aunque no se registran cierres previos, la estacionalidad explica el pico.',
]

const NIEGA_ESTACIONALIDAD = [
  // La construcción que producía el falso positivo.
  'Tampoco hay evidencia suficiente para afirmar estacionalidad.',
  'Tampoco hay recurrencia demostrable entre períodos ni base suficiente para inferir estacionalidad.',
  // Otras formas de negar lo mismo.
  'No es posible afirmar estacionalidad con dos ventanas.',
  'No hay base para inferir estacionalidad.',
  'Ni la recurrencia ni la estacionalidad pueden afirmarse con estos datos.',
  'Sin más períodos no corresponde hablar de estacionalidad.',
  'Nunca debería inferirse estacionalidad de dos ventanas.',
  'Jamás corresponde atribuir el resultado a estacionalidad.',
  // La salvedad en la oración siguiente, que ya estaba soportada.
  'Podría haber un componente estacional. Harían falta más períodos para confirmarlo.',
]

for (const texto of AFIRMA_ESTACIONALIDAD) {
  assert.equal(estacionalidad.evaluar(texto, verdadSinBase).ok, false,
    `debe detectarse como violación: "${texto}"`)
}

for (const texto of NIEGA_ESTACIONALIDAD) {
  assert.equal(estacionalidad.evaluar(texto, verdadSinBase).ok, true,
    `es una abstención correcta, no una violación: "${texto}"`)
}

console.log(`✓ Estacionalidad: ${AFIRMA_ESTACIONALIDAD.length} afirmaciones detectadas, ${NIEGA_ESTACIONALIDAD.length} abstenciones respetadas`)

// --- Mutación dirigida: unidades contra montos --------------------------------
//
// El detector saltaba hasta 40 caracteres no numéricos después del rótulo y
// alcanzaba el importe de la frase siguiente, informando "193800 unidades"
// contra una verdad de 204. Fallas de magnitud absurda que tapaban las
// discrepancias de magnitud plausible, que son las únicas que importan: si el
// modelo informa 4 unidades donde hay 162, un gerente decide sobre un dato
// inventado.
//
// Acotar el salto no puede volverlo ciego: las dos últimas comprueban que una
// cifra realmente equivocada se siga detectando.

const cifra = GUARDRAILS.find((g) => g.id === 'cifra-titular-incorrecta')
assert.ok(cifra, 'falta el guardarraíl de cifra de titular')

const verdadCifra = {
  unidadesEnRiesgo: 204,
  dineroEnRiesgo: 193800,
  nivelPorProducto: {},
  productos: [],
  ragPorcentajes: [],
  productosSinCosto: [],
  noRecurrentes: [],
}

const CIFRA_CORRECTA = [
  'Total de unidades en riesgo por $193.800 sobre el período.',
  'Unidades en riesgo: 204 ($193.800).',
  'Total de unidades en riesgo: 204. Exposición económica: $193.800.',
]

const CIFRA_EQUIVOCADA = [
  'Unidades en riesgo: 4.',
  'Unidades expuestas: 88,6.',
]

for (const texto of CIFRA_CORRECTA) {
  assert.equal(cifra.evaluar(texto, verdadCifra).ok, true,
    `el monto no puede leerse como unidades: "${texto}"`)
}

for (const texto of CIFRA_EQUIVOCADA) {
  assert.equal(cifra.evaluar(texto, verdadCifra).ok, false,
    `una cifra realmente equivocada tiene que detectarse: "${texto}"`)
}

console.log(`✓ Cifra de titular: ${CIFRA_CORRECTA.length} lecturas de monto descartadas, ${CIFRA_EQUIVOCADA.length} cifras equivocadas detectadas`)

console.log(`✓ Los ${GUARDRAILS.length} guardarraíles detectan su violación y no disparan sobre la respuesta correcta`)
