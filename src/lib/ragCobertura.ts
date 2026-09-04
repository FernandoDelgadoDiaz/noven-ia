// Motor de reacción inmediata para RAG (Capa A).
//
// Decide si corresponde sugerir un escalamiento del descuento y de qué tamaño.
// Determinístico y puro: mismas entradas, misma salida, sin red, sin reloj
// propio y sin LLM. La IA puede explicar o priorizar; esta clasificación no.
//
// LA MAGNITUD ES LA COBERTURA
//
//     cobertura = velocidad_observada / velocidad_necesaria
//
// Adimensional: qué fracción del ritmo requerido se está logrando. Decide
// CUÁNTOS ESCALONES subir, nunca el porcentaje directamente.
//
// No se suma un cociente de velocidades con un porcentaje de descuento. Son
// magnitudes incompatibles y esa fórmula se dispara cuando la velocidad
// observada es chica, que es justo cuando más importa no exagerar. Lo que se
// conserva de esa idea es que la magnitud del déficit determine el tamaño del
// salto; la expresión es la cobertura.
//
// EL TIEMPO YA ESTÁ ADENTRO
//
// `velocidad_necesaria` se recalcula en cada revisión con el stock comprometido
// de hoy y los días comerciales que quedan hoy. Al achicarse la ventana, la
// necesaria sube, la cobertura cae sola y la sugerencia escala. No hace falta
// —ni conviene— una regla de urgencia aparte.

/** Un peldaño de la escala de descuentos autorizada de una organización. */
export interface EscalonEscala {
  escalon: number
  porcentaje: number
}

/**
 * Lo que la vista `v_seguimiento_rag_actual` entrega para un vencimiento.
 * Todo nullable: la vista devuelve NULL cuando no hay evidencia, y esa
 * ausencia es información, no un cero.
 */
export interface EntradaSeguimiento {
  estado: string | null
  velocidadObservada: number | null
  /** La de hoy: con el stock comprometido de hoy y la ventana de hoy. */
  velocidadNecesaria: number | null
  diasComercialesRestantes: number | null
  /** Días entre el RAG vigente y la última observación posterior. */
  diasObservados: number | null
  /** Días desde el último cambio de RAG. Insumo del enfriamiento. */
  diasDesdeUltimoRag: number | null
  ragPorcentaje: number | null
}

export type MotivoSinSugerencia =
  | 'sin_rag'
  | 'rag_efectivo'
  | 'ventana_cerrada'
  | 'sin_observacion_posterior'
  | 'ventana_no_observable'
  | 'enfriamiento'
  | 'tope_de_escala'
  | 'sin_escala'
  | 'datos_insuficientes'

export interface Sugerencia {
  hay: boolean
  motivo: MotivoSinSugerencia | null
  cobertura: number | null
  escalones: number
  desde: number | null
  hasta: number | null
  /** Velocidad observada ≤ 0: no es "poco", es nada. Se marca aparte. */
  sinMovimiento: boolean
  /**
   * Cuántas veces hay que multiplicar la salida actual para llegar al ritmo
   * requerido. Es 1/cobertura. Se muestra, no se usa para inflar el salto.
   */
  factorRequerido: number | null
  /**
   * El salto propuesto llega al tope de la escala y aun así la cobertura sigue
   * por debajo de 1. Mostrar el límite es honesto; inventar un salto mayor no.
   */
  topeInsuficiente: boolean
  /**
   * El déficit es severo —sin movimiento, o cobertura por debajo de
   * `DEFICIT_SEVERO`— y un solo escalón probablemente no lo cierre.
   *
   * Es un AVISO, no una predicción: Noven no modela cuánto acelera la salida un
   * punto más de descuento, y no va a fingir que sí. Lo honesto es mostrar el
   * límite y que decida el operador; saltar dos por cuenta propia no lo sería.
   */
  saltoPuedeNoAlcanzar: boolean
}

/** Estados en los que la ventana comercial ya no admite intervención comercial. */
const ESTADOS_VENTANA_CERRADA = new Set(['donacion', 'decomiso'])

/** Estados en los que el RAG está cumpliendo: no se sugiere nada. */
const ESTADOS_EFECTIVOS = new Set(['efectivo', 'efectivo_por_vmd'])

