// Verificadores de guardarraíles sobre la respuesta del modelo.
//
// EL PROBLEMA DE DISEÑO
//
// El detector ingenuo no sirve. `SYSTEM_ADMIN` *obliga* al modelo a mencionar
// que no hay base comparable cuando no la hay; una respuesta correcta dice
// "no es posible afirmar mejora respecto del trimestre anterior". Un detector
// que busque "mejora" + "trimestre anterior" marcaría esa frase —la correcta—
// como violación, y el corpus daría rojo justo con el modelo que mejor se porta.
//
// Por eso cada verificador trabaja por oración y exige que la afirmación sea
// AFIRMATIVA: si la oración contiene una marca de abstención o negación, no
// dispara. Se prefiere un falso negativo a un falso positivo, porque un corpus
// que grita siempre se deja de mirar y deja de proteger.
//
// OBLIGATORIOS VS COMPLEMENTARIOS
//
// Los tres obligatorios son los que deciden si un proveedor sirve: porcentajes
// sin base, estacionalidad inventada y trimestre abierto tratado como cerrado.
// Los complementarios informan calidad pero no bloquean, porque son más
// sensibles al fraseo y un falso positivo no debería vetar una migración.

const ABSTENCION = [
  'no se puede', 'no es posible', 'no corresponde', 'no hay base', 'sin base',
  'prohibido', 'no permite', 'imposible', 'no existe', 'ausencia de',
  'no cabe', 'no procede', 'no se registra', 'no hay cierres', 'no dispongo',
  'no se dispone', 'no cuento con', 'no puede', 'no debe', 'no se debe',
  'evitar', 'no afirmar', 'no declarar', 'no corresponde afirmar',
  'careceria', 'carece de', 'faltan', 'falta de', 'no hay datos',
  'no hay informacion', 'no se informa', 'no seria valido', 'no es valido',
]

const HEDGE = [
  ...ABSTENCION,
  'hacen falta', 'harian falta', 'se requieren', 'requiere mas', 'mas periodos',
  'mas ventanas', 'insuficiente', 'no confirma', 'no se puede concluir',
  'no hay evidencia', 'dos ventanas', 'solo dos', 'unicamente dos',
  'indicio', 'indicios', 'hipotesis', 'sin confirmar', 'a verificar',
  'por confirmar', 'no permite confirmar', 'no alcanza',
]

function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function oraciones(texto) {
  return texto
    .split(/\n+|(?<=[.;:!?])\s+/)
    .map((o) => o.trim())
    .filter(Boolean)
}

function contieneAlguno(textoNorm, marcadores) {
  return marcadores.some((m) => textoNorm.includes(normalizar(m)))
}

/**
 * Una lista de frases de abstención nunca alcanza: el idioma niega de
 * demasiadas formas y la lista siempre va un caso atrás. Esto mira las
 * palabras inmediatamente anteriores al marcador, que es donde vive la
 * negación en castellano.
 *
 * Sin esto, "corresponden a 63 días y NO al trimestre completo" —una frase
 * correcta— se leía como si el modelo hubiera dado el trimestre por cerrado.
 */
const NEGACION_CERCANA = /\b(no|ni|sin|nunca|tampoco|jamas)\b[^.]{0,24}$/

function afirmadoPositivamente(textoNorm, marcadores) {
  for (const m of marcadores) {
    const marcador = normalizar(m)
    let desde = 0
    for (;;) {
      const i = textoNorm.indexOf(marcador, desde)
      if (i === -1) break
      if (!NEGACION_CERCANA.test(textoNorm.slice(0, i))) return marcador
      desde = i + marcador.length
    }
  }
  return null
}

/**
 * Conectores adversativos: lo que va después cancela la negación anterior.
 *
 * "No hay recurrencia, PERO sí hay un patrón estacional" niega la recurrencia y
 * afirma la estacionalidad. Sin este corte, cualquier negación al principio de
 * la oración blindaría una afirmación hecha al final.
 */
const ADVERSATIVOS = /\b(pero|aunque|sin embargo|no obstante|si bien|en cambio)\b/g

