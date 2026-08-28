import type { Producto, RiesgoNivel, Vencimiento, VencimientoConRiesgo } from '@/types/index'
import {
  calcularMetricasRiesgo,
  calcularNivelRiesgo,
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
 * El riesgo se evalúa contra la ventana comercial real, no contra el día cero.
 * `dias_donacion` es obligatorio y proviene de la política configurada en DB.
 * Un sector sin política no debe llegar a este cálculo.
 */
export function calcularRiesgo(
  v: Vencimiento,
  p: Producto,
  hoy: Date,
): VencimientoConRiesgo {
  if (v.dias_donacion == null) {
    throw new Error('No se puede calcular riesgo sin política de vencimiento configurada.')
  }

  const diasRestantes = diasHastaVencimiento(v.fecha_vencimiento, hoy)
  const diasDonacion = v.dias_donacion

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
