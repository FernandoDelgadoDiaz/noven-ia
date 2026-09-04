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
// =============================================================================
// PASADA DE VALIDACIÓN COMPLETA · los diez detectores contra salida REAL
// =============================================================================
//
// POR QUÉ EXISTE ESTE BLOQUE
//
// La autoprueba de arriba ejerce cada detector contra UNA violación y UNA
// respuesta correcta, ambas escritas por quien escribió el detector. Eso
// verifica que el detector hace algo, no que mida lo que dice medir.
//
// Al correr el corpus contra la API real por primera vez, tres detectores
// dieron falsos positivos seguidos —estacionalidad, cifra de titular y
// donación— y en la corrida del 04-09 las 17 fallas fueron artefactos: ninguna
// era una violación del modelo. La causa es común: cada detector se validó
// contra el fraseo que su autor imaginó, y el modelo escribe de otra forma.
//
// Parchear el detector que falla en cada corrida es modelar el instrumento
// contra el fraseo de un modelo hasta que dé verde. Este bloque hace lo
// contrario: ejerce los diez contra la FAMILIA de construcciones, y el fraseo
// de abstención sale de las 24 respuestas reales de la corrida 33869459977 —
// es evidencia, no conjetura.
//
// La regla de cada caso: la violación tiene que marcarse, el uso legítimo no.
// Un detector que deja de marcar su violación es peor que uno que grita.

const porId = (id) => {
  const g = GUARDRAILS.find((x) => x.id === id)
  assert.ok(g, `falta el guardarraíl ${id}`)
  return g
}

const verdadCifra = {
  unidadesEnRiesgo: 123,
  dineroEnRiesgo: 244000,
  baseComparable: false,
  trimestreAbierto: true,
  nivelPorProducto: { 'Yogur Bebible Sintético': 'urgente', 'Queso Untable Sintético': 'radar' },
  productosSinCosto: [],
  noRecurrentes: [],
  ragPorcentajes: [],
  productos: [
    { descripcion: 'Yogur Bebible Sintético', nivel: 'urgente', dias: 6, diasDonacion: 3, cantidad: 48, vmd: 2, riesgoUnidades: 42, costoUnitario: 1200, dineroRiesgo: 50400 },
    { descripcion: 'Queso Untable Sintético', nivel: 'radar', dias: 31, diasDonacion: 5, cantidad: 120, vmd: 1.5, riesgoUnidades: 81, costoUnitario: 2400, dineroRiesgo: 194400 },
  ],
}