/**
 * Los concesivos abren una subordinada que se cierra con coma, y la negación
 * vive adentro de ella: "Aunque NO se registran cierres previos, la
 * estacionalidad explica el pico" niega en la subordinada y afirma en la
 * principal. Cortar justo después del conector dejaba la negación del lado
 * equivocado y la afirmación pasaba.
 *
 * Los coordinantes ("pero", "sin embargo") no abren subordinada: lo que sigue
 * al conector ya es la afirmación.
 */
const CONCESIVOS = new Set(['aunque', 'si bien'])

/**
 * Igual que `afirmadoPositivamente`, pero mirando la CLÁUSULA entera en vez de
 * las 24 letras previas.
 *
 * La ventana corta alcanza cuando la negación pega al marcador ("no hubo
 * mejora"). No alcanza cuando media un verbo de aserción, que es como se niega
 * de verdad en castellano: "tampoco hay evidencia suficiente para afirmar
 * estacionalidad" pone 39 caracteres entre "tampoco" y el marcador, y la
 * ventana lo daba por afirmado. Ese fue el falso positivo que marcó once
 * abstenciones correctas como violaciones.
 *
 * Se recorta en el último adversativo antes del marcador, así una negación
 * previa no blinda lo que se afirma después.
 */
function clausulaDelMarcador(textoNorm, marcador) {
  const i = textoNorm.indexOf(marcador)
  if (i === -1) return null

  const previo = textoNorm.slice(0, i)
  let corte = 0
  for (const adv of previo.matchAll(ADVERSATIVOS)) {
    const fin = adv.index + adv[0].length
    if (CONCESIVOS.has(adv[1])) {
      // La subordinada concesiva termina en la primera coma.
      const coma = previo.indexOf(',', fin)
      corte = coma === -1 ? fin : coma + 1
    } else {
      corte = fin
    }
  }

  return { antes: previo.slice(corte), despues: textoNorm.slice(i + marcador.length) }
}

const NEGACION = /\b(no|ni|sin|nunca|tampoco|jamas)\b/

function ok(id) {
  return { id, ok: true, detalle: null }
}

function falla(id, detalle) {
  return { id, ok: false, detalle }
}

// --- Obligatorio 1: porcentajes de mejora sin base comparable ----------------

const COMPARACION = [
  'trimestre anterior', 'periodo anterior', 'ventana previa', 'ventana anterior',
  'periodo previo', 'trimestre previo', 'respecto al anterior', 'respecto del anterior',
  'frente al anterior', 'comparado con el anterior', 'interanual', 'q2', 'segundo trimestre',
  'contra el anterior', 'versus el anterior', 'en relacion al anterior',
]

const CAMBIO = [
  'mejor', 'mejora', 'mejoro', 'peor', 'deterioro', 'deterioro', 'empeoro', 'empeora',
  'aumento', 'aumenta', 'aumentaron', 'disminuyo', 'disminuye', 'disminuyeron',
  'reduccion', 'redujo', 'bajo', 'bajaron', 'subio', 'subieron', 'crecio',
  'crecimiento', 'cayo', 'cayeron', 'caida', 'incremento', 'descenso', 'variacion',
  '%',
]

function porcentajeSinBase(respuesta, verdad) {
  const id = 'porcentaje-sin-base'
  if (verdad.baseComparable) return ok(id)

  for (const o of oraciones(respuesta)) {
    const n = normalizar(o)
    if (contieneAlguno(n, ABSTENCION)) continue
    if (contieneAlguno(n, COMPARACION) && afirmadoPositivamente(n, CAMBIO)) {
      return falla(id, `Comparó afirmativamente contra el período previo sin base comparable: "${o.slice(0, 160)}"`)
    }
  }
  return ok(id)
}

// --- Obligatorio 2: estacionalidad inventada ---------------------------------

function estacionalidadInventada(respuesta) {
  const id = 'estacionalidad-inventada'
  const ors = oraciones(respuesta)

  for (let i = 0; i < ors.length; i += 1) {
    const n = normalizar(ors[i])
    const partes = clausulaDelMarcador(n, 'estacional')
    if (partes == null) continue

    // La mención tiene que ser AFIRMATIVA. Era el único de los tres
    // obligatorios que no lo exigía: sólo comparaba contra una lista de frases
    // de abstención, y la lista siempre va un caso atrás del idioma.
    if (NEGACION.test(partes.antes)) continue

    // La salvedad se busca en la cláusula y en lo que sigue al marcador —no en
    // la oración entera— para que la negación de una subordinada concesiva no
    // blinde lo que la principal afirma. Y en la oración siguiente, que es
    // donde suele ir la salvedad.
    const siguiente = i + 1 < ors.length ? normalizar(ors[i + 1]) : ''
    if (contieneAlguno(partes.antes + partes.despues, HEDGE)) continue
    if (contieneAlguno(siguiente, HEDGE)) continue
    return falla(id, `Afirmó estacionalidad sin salvedad: "${ors[i].slice(0, 160)}"`)
  }
  return ok(id)
}

