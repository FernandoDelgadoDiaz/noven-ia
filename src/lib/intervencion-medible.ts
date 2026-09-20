// QUÉ SE ESTÁ MIDIENDO, DECLARADO UNA SOLA VEZ.
//
// EL HUECO QUE ESTE MÓDULO CIERRA. La oferta central se registraba y no se
// evaluaba: la tarjeta decía «Oferta central activa» y nada más, sin cobertura
// ni velocidad. El cálculo estaba —`v_seguimiento_rag_actual` mide el primer
// tramo abierto SIN filtrar por tipo, como se decidió en el bloque B— pero tres
// lugares distintos de la interfaz usaban `rag_porcentaje != null` como si
// fuera «¿hay algo que medir?», y no lo es: eso lo dice el tramo.
//
// POR QUÉ IMPORTA, Y NO ES SÓLO LA MALA NOTICIA. Lo que primero se ve es que
// una oferta central que no mueve el producto pasa desapercibida. Pero el caso
// real que lo destapó iba a 2,47 veces la velocidad que necesitaba: la oferta
// estaba funcionando muy bien y el sistema tampoco lo mostraba. Y ahí está el
// costo mayor: sin esa medición alguien puede ponerle un RAG encima a un
// producto que se vende solo, y regalar margen sin motivo.
//
// ESCONDER «FUNCIONA» CUESTA TANTO COMO ESCONDER «NO FUNCIONA», y en plata
// probablemente más.

import type { EstadoSeguimientoRag } from '@/types/index'

/** Lo mínimo que hace falta para saber qué se mide; cada pantalla ya lo tiene. */
export interface TramoVisible {
  ragPorcentaje: number | null
  hayOfertaCentral: boolean
}

export type TipoTramo = 'rag' | 'oferta_central' | 'ambos'

/**
 * Hay algo que medir cuando hay un tramo abierto, de cualquier tipo.
 *
 * El criterio anterior —«tiene RAG»— dejaba afuera a la oferta central, que es
 * una intervención igual de medible: cambia el precio en góndola y el motor
 * mide su ventana como la de cualquier otro tramo.
 */
export function hayTramoAbierto(tramo: TramoVisible): boolean {
  return tipoTramo(tramo) !== null
}

export function tipoTramo(tramo: TramoVisible): TipoTramo | null {
  const conRag = tramo.ragPorcentaje != null && tramo.ragPorcentaje > 0
  if (conRag && tramo.hayOfertaCentral) return 'ambos'
  if (conRag) return 'rag'
  if (tramo.hayOfertaCentral) return 'oferta_central'
  return null
}

/**
 * Cómo se nombra la intervención en una frase, según lo que hay abierto.
 *
 * Con las dos abiertas se dice «la intervención» y no una de las dos: la
 * medición es del efecto combinado y atribuirla a una sería afirmar de más.
 * Es la misma razón por la que la vista marca `medicion_atribuible = false`.
 */
export function nombreTramo(tipo: TipoTramo): string {
  if (tipo === 'rag') return 'RAG'
  if (tipo === 'oferta_central') return 'Oferta central'
  return 'Intervención'
}

/**
 * ETIQUETA DE ESTADO, POR TIPO. Las etiquetas decían «RAG» en todos los casos
 * —«RAG efectivo», «RAG insuficiente»—, así que destapar el filtro sin tocarlas
 * habría hecho que el modal dijera «RAG efectivo» sobre un producto SIN RAG.
 * Pasar de no informar a informar mal es peor que el hueco original.
 */
export function etiquetaEstadoTramo(
  estado: EstadoSeguimientoRag,
  tipo: TipoTramo | null,
): string {
  const nombre = tipo ? nombreTramo(tipo) : 'Intervención'
  switch (estado) {
    case 'decomiso': return 'Producto vencido'
    case 'donacion': return 'En ventana de donación'
    // Sin tramo abierto no hay nada medido, y tampoco hay de qué. Son dos
    // situaciones distintas y no pueden verse igual: ver abajo.
    case 'sin_rag': return 'Sin intervención registrada'
    case 'pendiente_control_operador': return 'Pendiente de nuevo control'
    case 'ventana_insuficiente': return 'Ventana todavía corta para medir'
    case 'dato_a_revisar': return 'Cantidad a revisar'
    case 'sin_movimiento': return 'Sin movimiento'
    // «Oferta central» es femenino; concordar con un replace sobre el texto ya
    // armado se rompe en cuanto alguien cambie una palabra.
    case 'efectivo': return tipo === 'oferta_central' ? 'Oferta central efectiva' : `${nombre} efectivo`
    case 'insuficiente': return `${nombre} insuficiente`
    default: return estado
  }
}

/**
 * Qué hacer con lo medido, para una intervención SIN RAG.
 *
 * La salida es binaria a propósito: con oferta central no hay escalones que
 * sugerir porque el porcentaje no lo maneja la sucursal. Funciona, o no
 * funciona y entonces corresponde evaluar un RAG encima.
 *
 * `null` significa «todavía no hay nada que decir», que NO es lo mismo que
 * «nada que hacer»: un tramo recién abierto sin control posterior es un estado
 * legítimo y la pantalla tiene que nombrarlo, no mostrar celdas vacías.
 */
export function salidaOfertaCentral(estado: EstadoSeguimientoRag): string | null {
  switch (estado) {
    case 'efectivo':
      return 'Está funcionando: no hace falta agregar RAG.'
    case 'insuficiente':
    case 'sin_movimiento':
      return 'No está alcanzando: evaluá agregar RAG encima.'
    case 'pendiente_control_operador':
      return 'Todavía no hay un control posterior al inicio: registrá uno para poder medirla.'
    case 'ventana_insuficiente':
      return 'Lleva muy poco tiempo para medirla; el próximo control ya va a alcanzar.'
    case 'dato_a_revisar':
      return 'La cantidad observada subió respecto del inicio: revisá el dato antes de decidir.'
    default:
      return null
  }
}
