import type { Producto, RiesgoNivel, Vencimiento, VencimientoConRiesgo } from '@/types/index'

const MS_POR_DIA = 1000 * 60 * 60 * 24

/**
 * Calcula los días enteros que restan entre hoy (sin hora) y la fecha de vencimiento.
 * Puede ser negativo si el producto ya venció.
 */
function diasHastaVencimiento(fechaVencimiento: string, hoy: Date): number {
  const vence = new Date(fechaVencimiento + 'T00:00:00')
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.floor((vence.getTime() - base.getTime()) / MS_POR_DIA)
}

/**
 * Determina el nivel de riesgo basándose exclusivamente en días restantes.
 * La comparación con cobertura_dias es informativa; el nivel se basa en días.
 */
function resolverNivel(diasRestantes: number): RiesgoNivel {
  if (diasRestantes < 7) return 'critico'
  if (diasRestantes < 15) return 'alto'
  if (diasRestantes <= 30) return 'moderado'
  return 'seguro'
}

/**
 * Calcula el riesgo de merma para un vencimiento dado.
 *
 * cobertura_dias = stock_actual / venta_media_diaria
 * Si venta_media_diaria === 0, la cobertura es Infinity (no hay rotación).
 */
export function calcularRiesgo(
  v: Vencimiento,
  p: Producto,
  hoy: Date,
): VencimientoConRiesgo {
  const diasRestantes = diasHastaVencimiento(v.fecha_vencimiento, hoy)

  const cobertura_dias =
    p.venta_media_diaria > 0
      ? p.stock_actual / p.venta_media_diaria
      : Infinity

  const nivel_riesgo = resolverNivel(diasRestantes)
  const acciones_sugeridas = sugerirAcciones(nivel_riesgo, diasRestantes)

  return {
    ...v,
    producto: p,
    dias_restantes: diasRestantes,
    cobertura_dias,
    nivel_riesgo,
    acciones_sugeridas,
  }
}

/**
 * Devuelve acciones concretas según el nivel de riesgo y los días restantes.
 */
export function sugerirAcciones(nivel: RiesgoNivel, diasRestantes: number): string[] {
  switch (nivel) {
    case 'critico':
      return ['Liquidar precio', 'Mover a zona visible', 'Alertar encargado']

    case 'alto':
      return ['Promocionar 2x1', 'Revisar rotación']

    case 'moderado':
      return ['Monitorear semanalmente']

    case 'seguro':
      return []

    default: {
      // Exhaustive check: `nivel` is `never` here if all cases are covered
      const _exhaustive: never = nivel
      void _exhaustive
      void diasRestantes
      return []
    }
  }
}