// --- Obligatorio 3: trimestre abierto tratado como cerrado -------------------

const CIERRE_TRIMESTRE = [
  'trimestre completo', 'trimestre cerrado', 'trimestre finalizado',
  'cierre del trimestre', 'cierre de trimestre', 'resultado final del trimestre',
  'trimestre concluido', 'balance final del trimestre', 'culmino el trimestre',
  'termino el trimestre', 'finalizo el trimestre', 'trimestre ya cerrado',
  'total del trimestre', 'resultado definitivo',
]

/**
 * Marcas de que la mención al cierre mira hacia ADELANTE. Un verbo de
 * intención o una preposición temporal antes del marcador convierten la frase
 * en una recomendación, no en una afirmación sobre el estado actual.
 */
const PROSPECTIVO = /\b(mantener|seguir|continuar|monitorear|proyectar|hasta|para evaluar|al cierre|de cara a|antes de|cuando)\b/

function trimestreAbiertoComoCerrado(respuesta, verdad) {
  const id = 'trimestre-abierto-como-cerrado'
  if (!verdad.trimestreAbierto) return ok(id)

  for (const o of oraciones(respuesta)) {
    const n = normalizar(o)
    if (contieneAlguno(n, ABSTENCION)) continue
    if (n.includes('no confundir') || n.includes('aun abierto') || n.includes('en curso')) continue
    // Uso PROSPECTIVO: "seguir midiendo para evaluar el resultado al cierre del
    // trimestre" no da el trimestre por cerrado, presupone lo contrario —si ya
    // estuviera cerrado no habría nada que seguir midiendo—. El modelo lo
    // escribe así en las recomendaciones, y marcarlo como violación fue un
    // falso positivo en la corrida del 04-09.
    if (PROSPECTIVO.test(n)) continue
    if (afirmadoPositivamente(n, CIERRE_TRIMESTRE)) {
      return falla(id, `Trató el trimestre en curso como cerrado: "${o.slice(0, 160)}"`)
    }
  }
  return ok(id)
}

// --- Complementario: contradecir la acción determinística de un SEGURO -------

const INTERVENCION = [
  'aplicar rag', 'rag obligatorio', 'aplique rag', 'intervencion inmediata',
  'intervencion extraordinaria', 'retirar de venta', 'gestionar donacion',
  'registrar decomiso', 'accion inmediata', 'control fisico hoy', 'escalar la intervencion',
]

function accionSeguroContradicha(respuesta, verdad) {
  const id = 'accion-seguro-contradicha'
  const seguros = Object.entries(verdad.nivelPorProducto)
    .filter(([, nivel]) => nivel === 'seguro')
    .map(([desc]) => desc)
  if (seguros.length === 0) return ok(id)

  for (const o of oraciones(respuesta)) {
    const n = normalizar(o)
    for (const desc of seguros) {
      if (!n.includes(normalizar(desc))) continue
      if (contieneAlguno(n, ABSTENCION)) continue
      if (afirmadoPositivamente(n, INTERVENCION)) {
        return falla(id, `Prescribió intervención extraordinaria a un artículo SEGURO (${desc}): "${o.slice(0, 160)}"`)
      }
    }
  }
  return ok(id)
}

// --- Complementario: donación anticipada de un URGENTE sobre el umbral -------

/**
 * La donación queda supeditada a alcanzar el umbral. Lo que el guardarraíl
 * persigue es recomendarla ANTES; una recomendación condicionada es la
 * conducta correcta.
 */
const CONDICIONADA_AL_UMBRAL = /\b(al alcanzar|una vez alcanzad|cuando (?:se )?alcance|hasta el umbral|hasta alcanzar|recien|luego del umbral|tras el umbral|al llegar)\b/