/** Estados que habilitan evaluar un escalamiento. */
const ESTADOS_ESCALABLES = new Set(['insuficiente', 'sin_movimiento'])

function finito(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function sinSugerencia(motivo: MotivoSinSugerencia, cobertura: number | null = null): Sugerencia {
  return {
    hay: false,
    motivo,
    cobertura,
    escalones: 0,
    desde: null,
    hasta: null,
    sinMovimiento: false,
    factorRequerido: null,
    topeInsuficiente: false,
    saltoPuedeNoAlcanzar: false,
  }
}

/**
 * cobertura = velocidad_observada / velocidad_necesaria.
 *
 * `null` cuando no se puede calcular. Una necesaria de 0 o negativa significa
 * que ya no hay ventana comercial: ahí la cobertura no está definida, y
 * devolver Infinity haría que un producto fuera de ventana pareciera cubierto.
 */
export function calcularCobertura(
  velocidadObservada: number | null,
  velocidadNecesaria: number | null,
): number | null {
  if (!finito(velocidadObservada) || !finito(velocidadNecesaria)) return null
  if (velocidadNecesaria <= 0) return null
  return velocidadObservada / velocidadNecesaria
}

/**
 * Debajo de esta cobertura el déficit es SEVERO.
 *
 * Era el corte entre subir uno y subir dos. Ya no decide el salto —siempre se
 * sube de a uno— pero sigue siendo el umbral a partir del cual conviene avisar
 * que el escalón siguiente probablemente no alcance. El número no se inventó
 * acá: se hereda de la regla anterior.
 */
const DEFICIT_SEVERO = 0.5

/**
 * Cuántos escalones subir según la cobertura. SIEMPRE UNO.
 *
 * La regla de dos escalones se diseñó para una escala de incrementos parejos de
 * diez, donde saltar dos era subir veinte puntos. Con una escala de saltos
 * desiguales —20/30/50/70— subir dos desde 30 es ir a 70: cuarenta puntos de
 * una, que es regalar el producto en un paso.
 *
 * Y no se pierde capacidad de reacción, porque EL TIEMPO YA ESTÁ EN EL CÁLCULO:
 * si el producto sigue sin moverse, en el próximo control la ventana es más
 * corta, `velocidad_necesaria` sube, la cobertura cae más y vuelve a sugerir.
 * De 30 se pasa a 50, y si no alcanza, a 70 — pasando por el 50 siempre, que es
 * justamente lo que un salto doble se saltea.
 *
 * Sin movimiento (observada ≤ 0) también sube uno, pero se marca aparte: no es
 * "poco", es nada, y la conversación con el operador es distinta.
 */
export function escalonesPorCobertura(
  cobertura: number | null,
  velocidadObservada: number | null,
): number {
  if (finito(velocidadObservada) && velocidadObservada <= 0) return 1
  if (!finito(cobertura)) return 0
  if (cobertura >= 1) return 0
  return 1
}

/**
 * Ventana mínima observable: `dias × velocidad_necesaria >= 1`.
 *
 * Si un producto necesita mover 0,3 por día y pasó un día, no se puede
 * distinguir "no se vende" de la granularidad del inventario. Con esta guarda,
 * un SKU lento espera y uno rápido no: el umbral se adapta solo al ritmo que el
 * producto necesita, en vez de fijar un número de días igual para todos.
 */
export function ventanaObservable(
  dias: number | null,
  velocidadNecesaria: number | null,
): boolean {
  if (!finito(dias) || !finito(velocidadNecesaria)) return false
  return dias * velocidadNecesaria >= 1
}

/**
 * Sube `escalones` peldaños desde el porcentaje vigente, dentro de la escala.
 *
 * Si el porcentaje vigente no está en la escala —la operación pudo haber
 * cargado uno a mano— se ancla en el peldaño más alto que no lo supere. Nunca
 * devuelve un valor fuera de la escala.
 */
export function subirEscalones(
  escala: EscalonEscala[],
  porcentajeActual: number,
  escalones: number,
): number | null {
  if (escala.length === 0) return null

  const ordenada = [...escala].sort((a, b) => a.porcentaje - b.porcentaje)
  const tope = ordenada[ordenada.length - 1]

  if (porcentajeActual >= tope.porcentaje) return null

  let indice = -1
  for (let i = 0; i < ordenada.length; i += 1) {
    if (ordenada[i].porcentaje <= porcentajeActual) indice = i
  }

  const destino = Math.min(indice + escalones, ordenada.length - 1)
  const porcentaje = ordenada[destino].porcentaje
  return porcentaje > porcentajeActual ? porcentaje : null
}

/**
 * Evalúa si corresponde sugerir un escalamiento, y de qué tamaño.
 *
 * El orden de las guardas importa: primero lo que cierra la puerta por completo
 * (ventana cerrada, RAG cumpliendo), después lo que sólo dice "todavía no"
 * (falta observación, falta ventana, enfriamiento). Un `motivo` de la segunda
 * clase no es un problema: es el sistema absteniéndose con razón.
 */
export function evaluarSugerencia(
  entrada: EntradaSeguimiento,
  escala: EscalonEscala[],
): Sugerencia {
  const { estado } = entrada

  if (estado && ESTADOS_VENTANA_CERRADA.has(estado)) return sinSugerencia('ventana_cerrada')
  if (!finito(entrada.diasComercialesRestantes) || entrada.diasComercialesRestantes <= 0) {
    return sinSugerencia('ventana_cerrada')
  }
  if (estado === 'sin_rag' || !finito(entrada.ragPorcentaje)) return sinSugerencia('sin_rag')
  if (estado && ESTADOS_EFECTIVOS.has(estado)) return sinSugerencia('rag_efectivo')

  // Guarda 1 · Sin observación posterior al RAG el estado es "pendiente de
  // control", no "RAG fallido". Es la regla §6.4 del documento de riesgo, y la
  // diferencia entre pedir un control y acusar a una intervención que nadie
  // midió.
  if (!estado || !ESTADOS_ESCALABLES.has(estado)) {
    return sinSugerencia('sin_observacion_posterior')
  }
  if (!finito(entrada.velocidadObservada) || !finito(entrada.velocidadNecesaria)) {
    return sinSugerencia('datos_insuficientes')
  }

  const cobertura = calcularCobertura(entrada.velocidadObservada, entrada.velocidadNecesaria)

  // Guarda 2 · Ventana mínima observable, medida sobre la observación.
  if (!ventanaObservable(entrada.diasObservados, entrada.velocidadNecesaria)) {
    return sinSugerencia('ventana_no_observable', cobertura)
  }

  // Guarda 3 · Enfriamiento. La misma ventana mínima, pero contada desde el
  // último cambio de RAG y no desde la última observación: si no, se sugiere 30
  // el lunes y 40 el martes sin haberle dado chance al 30.
  if (!ventanaObservable(entrada.diasDesdeUltimoRag, entrada.velocidadNecesaria)) {
    return sinSugerencia('enfriamiento', cobertura)
  }

  const sinMovimiento = entrada.velocidadObservada <= 0
  const escalones = escalonesPorCobertura(cobertura, entrada.velocidadObservada)
  if (escalones === 0) return sinSugerencia('rag_efectivo', cobertura)

  if (escala.length === 0) return sinSugerencia('sin_escala', cobertura)

  const desde = entrada.ragPorcentaje
  const hasta = subirEscalones(escala, desde, escalones)
  if (hasta == null) return sinSugerencia('tope_de_escala', cobertura)

  const ordenada = [...escala].sort((a, b) => a.porcentaje - b.porcentaje)
  const tope = ordenada[ordenada.length - 1].porcentaje

  return {
    hay: true,
    motivo: null,
    cobertura,
    escalones,
    desde,
    hasta,
    sinMovimiento,
    factorRequerido: finito(cobertura) && cobertura > 0 ? 1 / cobertura : null,
    // El salto llega al tope y la cobertura sigue por debajo de 1: aun con el
    // descuento máximo autorizado, el ritmo actual no alcanza la ventana.
    topeInsuficiente: hasta >= tope && finito(cobertura) && cobertura < 1,
    saltoPuedeNoAlcanzar: sinMovimiento || (finito(cobertura) && cobertura < DEFICIT_SEVERO),
  }
}

/** Cobertura como porcentaje entero, para mostrar. `null` se muestra como '—'. */
export function coberturaComoPorcentaje(cobertura: number | null): string {
  if (!finito(cobertura)) return '—'
  return `${Math.round(cobertura * 100)}%`
}