// Cada entrada: [id, verdad, [violaciones que DEBEN marcarse], [usos legítimos que NO]]
const VALIDACION = [
  ['porcentaje-sin-base', { ...verdadCifra, baseComparable: false }, [
    'Las pérdidas del trimestre mejoraron un 32% respecto del trimestre anterior.',
    'Frente a la ventana previa, las recuperaciones cayeron 80 unidades (-40%).',
    'El deterioro respecto del período previo es del 12%.',
  ], [
    // Fraseo real de la corrida 33869459977.
    'La ventana previa equivalente no posee cierres registrados, por lo que no existe base comparable.',
    'Aunque la ventana previa tiene igual extensión, no posee cierres registrados; no existe base comparable.',
    'En consecuencia, no existe base comparable para calcular variaciones ni concluir mejora o deterioro.',
    'No es posible afirmar mejora ni deterioro respecto del trimestre anterior.',
  ]],

  ['estacionalidad-inventada', verdadCifra, [
    'Se observa un patrón estacional claro en lácteos durante el invierno.',
    'La concentración en chocolates responde a la estacionalidad de fin de trimestre.',
    'Hay estacionalidad marcada en la familia de perecederos.',
    'No hay recurrencia entre ventanas, pero sí hay un patrón estacional claro.',
    'Aunque no se registran cierres previos, la estacionalidad explica el pico.',
  ], [
    'Tampoco hay evidencia suficiente para afirmar estacionalidad.',
    'Tampoco hay recurrencia demostrable entre períodos ni base suficiente para inferir estacionalidad.',
    'No hay base suficiente para afirmar estacionalidad.',
    'Esto indica recurrencia, no estacionalidad.',
    'Se requieren más períodos para evaluar estacionalidad.',
    'Ni la recurrencia ni la estacionalidad pueden afirmarse con estos datos.',
    'Sin más períodos no corresponde hablar de estacionalidad.',
    'Podría haber un componente estacional. Harían falta más períodos para confirmarlo.',
  ]],

  ['trimestre-abierto-como-cerrado', verdadCifra, [
    'El resultado final del trimestre muestra 95 unidades perdidas.',
    'Con el trimestre cerrado, la pérdida consolidada asciende a $142.000.',
    'El balance final del trimestre confirma el deterioro.',
  ], [
    'El resultado neto se deteriora, aunque Q3 permanece abierto y no debe interpretarse como trimestre completo.',
    'Mantener seguimiento separado de recuperación por venta, donación y decomiso para evaluar el resultado económico neto al cierre del trimestre.',
    'El trimestre está en curso: las 95 unidades corresponden a los 63 días transcurridos y no al trimestre completo.',
    'Continuar el monitoreo hasta el cierre del trimestre.',
  ]],

  ['accion-seguro-contradicha', { ...verdadCifra, nivelPorProducto: { 'Lomo Vacuno Sintético': 'seguro' } }, [
    'Para Lomo Vacuno Sintético se recomienda aplicar RAG de inmediato dada su exposición.',
    'Lomo Vacuno Sintético requiere intervención inmediata.',
  ], [
    'Lomo Vacuno Sintético está en estado SEGURO: corresponde seguimiento normal y no debe aplicar RAG.',
    'Lomo Vacuno Sintético no requiere intervención extraordinaria.',
  ]],

  ['donacion-anticipada', { ...verdadCifra, productos: [
    { descripcion: 'Salsa Lista Sintética', nivel: 'urgente', dias: 7, diasDonacion: 3, cantidad: 130, vmd: 1, riesgoUnidades: 112, costoUnitario: null, dineroRiesgo: 0 },
  ] }, [
    'Gestionar hoy la donación de Salsa Lista Sintética para liberar góndola.',
    'Corresponde donar Salsa Lista Sintética de inmediato.',
  ], [
    'Ejecutar hoy la revisión/aplicación de RAG y control físico de Salsa Lista Sintética, preservando la venta hasta el umbral obligatorio de donación.',
    'Al alcanzar el umbral obligatorio, retirar el remanente de Salsa Lista Sintética y gestionar donación según política.',
    'Corresponde revisar/aplicar RAG en Glaciar; no donar Salsa Lista Sintética antes del umbral obligatorio.',
  ]],

  ['glaciar-inferido', verdadCifra, [
    'El RAG no fue cargado en Glaciar.',
    'Glaciar no registra RAG para este artículo.',
    'Sin RAG en Glaciar, corresponde escalar.',
  ], [
    'Noven registra una intervención RAG del 25% aplicada en Glaciar, con estado sin movimiento.',
    'Requiere 4,62 u/día frente a una VMD histórica de Glaciar de 1,5 u/día.',
    'Corresponde revisar/aplicar RAG en Glaciar y controlar hoy la cantidad comprometida.',
  ]],

  ['rag-inventado', { ...verdadCifra, ragPorcentajes: [25] }, [
    'Se sugiere aplicar un RAG del 40% para acelerar la salida.',
  ], [
    'El RAG del 25% registrado en Noven no muestra movimiento y su respuesta es insuficiente.',
    'Noven registra información de una intervención aplicada en Glaciar de RAG 25%, sin movimiento.',
    // Un porcentaje que no es de RAG no puede leerse como RAG inventado.
    'Tiene 42 unidades en riesgo (87,5%), equivalentes a $50.400.',
  ]],

  ['cifra-titular-incorrecta', verdadCifra, [
    // La cifra verdadera no aparece por ningún lado.
    'La sucursal presenta 2 vencimientos activos con exposición moderada.',
    // Un número inventado junto al rótulo.
    'Total de unidades en riesgo: 300.',
  ], [
    // Los cuatro fraseos que producían falsos positivos, textuales de la corrida.
    'La sucursal presenta 2 vencimientos activos: 123 unidades expuestas por $244.800.',
    'Hay 123 unidades expuestas: 42 del URGENTE y 81 del RADAR.',
    'Tiene 42 unidades en riesgo (87,5%), equivalentes a $50.400. Total: 123 unidades expuestas.',
    'Total de unidades en riesgo: 123, equivalentes a $244.800.',
    '123 unidades en riesgo activo sobre 168 comprometidas.',
  ]],

  ['monto-sin-costo', { ...verdadCifra, productosSinCosto: ['Salsa Lista Sintética'] }, [
    'Salsa Lista Sintética representa $80.000 de exposición.',
  ], [
    'Exposición económica: no hay productos valorizados; la exposición debe gestionarse en unidades.',
    'Salsa Lista Sintética carece de costo sin IVA, por lo que no es posible cuantificar dinero en riesgo.',
  ]],

  ['recurrencia-falsa', { ...verdadCifra, noRecurrentes: ['Queso Untable Sintético'] }, [
    'Queso Untable Sintético es recurrente entre ambas ventanas.',
  ], [
    'No hay productos recurrentes demostrables entre ambas ventanas.',
    'Crema de Leche Sintética es recurrente entre ambas ventanas, con 2 cierres previos y 3 actuales.',
  ]],
]

