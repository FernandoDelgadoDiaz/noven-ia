import type { Producto, RiesgoNivel, Vencimiento, VencimientoConRiesgo } from '@/types/index'
import {
  calcularMetricasRiesgo,
  calcularNivelRiesgo,
  diasDonacionLegacyPorSector,
  sugerirAcciones,
} from '@/lib/riesgo'

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
 * El riesgo se evalúa contra la ventana comercial real, no contra el día cero:
 *   - RADAR: <=45 días y la venta proyectada no llega antes del retiro/donación.
 *   - URGENTE: <=20 días y el riesgo persiste.
 *   - DONACIÓN: umbral obligatorio del sector (2 o 10 días actualmente).
 *   - DECOMISO: vencido.
 *
 * La cantidad evaluada es el stock comprometido del vencimiento/lote, no el
 * stock total de Glaciar.
 */
export function calcularRiesgo(
  v: Vencimiento,
  p: Producto,
  hoy: Date,
): VencimientoConRiesgo {
  const diasRestantes = diasHastaVencimiento(v.fecha_vencimiento, hoy)
  const diasDonacion = v.dias_donacion ?? diasDonacionLegacyPorSector(p.sector)

  const metricas = calcularMetricasRiesgo(
    diasRestantes,
    v.cantidad,
    p.venta_media_diaria,
    diasDonacion,
  )

  const nivel_riesgo: RiesgoNivel = calcularNivelRiesgo(
    diasRestantes,
    v.cantidad,
    p.venta_media_diaria,
    diasDonacion,
  )

  const acciones_sugeridas = sugerirAcciones(nivel_riesgo)

  return {
    ...v,
    producto: p,
    dias_restantes: diasRestantes,
    cobertura_dias: metricas.dias_stock,
    dias_donacion: diasDonacion,
    dias_comerciales_restantes: metricas.dias_comerciales_restantes,
    velocidad_necesaria: metricas.velocidad_necesaria,
    nivel_riesgo,
    acciones_sugeridas,
  }
}
