export type NivelRiesgo = 'seguro' | 'radar' | 'urgente' | 'donacion' | 'decomiso'

export interface BadgeConfig {
  label: string
  cls: string
}

export interface MetricasRiesgo {
  dias_stock: number
  dias_comerciales_restantes: number
  velocidad_necesaria: number
  hay_riesgo: boolean
}

export const BADGE_CONFIG: Record<NivelRiesgo, BadgeConfig> = {
  seguro:   { label: 'Seguro',   cls: 'bg-green-500/20 text-green-400 border border-green-500/40' },
  radar:    { label: 'Radar',    cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' },
  urgente:  { label: 'Urgente',  cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/40' },
  donacion: { label: 'Donación', cls: 'bg-red-500/20 text-red-400 border border-red-500/40' },
  decomiso: { label: 'Decomiso', cls: 'bg-gray-900/80 text-gray-300 border border-red-600/60' },
}

const UMBRAL_RADAR = 45
const UMBRAL_URGENTE = 20
export const UMBRAL_DONACION_LEGACY = 10

const SECTORES_PERECEDEROS_DOS_DIAS = new Set([
  'VERDULERIA',
  'VERDULERÍA',
  'CARNICERIA',
  'CARNICERÍA',
  'LACTEOS',
  'LÁCTEOS',
  'PANADERIA',
  'PANADERÍA',
  'ROTISERIA',
  'ROTISERÍA',
])

/**
 * Compatibilidad temporal mientras producción todavía no expone
 * sectores.dias_donacion. El origen autoritativo futuro es la DB.
 *
 * Congelados y todo no perecedero confirmado conservan 10 días. FIAMBRES e
 * INSUMOS también caen en 10 sólo como fallback técnico mientras su política
 * concreta no esté configurada en DB; no se persiste esa inferencia.
 */
export function diasDonacionLegacyPorSector(sector: string | null | undefined): number {
  const normalizado = (sector ?? '').trim().toUpperCase()
  return SECTORES_PERECEDEROS_DOS_DIAS.has(normalizado) ? 2 : UMBRAL_DONACION_LEGACY
}

export function calcularDiasRestantes(fechaVencimiento: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vence = new Date(fechaVencimiento)
  vence.setHours(0, 0, 0, 0)
  return Math.floor((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

export function calcularDiasStock(cantidadLote: number, ventaMediaDiaria: number): number {
  if (ventaMediaDiaria <= 0) return Infinity
  return cantidadLote / ventaMediaDiaria
}

/**
 * Tiempo comercial real disponible. El producto deja de estar vendible cuando
 * entra en la ventana obligatoria de donación (2 o 10 días según política).
 */
export function calcularDiasComercialesRestantes(
  diasRestantes: number,
  diasDonacion: number,
): number {
  return Math.max(0, diasRestantes - diasDonacion)
}

export function calcularVelocidadNecesaria(
  cantidadComprometida: number,
  diasRestantes: number,
  diasDonacion: number,
): number {
  if (cantidadComprometida <= 0) return 0
  const diasComerciales = calcularDiasComercialesRestantes(diasRestantes, diasDonacion)
  if (diasComerciales <= 0) return Infinity
  return cantidadComprometida / diasComerciales
}

export function calcularMetricasRiesgo(
  diasRestantes: number,
  cantidadLote: number,
  ventaMediaDiaria: number,
  diasDonacion: number = UMBRAL_DONACION_LEGACY,
): MetricasRiesgo {
  const diasStock = calcularDiasStock(cantidadLote, ventaMediaDiaria)
  const diasComerciales = calcularDiasComercialesRestantes(diasRestantes, diasDonacion)
  const velocidadNecesaria = calcularVelocidadNecesaria(cantidadLote, diasRestantes, diasDonacion)

  return {
    dias_stock: diasStock,
    dias_comerciales_restantes: diasComerciales,
    velocidad_necesaria: velocidadNecesaria,
    hay_riesgo: diasStock > diasComerciales,
  }
}

export function calcularNivelRiesgo(
  diasRestantes: number,
  cantidadLote: number,
  ventaMediaDiaria: number,
  diasDonacion: number = UMBRAL_DONACION_LEGACY,
): NivelRiesgo {
  if (diasRestantes <= 0) return 'decomiso'
  if (diasRestantes <= diasDonacion) return 'donacion'

  const { hay_riesgo: hayRiesgo } = calcularMetricasRiesgo(
    diasRestantes,
    cantidadLote,
    ventaMediaDiaria,
    diasDonacion,
  )

  if (diasRestantes <= UMBRAL_URGENTE && hayRiesgo) return 'urgente'
  if (diasRestantes <= UMBRAL_RADAR && hayRiesgo) return 'radar'
  return 'seguro'
}

export function sugerirAcciones(nivel: NivelRiesgo): string[] {
  switch (nivel) {
    case 'decomiso': return ['Retirar inmediatamente', 'Registrar decomiso']
    case 'donacion': return ['Retirar de góndola', 'Gestionar donación']
    case 'urgente': return ['Revisar RAG en Glaciar', 'Monitorear cantidad comprometida', 'Escalar a encargado']
    case 'radar': return ['Gestionar RAG en Glaciar', 'Monitorear cantidad comprometida']
    case 'seguro': return []
  }
}
