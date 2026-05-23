// Única fuente de verdad para configuración visual de niveles de riesgo.
// Importar desde aquí en TODOS los componentes. No definir colores de riesgo en otro lugar.

import type { RiesgoNivel } from '@/types/index'

export type { RiesgoNivel }

export interface RiskVisual {
  label: string
  // Card row: fondo leve para diferenciar urgencia
  rowBg: string
  // Barra lateral izquierda (acento de color en AlertaItem)
  accentBar: string
  // Badge/chip (texto de nivel)
  badge: string
  // Dot semáforo
  dot: string
  dotPulse: boolean
  // Color del texto de días restantes
  daysText: string
  // Stat cards (dashboard RiesgoCard)
  statValueText: string
  statBg: string
  statIconColor: string
  statIconBg: string
  // Orden de prioridad visual (0 = más urgente)
  priority: number
}

export const RISK_VISUAL: Record<RiesgoNivel, RiskVisual> = {
  decomiso: {
    label: 'Decomiso',
    rowBg: 'bg-red-50',
    accentBar: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 border border-red-200',
    dot: 'bg-red-500',
    dotPulse: true,
    daysText: 'text-red-600',
    statValueText: 'text-red-600',
    statBg: 'bg-red-50',
    statIconColor: 'text-red-500',
    statIconBg: 'bg-red-100',
    priority: 0,
  },
  donacion: {
    label: 'Donación',
    rowBg: 'bg-rose-50/70',
    accentBar: 'bg-red-400',
    badge: 'bg-rose-50 text-rose-600 border border-rose-200',
    dot: 'bg-red-400',
    dotPulse: true,
    daysText: 'text-rose-600',
    statValueText: 'text-rose-600',
    statBg: 'bg-rose-50',
    statIconColor: 'text-rose-500',
    statIconBg: 'bg-rose-100',
    priority: 1,
  },
  urgente: {
    label: 'Urgente',
    rowBg: 'bg-orange-50/60',
    accentBar: 'bg-orange-400',
    badge: 'bg-orange-50 text-orange-700 border border-orange-200',
    dot: 'bg-orange-400',
    dotPulse: false,
    daysText: 'text-orange-600',
    statValueText: 'text-orange-600',
    statBg: 'bg-orange-50',
    statIconColor: 'text-orange-500',
    statIconBg: 'bg-orange-100',
    priority: 2,
  },
  radar: {
    label: 'Radar',
    rowBg: 'bg-amber-50/50',
    accentBar: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-400',
    dotPulse: false,
    daysText: 'text-amber-600',
    statValueText: 'text-amber-600',
    statBg: 'bg-amber-50',
    statIconColor: 'text-amber-500',
    statIconBg: 'bg-amber-100',
    priority: 3,
  },
  seguro: {
    label: 'Seguro',
    rowBg: 'bg-white',
    accentBar: 'bg-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-400',
    dotPulse: false,
    daysText: 'text-emerald-600',
    statValueText: 'text-emerald-600',
    statBg: 'bg-emerald-50',
    statIconColor: 'text-emerald-500',
    statIconBg: 'bg-emerald-100',
    priority: 4,
  },
}
