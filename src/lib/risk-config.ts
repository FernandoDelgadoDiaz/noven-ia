// Única fuente de verdad para configuración visual de niveles de riesgo.
// Importar desde aquí en TODOS los componentes. No definir colores de riesgo en otro lugar.

import type { RiesgoNivel } from '@/types/index'

export type { RiesgoNivel }

export interface RiskVisual {
  label: string
  rowBg: string
  accentBar: string
  badge: string
  dot: string
  dotPulse: boolean
  daysText: string
  statValueText: string
  statBg: string
  statIconColor: string
  statIconBg: string
  // V2: subtle card gradient for KPI cards
  cardGradient: string
  // V2: colored action chip styling for smart chips in AlertaItem
  actionChipCls: string
  priority: number
  // V3: border-left color class for AlertaItem card
  borderLeft: string
  // V3: solid badge background with white text
  badgeSolid: string
}

export const RISK_VISUAL: Record<RiesgoNivel, RiskVisual> = {
  decomiso: {
    label: 'Decomiso',
    rowBg: 'bg-red-50/80',
    accentBar: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 border border-red-200',
    dot: 'bg-red-500',
    dotPulse: true,
    daysText: 'text-red-600',
    statValueText: 'text-red-600',
    statBg: 'bg-red-50',
    statIconColor: 'text-red-500',
    statIconBg: 'bg-red-100',
    cardGradient: 'bg-gradient-to-br from-white to-red-50/60',
    actionChipCls: 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100',
    priority: 0,
    borderLeft: 'border-l-gray-700',
    badgeSolid: 'bg-gray-700',
  },
  donacion: {
    label: 'Donación',
    rowBg: 'bg-rose-50/60',
    accentBar: 'bg-red-400',
    badge: 'bg-rose-50 text-rose-600 border border-rose-200',
    dot: 'bg-red-400',
    dotPulse: true,
    daysText: 'text-rose-600',
    statValueText: 'text-rose-600',
    statBg: 'bg-rose-50',
    statIconColor: 'text-rose-500',
    statIconBg: 'bg-rose-100',
    cardGradient: 'bg-gradient-to-br from-white to-rose-50/50',
    actionChipCls: 'bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100',
    priority: 1,
    borderLeft: 'border-l-red-600',
    badgeSolid: 'bg-red-600',
  },
  urgente: {
    label: 'Urgente',
    rowBg: 'bg-orange-50/50',
    accentBar: 'bg-orange-400',
    badge: 'bg-orange-50 text-orange-700 border border-orange-200',
    dot: 'bg-orange-400',
    dotPulse: false,
    daysText: 'text-orange-600',
    statValueText: 'text-orange-600',
    statBg: 'bg-orange-50',
    statIconColor: 'text-orange-500',
    statIconBg: 'bg-orange-100',
    cardGradient: 'bg-gradient-to-br from-white to-orange-50/50',
    actionChipCls: 'bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100',
    priority: 2,
    borderLeft: 'border-l-orange-500',
    badgeSolid: 'bg-orange-500',
  },
  radar: {
    label: 'Radar',
    rowBg: 'bg-amber-50/40',
    accentBar: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-400',
    dotPulse: false,
    daysText: 'text-amber-600',
    statValueText: 'text-amber-600',
    statBg: 'bg-amber-50',
    statIconColor: 'text-amber-500',
    statIconBg: 'bg-amber-100',
    cardGradient: 'bg-gradient-to-br from-white to-amber-50/40',
    actionChipCls: 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100',
    priority: 3,
    borderLeft: 'border-l-amber-500',
    badgeSolid: 'bg-amber-500',
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
    cardGradient: 'bg-gradient-to-br from-white to-emerald-50/30',
    actionChipCls: 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100',
    priority: 4,
    borderLeft: 'border-l-emerald-500',
    badgeSolid: 'bg-emerald-500',
  },
}
