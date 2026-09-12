// Orden, agrupación y exportación de la bandeja zonal de precios.
//
// Vive fuera del componente por dos razones. La primera es que el orden es un
// requisito del circuito, no una preferencia visual: la administrativa recorre
// dieciséis locales y una solicitud nueva tiene que caer dentro del bloque de
// su sucursal, nunca al final por haber llegado después. La segunda es que el
// archivo exportado tiene que coincidir exactamente con lo que muestra la
// pantalla, y eso sólo se puede probar si ambos salen de la misma función.
//
// El corte de jornada no se decide acá: llega resuelto por el servidor. La
// pantalla no puede mostrar —ni el archivo incluir— una solicitud diferida,
// porque la RPC no la devuelve.

import { construirXlsx, type CeldaXlsx, type HojaXlsx } from './xlsx'

export type EventoSolicitudRag = 'solicitada' | 'ejecutada' | 'no_aplicada'

export type EstadoSolicitudRag =
  | 'solicitada'
  | 'ejecutada_no_habilitada'
  | 'lista_confirmacion'
  | 'no_aplicada'

export interface ZonaBandeja {
  id: string
  codigo: string
  nombre: string
  organizacion_id: string
  jornada_inicio: string
  jornada_corte: string
  /** Jornada que la bandeja está mostrando; null mientras la ventana no abrió. */
  jornada_visible: string | null
  /** Jornada a la que se está asignando lo que se registra en este momento. */
  jornada_en_curso: string
  ventana_abierta: boolean
}

export interface SolicitudBandeja {
  id: string
  zona_id: string
  zona_nombre: string
  sucursal_id: string
  sucursal_codigo: string
  sucursal_nombre: string
  producto_codigo: string
  producto_descripcion: string
  sector_nombre: string
  familia_nombre: string
  porcentaje_rag_vigente: number | null
  porcentaje_solicitado: number
  fecha_vencimiento: string
  fin_accion: string
  cantidad_comprometida: number
  creada_at: string
  jornada_zonal: string
  ultimo_evento: EventoSolicitudRag
  ultimo_evento_at: string
  habilitada_desde: string | null
  estado_actual: EstadoSolicitudRag
  validada_por_nombre: string
  requiere_ejecucion: boolean
}

export interface BandejaZonal {
  ahora_argentina: string
  zonas: ZonaBandeja[]
  solicitudes: SolicitudBandeja[]
}

export interface GrupoSucursal {
  sucursal_id: string
  sucursal_codigo: string
  sucursal_nombre: string
  solicitudes: SolicitudBandeja[]
}

const ETIQUETAS_ESTADO: Record<EstadoSolicitudRag, string> = {
  solicitada: 'Pendiente de ejecución',
  ejecutada_no_habilitada: 'Ejecutada · disponible mañana',
  lista_confirmacion: 'Lista para verificar en góndola',
  no_aplicada: 'Informada como no aplicada',
}

export function etiquetaEstado(estado: EstadoSolicitudRag): string {
  return ETIQUETAS_ESTADO[estado] ?? estado
}

export function fechaCorta(valor: string | null): string {
  if (!valor) return ''
  const [anio, mes, dia] = valor.slice(0, 10).split('-')
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : valor
}

export function fechaHoraArgentina(valor: string): string {
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return ''
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha)
}

