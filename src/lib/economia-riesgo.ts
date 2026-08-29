export interface RiesgoEconomicoInput {
  cantidad: number
  venta_media_diaria: number
  dias_comerciales_restantes: number
}

/**
 * Unidades que, manteniendo la VMD actual, no llegarían a venderse antes del
 * retiro comercial. No redondeamos: la regla de riesgo tampoco usa floor.
 */
export function calcularUnidadesExpuestas(input: RiesgoEconomicoInput): number {
  const cantidad = Math.max(0, Number(input.cantidad) || 0)
  const vmd = Math.max(0, Number(input.venta_media_diaria) || 0)
  const dias = Math.max(0, Number(input.dias_comerciales_restantes) || 0)
  return Math.max(cantidad - (vmd * dias), 0)
}

/** Valor económico normativo de Noven: costo unitario sin IVA observado en 0258. */
export function calcularCostoEnRiesgo(unidadesExpuestas: number, costoUnitarioSinIva: number): number {
  const unidades = Math.max(0, Number(unidadesExpuestas) || 0)
  const costo = Math.max(0, Number(costoUnitarioSinIva) || 0)
  return unidades * costo
}

export function formatearUnidades(valor: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(valor)
}

export function formatearPesos(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor)
}
