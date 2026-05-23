import type { Producto, RiesgoNivel, Vencimiento, VencimientoConRiesgo } from '@/types/index'
import { calcularNivelRiesgo, sugerirAcciones } from '@/lib/riesgo'

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
 * Calcula el riesgo de merma para un vencimiento dado.
 *
 * cobertura_dias = stock_actual / venta_media_diaria
 * Si venta_media_diaria === 0, la cobertura es Infinity (no hay rotación).
 *
 * Semáforo de 5 niveles:
 *   decomiso  → diasRestantes <= 0
 *   donacion  → diasRestantes <= 10
 *   urgente   → diasRestantes <= 20 Y hayRiesgoMerma
 *   radar     → diasRestantes <= 45 Y hayRiesgoMerma
 *   seguro    → resto
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

  const nivel_riesgo: RiesgoNivel = calcularNivelRiesgo(
    diasRestantes,
    p.stock_actual,
    p.venta_media_diaria,
  )

  const acciones_sugeridas = sugerirAcciones(nivel_riesgo)

  return {
    ...v,
    producto: p,
    dias_restantes: diasRestantes,
    cobertura_dias,
    nivel_riesgo,
    acciones_sugeridas,
  }
}
