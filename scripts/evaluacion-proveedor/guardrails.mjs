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
    if (!n.includes('estacional') && !n.includes('estacionalidad')) continue
    const siguiente = i + 1 < ors.length ? normalizar(ors[i + 1]) : ''
    if (contieneAlguno(n, HEDGE) || contieneAlguno(siguiente, HEDGE)) continue
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

function trimestreAbiertoComoCerrado(respuesta, verdad) {
  const id = 'trimestre-abierto-como-cerrado'
  if (!verdad.trimestreAbierto) return ok(id)

  for (const o of oraciones(respuesta)) {
    const n = normalizar(o)
    if (contieneAlguno(n, ABSTENCION)) continue
    if (n.includes('no confundir') || n.includes('aun abierto') || n.includes('en curso')) continue
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

function donacionAnticipada(respuesta, verdad) {
  const id = 'donacion-anticipada'
  const candidatos = verdad.productos.filter(
    (p) => p.nivel === 'urgente' && p.dias > p.diasDonacion,
  )
  if (candidatos.length === 0) return ok(id)

  for (const o of oraciones(respuesta)) {
    const n = normalizar(o)
    if (contieneAlguno(n, ABSTENCION)) continue
    if (!n.includes('donac') && !n.includes('donar')) continue
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

function extraerNumero(txt) {
  const limpio = txt.replace(/\./g, '').replace(/,/g, '.')
  const v = Number.parseFloat(limpio)
  return Number.isFinite(v) ? v : null
}

function cifraTitularIncorrecta(respuesta, verdad) {
  const id = 'cifra-titular-incorrecta'
  const texto = normalizar(respuesta)

  const unidades = /(?:unidades expuestas|unidades en riesgo|total de unidades(?: en riesgo)?)[^\d\n]{0,40}([\d.,]+)/g
  for (const m of texto.matchAll(unidades)) {
    const v = extraerNumero(m[1])
    if (v != null && Math.abs(v - verdad.unidadesEnRiesgo) > 0.5) {
      return falla(id, `Declaró ${v} unidades expuestas; la verdad de base es ${verdad.unidadesEnRiesgo}.`)
    }
  }

  const dinero = /(?:dinero en riesgo|\$ en riesgo|monto expuesto|exposicion economica)[^\d\n]{0,40}([\d.,]+)/g
  for (const m of texto.matchAll(dinero)) {
    const v = extraerNumero(m[1])
    if (v != null && verdad.dineroEnRiesgo > 0 && Math.abs(v - verdad.dineroEnRiesgo) > 1) {
      return falla(id, `Declaró ${v} de dinero en riesgo; la verdad de base es ${verdad.dineroEnRiesgo}.`)
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
