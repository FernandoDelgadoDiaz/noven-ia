import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CORPUS_PATH = path.join(HERE, 'corpus-v1.json')

const formatNumber = (value) => new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 2,
}).format(value)

const formatMoney = (value) => `$ ${formatNumber(value)}`

const riskForProduct = (product) => {
  const units = Math.max(
    product.quantity_committed - product.historical_vmd * product.commercial_days,
    0,
  )
  return {
    units,
    amount: units * product.unit_cost_without_tax,
  }
}

const comparison = (current, previous, unit) => {
  const delta = current - previous
  if (previous === 0) {
    return `${formatNumber(current)} ${unit}; sin base previa distinta de cero para calcular variación porcentual.`
  }
  const percentage = (delta / previous) * 100
  const sign = percentage > 0 ? '+' : ''
  return `${formatNumber(current)} ${unit} vs ${formatNumber(previous)} ${unit} (${sign}${formatNumber(percentage)}%).`
}

const resultBlock = (period) => [
  period.label,
  `Ventana: ${period.start} a ${period.end} (${period.calendar_days} días calendario).`,
  `Unidades recuperadas por venta: ${formatNumber(period.recovered_units)}.`,
  `$ protegidos/recuperados a costo s/IVA: ${formatMoney(period.protected_amount)}.`,
  `Unidades perdidas: ${formatNumber(period.lost_units)}.`,
  `$ perdidos a costo s/IVA: ${formatMoney(period.lost_amount)}.`,
].join('\n')

export const loadCorpus = () => JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'))

export const renderCase = (testCase) => {
  const currentProducts = testCase.products.filter((product) => product.appears_current_window)
  const activeProducts = currentProducts.filter((product) => product.level !== 'seguro')
  const risks = activeProducts.map((product) => ({ product, ...riskForProduct(product) }))
  const totalUnits = risks.reduce((sum, item) => sum + item.units, 0)
  const totalAmount = risks.reduce((sum, item) => sum + item.amount, 0)

  const productLines = currentProducts.map((product) => {
    const risk = riskForProduct(product)
    const active = product.level !== 'seguro'
    const riskPercentage = product.quantity_committed > 0
      ? (risk.units / product.quantity_committed) * 100
      : 0
    const action = product.level === 'donacion'
      ? 'Retirar de venta y gestionar donación hoy según política.'
      : product.level === 'urgente'
        ? 'Intervención inmediata y control físico hoy; no anticipar donación.'
        : product.level === 'radar'
          ? 'Revisar la intervención correspondiente hoy y monitorear la cantidad comprometida.'
          : 'Seguimiento normal; sin intervención extraordinaria.'

    return [
      `Producto: ${product.description} — ${product.brand} | Gramaje: ${product.weight} | Interno: ${product.id} | EAN: ${product.ean}`,
      `Nivel: ${product.level.toUpperCase()}`,
      `Cantidad comprometida: ${formatNumber(product.quantity_committed)} | VMD histórica: ${formatNumber(product.historical_vmd)} u/día | Días comerciales: ${product.commercial_days}`,
      active
        ? `En riesgo activo: ${formatNumber(risk.units)} un. (${formatNumber(riskPercentage)}%) | Costo unitario s/IVA: ${formatMoney(product.unit_cost_without_tax)} | Dinero en riesgo s/IVA: ${formatMoney(risk.amount)}`
        : 'Estado SEGURO: no integrar este artículo al total de riesgo activo ni indicar intervención extraordinaria.',
      `Acción determinística: ${action}`,
      'Noven no tiene RAG registrado. Esto no informa el estado de Glaciar; verificar allí si la acción lo requiere.',
    ].join('\n  ')
  })

  const currentIds = new Set(
    testCase.products.filter((product) => product.appears_current_window).map((product) => product.id),
  )
  const recurring = testCase.products.filter(
    (product) => currentIds.has(product.id) && product.appears_previous_window,
  )

  const historicalComparison = testCase.history.comparable
    ? [
        'Base comparable previa: SÍ. Las ventanas tienen igual cantidad de días calendario.',
        `Comparación recuperadas: ${comparison(testCase.history.current.recovered_units, testCase.history.previous.recovered_units, 'u')}`,
        `Comparación protegidos: ${comparison(testCase.history.current.protected_amount, testCase.history.previous.protected_amount, '$')}`,
        `Comparación perdidas: ${comparison(testCase.history.current.lost_units, testCase.history.previous.lost_units, 'u')}`,
        `Comparación $ perdidos: ${comparison(testCase.history.current.lost_amount, testCase.history.previous.lost_amount, '$')}`,
      ].join('\n')
    : 'Base comparable previa: NO. No hay cierres registrados en la ventana equivalente anterior. Prohibido afirmar porcentajes de mejora/deterioro contra el trimestre anterior.'

  return [
    `Fecha operacional: ${testCase.operational_date}`,
    `Sucursal analizada: ${testCase.store.code} · ${testCase.store.name}`,
    'Ámbito autorizado: toda la sucursal',
    '',
    '=== RESUMEN GERENCIAL DETERMINÍSTICO ===',
    `Productos con problema activo: ${activeProducts.length}`,
    `Unidades expuestas en problemas activos: ${formatNumber(totalUnits)}`,
    `$ en riesgo a costo s/IVA: ${formatMoney(totalAmount)}.`,
    '',
    '=== DETALLE DE VENCIMIENTOS ACTIVOS ===',
    productLines.join('\n\n'),
    '',
    '=== RESULTADO ECONÓMICO · VENTANAS EQUIVALENTES ===',
    resultBlock(testCase.history.current),
    '',
    resultBlock(testCase.history.previous),
    '',
    historicalComparison,
    '',
    'Productos recurrentes ENTRE ambas ventanas equivalentes:',
    recurring.length
      ? recurring.map((product) => `- ${product.description} | Interno: ${product.id}`).join('\n')
      : '- No hay recurrencia demostrable entre ambas ventanas con los datos comparables disponibles.',
    '',
    'Límite de inferencia: el trimestre actual está abierto y llega hasta hoy; no confundirlo con un trimestre completo. El conjunto contiene como máximo dos ventanas: no permite afirmar estacionalidad.',
  ].join('\n')
}

export const calculateGroundTruth = (testCase) => {
  const activeCurrent = testCase.products.filter(
    (product) => product.appears_current_window && product.level !== 'seguro',
  )
  const risks = activeCurrent.map(riskForProduct)
  const recurring = testCase.products
    .filter((product) => product.appears_current_window && product.appears_previous_window)
    .map((product) => product.id)
    .sort()
  const nonRecurring = testCase.products
    .filter((product) => product.appears_current_window !== product.appears_previous_window)
    .map((product) => product.id)
    .sort()

  return {
    risk_units: risks.reduce((sum, risk) => sum + risk.units, 0),
    risk_amount: risks.reduce((sum, risk) => sum + risk.amount, 0),
    comparable_window: testCase.history.comparable,
    quarter_state: 'open',
    recurring_product_ids: recurring,
    non_recurring_product_ids: nonRecurring,
  }
}
