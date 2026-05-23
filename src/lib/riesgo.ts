export type NivelRiesgo = 'seguro' | 'radar' | 'urgente' | 'donacion' | 'decomiso'

export interface BadgeConfig {
  label: string
  cls: string
}

export const BADGE_CONFIG: Record<NivelRiesgo, BadgeConfig> = {
  seguro:   { label: 'Seguro',   cls: 'bg-green-500/20 text-green-400 border border-green-500/40' },
  radar:    { label: 'Radar',    cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' },
  urgente:  { label: 'Urgente',  cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/40' },
  donacion: { label: 'Donación', cls: 'bg-red-500/20 text-red-400 border border-red-500/40' },
  decomiso: { label: 'Decomiso', cls: 'bg-gray-900/80 text-gray-300 border border-red-600/60' },
}

const UMBRAL_RADAR = 45      // días
const UMBRAL_URGENTE = 20    // días
const UMBRAL_DONACION = 10   // días

export function calcularDiasRestantes(fechaVencimiento: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vence = new Date(fechaVencimiento)
  vence.setHours(0, 0, 0, 0)
  return Math.floor((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

export function calcularDiasStock(stockActual: number, ventaMediaDiaria: number): number {
  if (ventaMediaDiaria <= 0) return Infinity
  return Math.floor(stockActual / ventaMediaDiaria)
}

export function calcularNivelRiesgo(
  diasRestantes: number,
  stockActual: number,
  ventaMediaDiaria: number,
): NivelRiesgo {
  const diasStock = calcularDiasStock(stockActual, ventaMediaDiaria)
  const hayRiesgoMerma = diasStock > diasRestantes

  if (diasRestantes <= 0) return 'decomiso'
  if (diasRestantes <= UMBRAL_DONACION) return 'donacion'
  if (diasRestantes <= UMBRAL_URGENTE && hayRiesgoMerma) return 'urgente'
  if (diasRestantes <= UMBRAL_RADAR && hayRiesgoMerma) return 'radar'
  return 'seguro'
}

export function sugerirAcciones(nivel: NivelRiesgo): string[] {
  switch (nivel) {
    case 'decomiso': return ['Retirar inmediatamente', 'Registrar decomiso']
    case 'donacion': return ['Retirar de góndola', 'Gestionar recupero por donación']
    case 'urgente': return ['Promoción agresiva', 'Mover a zona visible', 'Escalar a encargado']
    case 'radar': return ['Aplicar oferta próximo consumo', 'Monitorear diariamente']
    case 'seguro': return []
  }
}