let violacionesOk = 0
let legitimosOk = 0

for (const [id, verdad, violaciones, legitimos] of VALIDACION) {
  const g = porId(id)
  for (const texto of violaciones) {
    assert.equal(g.evaluar(texto, verdad).ok, false,
      `[${id}] debe marcarse como violación: "${texto}"`)
    violacionesOk += 1
  }
  for (const texto of legitimos) {
    const r = g.evaluar(texto, verdad)
    assert.equal(r.ok, true,
      `[${id}] uso legítimo marcado como violación: "${texto}"${r.detalle ? ` -> ${r.detalle}` : ''}`)
    legitimosOk += 1
  }
}

assert.equal(VALIDACION.length, GUARDRAILS.length,
  'la pasada de validación tiene que cubrir los diez detectores, no un subconjunto')

console.log(`✓ Validación completa: ${GUARDRAILS.length} detectores · ${violacionesOk} violaciones detectadas · ${legitimosOk} usos legítimos respetados`)

// --- Prueba adversaria: violaciones inyectadas en salida REAL ----------------
//
// Los casos de arriba son frases sueltas. Un detector puede pasarlas y aun así
// perderse la violación dentro de una respuesta de cinco mil caracteres, donde
// hay decenas de números, porcentajes y menciones legítimas alrededor.
//
// Esto toma una respuesta textual del modelo —corrida 33869459977, escenario
// `sin-base-comparable`, repetición 1— verifica que no dispare nada, y después
// le inyecta una violación por vez.
//
// Es la prueba que distingue un detector arreglado de uno que aprueba todo:
// después de tres rondas de falsos positivos, la tentación es aflojar los
// detectores hasta que el corpus dé verde. Si alguna inyección deja de
// cazarse, eso es exactamente lo que pasó.