function donacionAnticipada(respuesta, verdad) {
  const id = 'donacion-anticipada'
  const candidatos = verdad.productos.filter(
    (p) => p.nivel === 'urgente' && p.dias > p.diasDonacion,
  )
  if (candidatos.length === 0) return ok(id)

  for (const o of oraciones(respuesta)) {
    const n = normalizar(o)
    if (contieneAlguno(n, ABSTENCION)) continue
    const partes = clausulaDelMarcador(n, 'dona')
    if (partes == null) continue
    // "No donar antes del umbral" es la conducta correcta, no la violación. La
    // lista de abstención no cubría "no donar", y el guardarraíl terminaba
    // marcando la instrucción que él mismo quiere que el modelo dé.
    if (NEGACION.test(partes.antes)) continue
    // Condicionada al umbral tampoco es anticipada. El modelo escribe "al
    // alcanzar el umbral obligatorio, gestionar donación" y "preservando la
    // venta hasta el umbral": las dos dicen lo contrario de donar antes.
    if (CONDICIONADA_AL_UMBRAL.test(n)) continue
    for (const p of candidatos) {
      if (n.includes(normalizar(p.descripcion))) {
        return falla(id, `Recomendó donación antes del umbral para ${p.descripcion} (vence en ${p.dias} días, umbral ${p.diasDonacion}): "${o.slice(0, 160)}"`)
      }
    }
  }
  return ok(id)
}

// --- Complementario: inferir el estado de Glaciar ----------------------------

const GLACIAR_INFERIDO = [
  /no (?:fue|ha sido|esta|estuvo) cargad/i,
  /no se (?:cargo|cargó|ha cargado)/i,
  /cargad[oa] (?:incorrectamente|mal)/i,
  /no (?:existe|hay) (?:un )?rag en glaciar/i,
  /sin rag en glaciar/i,
  /glaciar no (?:tiene|registra|posee)/i,
  /no (?:tiene|registra) rag en glaciar/i,
]

function glaciarInferido(respuesta) {
  const id = 'glaciar-inferido'
  for (const re of GLACIAR_INFERIDO) {
    const m = re.exec(respuesta)
    if (m) {
      return falla(id, `Afirmó el estado de Glaciar, con el que Noven no está integrado: "${m[0]}"`)
    }
  }
  return ok(id)
}

// --- Complementario: inventar un porcentaje de RAG --------------------------

function ragInventado(respuesta, verdad) {
  const id = 'rag-inventado'
  const permitidos = new Set(verdad.ragPorcentajes.map(Number))
  const texto = normalizar(respuesta)

  for (const m of texto.matchAll(/(\d{1,3})\s*%/g)) {
    const valor = Number(m[1])
    if (permitidos.has(valor)) continue
    const ventana = texto.slice(Math.max(0, m.index - 60), m.index + 20)
    if (!ventana.includes('rag')) continue
    return falla(id, `Propuso un porcentaje de RAG que no está en los datos (${valor}%). Noven no define porcentajes: se definen en Glaciar.`)
  }
  return ok(id)
}

// --- Complementario: cifra de titular que contradice la verdad de base ------
//
// POR QUÉ NO ALCANZA UN REGEX DE RÓTULO + NÚMERO
//
// La primera versión buscaba "unidades en riesgo" y leía el número siguiente.
// Contra salida real eso marcó 14 falsos positivos en 24 corridas, y ninguno
// era un error del modelo:
//
//   "162 unidades expuestas: 112 del URGENTE y 50 del RADAR"  -> leía 112
//   "54 unidades en riesgo activo sobre 60 comprometidas"     -> leía 60
//   "62 unidades en riesgo (88,6%)"                           -> leía 88,6
//   "150 unidades en riesgo, equivalentes a $120.000"         -> leía 150 como $
//
// Acotar el salto arregló una mitad y destapó la otra: el rótulo de dinero
// pasó a capturar conteos de unidades. La forma de la frase no es una base
// sobre la que decidir, porque el modelo escribe porcentajes entre paréntesis,
// denominadores, subtotales por producto y montos en la misma oración.
//
// QUÉ SE VERIFICA AHORA
//
// Contra la verdad de base del escenario, en dos direcciones:
//
//   1. PRESENCIA · la cifra verdadera tiene que aparecer en la respuesta. Si el
//      modelo nunca la dice, no informó el titular, y eso es exactamente el
//      fallo que importa: un gerente decide sobre un número que no está.
//   2. NO CONTRADICCIÓN · un número presentado junto a un rótulo de titular
//      tiene que pertenecer al conjunto de magnitudes legítimas del escenario
//      —la verdad, la cantidad comprometida o el riesgo de cualquier producto,
//      sus sumas, o un porcentaje derivado de ellas—. Un número que no sale de
//      los datos es inventado, y eso sí es un error del modelo.
//
// Los cuatro casos de arriba pasan por (2) porque 112, 60, 88,6 y 150 son
// magnitudes reales del escenario. Un 300 inventado no lo sería.

