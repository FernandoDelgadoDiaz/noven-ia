// ¿Esta caída de stock amerita preguntar por su causa?
//
// Determinística y pura: mismas entradas, misma salida, sin red y sin reloj
// propio. La regla vive acá y no en SQL para no tenerla escrita en dos
// lenguajes; la base aporta los insumos y no decide.
//
// PARA QUÉ EXISTE
//
// El motor lee toda caída de stock comprometido como venta. Cuando no lo fue
// —una transferencia a otra sucursal, una rotura— la velocidad observada queda
// inflada y contamina la cobertura de hoy y el histórico de mañana.
//
// POR QUÉ LA REFERENCIA ES `velocidadNecesaria` Y NO LA VMD DE GLACIAR
//
// Se midieron los 44 tramos entre controles consecutivos con caída en
// producción. La VMD de Glaciar está entre 0,06 y 0,74 unidades por día, y
// TODOS los movimientos legítimos la superan: de 6× a 343×.
//
// No es un problema de calibración sino de significado. La VMD describe cómo se
// mueve el producto SIN intervención, y todo el propósito de un RAG o de una
// oferta central es superarla por mucho. Un umbral sobre la VMD dispararía
// justo cuando la intervención funciona: preguntaría en cada éxito.
//
// La velocidad necesaria sí separa. Los movimientos legítimos del producto del
// caso real quedan en 2,0× / 3,1× / 3,5×, y la transferencia conocida en 19,0×.

import { ventanaObservable } from './ragCobertura'

/** Lo que `public.contexto_salida_control(...)` entrega para un control. */
export interface ContextoSalida {
  /** Cantidad comprometida en el control anterior. `null` si no hubo. */
  cantidadPrevia: number | null
  cantidadActual: number | null
  /** Caída desde el control previo. La calcula el servidor. */
  bajada: number | null
  /** Días entre el control previo y éste. */
  dias: number | null
  velocidadNecesaria: number | null
  /** Múltiplo de la velocidad necesaria a partir del cual se pregunta. */
  umbral: number | null
  /** Si ya se declaró algo sobre esta caída. */
  yaDeclarada: boolean
}

export type MotivoSinPregunta =
  | 'sin_control_previo'
  | 'sin_caida'
  | 'ventana_no_observable'
  | 'velocidad_normal'
  | 'ya_declarada'
  | 'datos_insuficientes'

export interface Decision {
  preguntar: boolean
  motivo: MotivoSinPregunta | null
  /** Unidades de la caída, para mostrarle al operador lo que no tuvo que calcular. */
  bajada: number | null
  velocidadObservada: number | null
  /** Cuántas veces la necesaria. Para el informe, no para el operador. */
  multiplo: number | null
}

const finito = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v)

const sinPregunta = (
  motivo: MotivoSinPregunta,
  bajada: number | null = null,
  velocidadObservada: number | null = null,
  multiplo: number | null = null,
): Decision => ({ preguntar: false, motivo, bajada, velocidadObservada, multiplo })

/**
 * Decide si corresponde preguntarle al operador por la causa de una caída.
 *
 * El orden de las guardas no es casual: primero lo que hace imposible la
 * pregunta —no hay contra qué comparar, no hubo caída—, después lo que la
 * haría ruido, y recién al final el umbral.
 */
export function evaluarSalidaAnomala(ctx: ContextoSalida): Decision {
  // Guarda 1 · Sin control previo no hay caída que atribuir.
  //
  // En producción los veinte vencimientos activos tienen al menos un control,
  // porque la carga inicial genera uno. Pero nada en el esquema lo garantiza, y
  // nueve de los treinta y siete históricos no lo tienen. No se inventa una
  // referencia con `vencimientos.cantidad`: esa columna la muta cada control,
  // así que no es historia.
  if (!finito(ctx.cantidadPrevia) || !finito(ctx.dias)) {
    return sinPregunta('sin_control_previo')
  }

  // Guarda 2 · Sin caída no hay nada que explicar. Que el stock suba es otro
  // problema —el estado `dato_a_revisar` del motor— y no se resuelve acá.
  if (!finito(ctx.bajada) || ctx.bajada <= 0) return sinPregunta('sin_caida')

  if (!finito(ctx.velocidadNecesaria) || !finito(ctx.umbral)) {
    return sinPregunta('datos_insuficientes', ctx.bajada)
  }

  // Guarda 3 · Ventana mínima observable, la misma del motor de cobertura.
  //
  // Sin este piso la pregunta sería inútil: dos controles con minutos de
  // diferencia dan velocidades diarias enormes. En producción hay tramos de
  // 0,001 días que arrojan 117.987 unidades/día. La guarda se adapta al ritmo
  // que el producto necesita en vez de fijar un número de días igual para
  // todos, y por sí sola descarta 33 de los 44 tramos con caída.
  if (!ventanaObservable(ctx.dias, ctx.velocidadNecesaria)) {
    return sinPregunta('ventana_no_observable', ctx.bajada)
  }

  const velocidadObservada = ctx.bajada / ctx.dias
  const multiplo = velocidadObservada / ctx.velocidadNecesaria

  if (multiplo < ctx.umbral) {
    return sinPregunta('velocidad_normal', ctx.bajada, velocidadObservada, multiplo)
  }

  // Guarda 4 · Ya declarada. Va ÚLTIMA a propósito: así el informe puede
  // distinguir "no se preguntó porque no correspondía" de "correspondía y ya
  // se respondió", que para el histórico no es lo mismo.
  if (ctx.yaDeclarada) {
    return sinPregunta('ya_declarada', ctx.bajada, velocidadObservada, multiplo)
  }

  return { preguntar: true, motivo: null, bajada: ctx.bajada, velocidadObservada, multiplo }
}

/** Las causas que el operador puede declarar, en el orden en que se muestran. */
export const CAUSAS_NO_VENTA = [
  { valor: 'venta', etiqueta: 'Sí, se vendió' },
  { valor: 'transferencia', etiqueta: 'Hubo transferencia' },
  { valor: 'rotura', etiqueta: 'Rotura' },
  { valor: 'decomiso_parcial', etiqueta: 'Baja / decomiso parcial' },
  { valor: 'no_declarado', etiqueta: 'No sé' },
] as const

export type RespuestaNoVenta = (typeof CAUSAS_NO_VENTA)[number]['valor']