const RESPUESTA_REAL = "## 1. Estado general de la sucursal y exposición económica\n\nLa sucursal presenta 2 vencimientos activos, ambos con problema operativo, que concentran 123 unidades y $244.800 a costo sin IVA. La cobertura de valorización es completa. Existe una prioridad URGENTE y una RADAR; la exposición económica mayor no coincide con la urgencia temporal, por lo que ambos casos requieren visibilidad gerencial.\n\n## 2. Prioridades de hoy: tiempo, intervención e impacto económico\n\n**Urgencia temporal:** Yogur Bebible Sintético — Marca Alfa | Gramaje: 900 ml | Interno: SX-1001 | EAN: 7790000010012. Vence en 6 días y dispone de sólo 3 días comerciales antes del umbral obligatorio de donación. Tiene 42 unidades expuestas (87,5%), equivalentes a $50.400. Su velocidad necesaria es 16,00 u/día frente a una VMD histórica de Glaciar de 2 u/día, por lo que requiere intervención inmediata.\n\n**Mayor exposición económica:** Queso Untable Sintético — Marca Beta | Gramaje: 290 g | Interno: SX-1002 | EAN: 7790000010029. Mantiene 81 unidades expuestas (67,5%) y $194.400 en riesgo, el 79,4% de la exposición económica activa. Aunque cuenta con 26 días comerciales, necesita 4,62 u/día frente a una VMD histórica de Glaciar de 1,5 u/día.\n\nNo hay caso destacado de RAG registrado en Noven sin movimiento o insuficiente. Sin embargo, la ausencia de registro en Noven exige verificar en Glaciar si corresponde la intervención.\n\n## 3. Seguimiento RAG y productos que requieren nueva intervención\n\nPara Yogur Bebible Sintético — Marca Alfa | Gramaje: 900 ml | Interno: SX-1001 | EAN: 7790000010012, revisar/aplicar RAG en Glaciar y controlar hoy la cantidad comprometida. Noven no registra una intervención RAG; ello no informa el estado de Glaciar. No corresponde donar anticipadamente: el remanente pasará a DONACIÓN al alcanzar el umbral obligatorio.\n\nPara Queso Untable Sintético — Marca Beta | Gramaje: 290 g | Interno: SX-1002 | EAN: 7790000010029, verificar hoy en Glaciar si corresponde RAG y luego monitorear la cantidad comprometida. Por su riesgo económico relevante, la verificación debe realizarse en el día operativo, no limitarse a seguimiento semanal.\n\n## 4. Resultado económico\n\nEn la ventana actual abierta, se recuperaron por venta 210 unidades y $180.000 a costo sin IVA. Se perdieron 95 unidades: 60 por donación y 35 por decomiso, por $142.000. El decomiso es cualitativamente más crítico que la donación, pero no corresponde concluir mejora o deterioro neto.\n\nLa ventana previa equivalente no posee cierres registrados; por tanto, no existe base comparable para calcular variaciones ni afirmar evolución intertrimestral. Tampoco hay recurrencia demostrable entre períodos ni base suficiente para inferir estacionalidad.\n\n## 5. Recomendaciones estratégicas\n\n1. Ejecutar hoy la revisión/intervención RAG del yogur y control físico de sus 48 unidades comprometidas.  \n2. Verificar hoy la intervención aplicable al queso y controlar físicamente sus 120 unidades comprometidas.  \n3. Mantener seguimiento diferenciado: urgencia temporal para yogur y protección económica para queso.  \n4. Registrar controles y resultados operativos para construir una base histórica comparable y evaluar hipótesis de ejecución, abastecimiento o rotación."

const verdadReal = CORPUS.find((c) => c.id === 'sin-base-comparable').verdad

assert.deepEqual(evaluarRespuesta(RESPUESTA_REAL, verdadReal).fallas, [],
  'la respuesta real del modelo no debe disparar ningún guardarraíl')

const INYECCIONES = [
  ['porcentaje-sin-base', 'Las pérdidas mejoraron un 32% respecto del trimestre anterior.'],
  ['estacionalidad-inventada', 'Se observa un patrón estacional claro en lácteos.'],
  ['trimestre-abierto-como-cerrado', 'El resultado final del trimestre muestra 95 unidades perdidas.'],
  ['cifra-titular-incorrecta', 'Total de unidades en riesgo: 500.'],
  ['rag-inventado', 'Se sugiere aplicar un RAG del 45% para acelerar la salida.'],
  ['glaciar-inferido', 'El RAG no fue cargado en Glaciar.'],
]

for (const [id, frase] of INYECCIONES) {
  const fallas = evaluarRespuesta(`${RESPUESTA_REAL}\n${frase}`, verdadReal).fallas.map((f) => f.id)
  assert.ok(fallas.includes(id),
    `la violación inyectada se perdió dentro de una respuesta real: ${id} — "${frase}"`)
}

console.log(`✓ Salida real: 0 falsos positivos y ${INYECCIONES.length}/${INYECCIONES.length} violaciones inyectadas detectadas`)

console.log(`✓ Los ${GUARDRAILS.length} guardarraíles detectan su violación y no disparan sobre la respuesta correcta`)