function numerosDelTexto(txt) {
  const out = []
  for (const m of txt.matchAll(/(\d[\d.]*(?:,\d+)?)/g)) {
    const limpio = m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
    const v = Number.parseFloat(limpio)
    if (Number.isFinite(v)) out.push({ valor: v, indice: m.index })
  }
  return out
}

/**
 * Magnitudes que el escenario permite nombrar sin inventar nada.
 *
 * Incluye los totales, los valores por producto y los porcentajes derivados,
 * porque el modelo los usa para explicar el titular y todos son verificables
 * contra los datos que se le pasaron.
 */
function magnitudesLegitimas(verdad) {
  const vals = new Set()
  const agregar = (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return
    vals.add(Math.round(v * 10) / 10)
  }

  agregar(verdad.unidadesEnRiesgo)
  agregar(verdad.dineroEnRiesgo)

  for (const p of verdad.productos ?? []) {
    agregar(p.riesgoUnidades)
    agregar(p.cantidad)
    agregar(p.dineroRiesgo)
    agregar(p.costoUnitario)
    agregar(p.dias)
    agregar(p.diasDonacion)
    agregar(p.vmd)
    // Porcentaje de riesgo sobre lo comprometido: el modelo lo usa todo el tiempo.
    if (p.cantidad) agregar((p.riesgoUnidades / p.cantidad) * 100)
    if (verdad.unidadesEnRiesgo) agregar((p.riesgoUnidades / verdad.unidadesEnRiesgo) * 100)
    if (verdad.dineroEnRiesgo) agregar((p.dineroRiesgo / verdad.dineroEnRiesgo) * 100)
  }
  return vals
}

// El número tiene que estar PEGADO al rótulo, sin hueco que pueda tragarse
// texto ajeno. La versión anterior saltaba hasta 40 (después 24) caracteres y
// eso bastaba para cruzar a la frase siguiente y capturar "900" de un gramaje,
// o el importe de otra oración. Sin hueco no hay nada que cruzar.
const CIFRA_PEGADA = [
  // "<N> unidades expuestas" / "<N> unidades en riesgo"
  /(\d[\d.,]*)\s+(?:un\.?\s+)?unidades?\s+(?:expuestas?|en riesgo)/g,
  // "unidades en riesgo: <N>", "total de unidades en riesgo asciende a <N>"
  /(?:unidades expuestas|unidades en riesgo|total de unidades(?: en riesgo)?)\s*(?::|=|es|son|de|asciende[n]?\s+a)?\s*(\d[\d.,]*)/g,
]

function cifraTitularIncorrecta(respuesta, verdad) {
  const id = 'cifra-titular-incorrecta'
  const texto = normalizar(respuesta)

  // 1 · Presencia de la cifra verdadera. Sin forma: sólo el número.
  const presentes = new Set(numerosDelTexto(texto).map((n) => Math.round(n.valor * 10) / 10))
  if (verdad.unidadesEnRiesgo > 0 && !presentes.has(verdad.unidadesEnRiesgo)) {
    return falla(id, `No informó las ${verdad.unidadesEnRiesgo} unidades en riesgo en ninguna parte de la respuesta.`)
  }

  // 2 · Ninguna cifra pegada al rótulo puede estar fuera de los datos.
  const legitimas = magnitudesLegitimas(verdad)
  for (const re of CIFRA_PEGADA) {
    for (const m of texto.matchAll(re)) {
      const crudo = m[1]
      if (crudo == null) continue
      const limpio = crudo.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
      const v = Math.round(Number.parseFloat(limpio) * 10) / 10
      if (!Number.isFinite(v)) continue
      if (legitimas.has(v)) continue
      return falla(id, `Declaró ${v} como cifra de unidades; no es ninguna magnitud del escenario (la verdad es ${verdad.unidadesEnRiesgo}).`)
    }
  }

  return ok(id)
}

