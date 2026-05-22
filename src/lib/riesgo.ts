export type NivelRiesgo = 'critico' | 'alto' | 'moderado' | 'seguro'

export interface BadgeConfig {
  label: string
  cls: string
}

export const BADGE_CONFIG: Record<NivelRiesgo, BadgeConfig> = {
  critico:  { label: 'CRÍTICO',  cls: 'bg-red-500/20 text-red-400 border border-red-500/40' },
  alto:     { label: 'ALTO',     cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/40' },
  moderado: { label: 'MODERADO', cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' },
  seguro:   { label: 'SEGURO',   cls: 'bg-green-500/20 text-green-400 border border-green-500/40' },
}

export function calcularDiasRestantes(fechaVencimiento: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vence = new Date(fechaVencimiento + 'T00:00:00')
  return Math.floor((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

export function calcularNivelRiesgo(
  diasRestantes: number,
  stockActual: number,
  ventaMediaDiaria: number,
): NivelRiesgo {
  const cobertura = ventaMediaDiaria > 0 ? stockActual / ventaMediaDiaria : Infinity
  if (cobertura > diasRestantes && diasRestantes >= 0) return 'critico'
  if (diasRestantes <= 3) return 'critico'
  if (diasRestantes <= 7) return 'alto'
  if (diasRestantes <= 15) return 'moderado'
  return 'seguro'
}