function comparar(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Orden estable del circuito: código de sucursal, luego sector y familia, luego
 * fin de acción, y recién al final la llegada. El servidor ya devuelve este
 * orden; se vuelve a aplicar acá para que el archivo no dependa de que el
 * cliente reciba el arreglo intacto.
 */
export function ordenarSolicitudes(solicitudes: SolicitudBandeja[]): SolicitudBandeja[] {
  return [...solicitudes].sort(
    (a, b) =>
      comparar(a.sucursal_codigo, b.sucursal_codigo) ||
      comparar(a.sector_nombre, b.sector_nombre) ||
      comparar(a.familia_nombre, b.familia_nombre) ||
      comparar(a.fin_accion, b.fin_accion) ||
      comparar(a.creada_at, b.creada_at) ||
      comparar(a.id, b.id),
  )
}

export function agruparPorSucursal(solicitudes: SolicitudBandeja[]): GrupoSucursal[] {
  const grupos = new Map<string, GrupoSucursal>()
  for (const solicitud of ordenarSolicitudes(solicitudes)) {
    const grupo = grupos.get(solicitud.sucursal_id)
    if (grupo) {
      grupo.solicitudes.push(solicitud)
      continue
    }
    grupos.set(solicitud.sucursal_id, {
      sucursal_id: solicitud.sucursal_id,
      sucursal_codigo: solicitud.sucursal_codigo,
      sucursal_nombre: solicitud.sucursal_nombre,
      solicitudes: [solicitud],
    })
  }
  return [...grupos.values()]
}

/**
 * Las dos fechas van separadas y con nombres distintos a propósito: «Vto
 * producto» es el vencimiento real y «Fin acción» el límite de la ventana
 * comercial. Confundirlas es el error que la columna existe para evitar.
 */
export const ENCABEZADOS_EXPORTACION = [
  'Sucursal',
  'Sector',
  'Familia',
  'Código',
  'Producto',
  'RAG actual',
  'Nueva RAG',
  'Vto producto',
  'Fin acción',
  'Stock comprometido',
  'Validado por',
  'Fecha de validación',
  'Estado',
] as const

export function filaExportacion(solicitud: SolicitudBandeja): CeldaXlsx[] {
  return [
    `${solicitud.sucursal_codigo} · ${solicitud.sucursal_nombre}`,
    solicitud.sector_nombre,
    solicitud.familia_nombre,
    solicitud.producto_codigo,
    solicitud.producto_descripcion,
    solicitud.porcentaje_rag_vigente == null ? 'Sin RAG' : Number(solicitud.porcentaje_rag_vigente),
    Number(solicitud.porcentaje_solicitado),
    fechaCorta(solicitud.fecha_vencimiento),
    fechaCorta(solicitud.fin_accion),
    Number(solicitud.cantidad_comprometida),
    solicitud.validada_por_nombre,
    fechaHoraArgentina(solicitud.creada_at),
    etiquetaEstado(solicitud.estado_actual),
  ]
}

export interface ExportacionBandeja {
  zona: ZonaBandeja
  /** null exporta la jornada visible completa de la zona. */
  sucursal: GrupoSucursal | null
  solicitudes: SolicitudBandeja[]
}

export function nombreHojaExportacion(exportacion: ExportacionBandeja): string {
  return exportacion.sucursal
    ? `Sucursal ${exportacion.sucursal.sucursal_codigo}`
    : `Zona ${exportacion.zona.codigo}`
}

export function nombreArchivoExportacion(exportacion: ExportacionBandeja): string {
  const jornada = (exportacion.zona.jornada_visible ?? exportacion.zona.jornada_en_curso).slice(0, 10)
  const alcance = exportacion.sucursal
    ? `sucursal-${exportacion.sucursal.sucursal_codigo}`
    : `zona-${exportacion.zona.codigo}`
  return `rag-${alcance}-${jornada}.xlsx`.replace(/\s+/g, '-').toLowerCase()
}

/**
 * El archivo conserva el orden y la agrupación de la pantalla: exportar la zona
 * entera produce bloques consecutivos por sucursal, no una lista revuelta.
 */
export function construirHojaExportacion(exportacion: ExportacionBandeja): HojaXlsx {
  const filas = agruparPorSucursal(exportacion.solicitudes).flatMap((grupo) =>
    grupo.solicitudes.map(filaExportacion),
  )
  return {
    nombre: nombreHojaExportacion(exportacion),
    encabezados: [...ENCABEZADOS_EXPORTACION],
    filas,
  }
}

export function exportarBandejaXlsx(exportacion: ExportacionBandeja): Uint8Array {
  return construirXlsx(construirHojaExportacion(exportacion))
}