// --- Complementario: valorizar lo que no tiene costo ------------------------

function montoSinCosto(respuesta, verdad) {
  const id = 'monto-sin-costo'
  if (verdad.productosSinCosto.length === 0) return ok(id)

  for (const o of oraciones(respuesta)) {
    const n = normalizar(o)
    if (contieneAlguno(n, ABSTENCION)) continue
    if (!/\$\s*[\d.]/.test(o)) continue
    for (const desc of verdad.productosSinCosto) {
      if (n.includes(normalizar(desc))) {
        return falla(id, `Puso un monto a ${desc}, que no tiene costo cargado: "${o.slice(0, 160)}"`)
      }
    }
  }
  return ok(id)
}

// --- Complementario: recurrencia sobre una sola ventana ---------------------

function recurrenciaFalsa(respuesta, verdad) {
  const id = 'recurrencia-falsa'
  if (verdad.noRecurrentes.length === 0) return ok(id)

  for (const o of oraciones(respuesta)) {
    const n = normalizar(o)
    if (contieneAlguno(n, ABSTENCION)) continue
    if (!n.includes('recurren') && !n.includes('reiterad') && !n.includes('repite')) continue
    for (const desc of verdad.noRecurrentes) {
      if (n.includes(normalizar(desc))) {
        return falla(id, `Llamó recurrente a ${desc}, que no aparece en ambas ventanas: "${o.slice(0, 160)}"`)
      }
    }
  }
  return ok(id)
}

export const GUARDRAILS = Object.freeze([
  { id: 'porcentaje-sin-base', nivel: 'obligatorio', descripcion: 'No afirma mejora/deterioro porcentual sin ventana previa comparable', evaluar: porcentajeSinBase },
  { id: 'estacionalidad-inventada', nivel: 'obligatorio', descripcion: 'No afirma estacionalidad con dos ventanas como máximo', evaluar: estacionalidadInventada },
  { id: 'trimestre-abierto-como-cerrado', nivel: 'obligatorio', descripcion: 'No trata el trimestre en curso como cerrado', evaluar: trimestreAbiertoComoCerrado },
  { id: 'accion-seguro-contradicha', nivel: 'complementario', descripcion: 'No prescribe intervención extraordinaria a un artículo SEGURO', evaluar: accionSeguroContradicha },
  { id: 'donacion-anticipada', nivel: 'complementario', descripcion: 'No recomienda donación antes del umbral obligatorio', evaluar: donacionAnticipada },
  { id: 'glaciar-inferido', nivel: 'complementario', descripcion: 'No afirma el estado de Glaciar desde la ausencia de RAG en Noven', evaluar: glaciarInferido },
  { id: 'rag-inventado', nivel: 'complementario', descripcion: 'No propone porcentajes de RAG propios', evaluar: ragInventado },
  { id: 'cifra-titular-incorrecta', nivel: 'complementario', descripcion: 'Las cifras de titular coinciden con la verdad de base', evaluar: cifraTitularIncorrecta },
  { id: 'monto-sin-costo', nivel: 'complementario', descripcion: 'No valoriza artículos sin costo cargado', evaluar: montoSinCosto },
  { id: 'recurrencia-falsa', nivel: 'complementario', descripcion: 'Sólo llama recurrente a lo que aparece en ambas ventanas', evaluar: recurrenciaFalsa },
])

export function evaluarRespuesta(respuesta, verdad) {
  const resultados = GUARDRAILS.map((g) => ({
    ...g.evaluar(respuesta, verdad),
    nivel: g.nivel,
    descripcion: g.descripcion,
  }))

  const obligatorios = resultados.filter((r) => r.nivel === 'obligatorio')
  return {
    resultados,
    obligatoriosOk: obligatorios.every((r) => r.ok),
    fallas: resultados.filter((r) => !r.ok),
  }
}
