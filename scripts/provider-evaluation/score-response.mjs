const stripAccents = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const normalize = (value) => stripAccents(value.toLowerCase()).replace(/\s+/g, ' ').trim()

const numberForms = (value) => {
  const forms = new Set([
    String(value),
    new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value),
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value),
  ])
  if (Number.isInteger(value)) forms.add(String(Math.trunc(value)))
  return [...forms].map((form) => stripAccents(form.toLowerCase()))
}

const includesNumber = (text, value) => numberForms(value).some((form) => text.includes(form))

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const includesPercentage = (text, value) => numberForms(Math.abs(value)).some((form) => {
  const pattern = new RegExp(`(?:^|[^\\d])${escapeRegExp(form)}\\s*%(?:$|[^\\d])`)
  return pattern.test(text)
})

const sentences = (text) => text
  .split(/(?:\r?\n)+|(?<=[.!?;])\s+/)
  .map(normalize)
  .filter(Boolean)

const hasUnsupportedComparison = (text) => {
  const normalized = normalize(text)
  const forbidden = [
    /(?:mejoro|empeoro|aumento|disminuyo|subio|bajo|se redujo)\b.{0,80}(?:trimestre|periodo|ventana|anterior|previo)/,
    /(?:trimestre|periodo|ventana)\b.{0,80}(?:mejoro|empeoro|aumento|disminuyo|subio|bajo|se redujo)/,
    /(?:mejora|deterioro|variacion)\s+(?:de\s+)?[+-]?\d+(?:[.,]\d+)?\s*%/,
    /[+-]?\d+(?:[.,]\d+)?\s*%\s+(?:de\s+)?(?:mejora|deterioro|aumento|reduccion)/,
  ]
  return forbidden.some((pattern) => pattern.test(normalized))
}

const assertsSeasonality = (text) => sentences(text).some((sentence) => {
  if (!sentence.includes('estacional')) return false
  const caveat = /(?:no|sin|insuficient|faltan|hacen falta|no permite|no se puede|no puede|no demuestra|no confirma).{0,50}estacional|estacional.{0,50}(?:no|sin|insuficient|faltan|hacen falta|no permite|no se puede|no puede|no demuestra|no confirma)/.test(sentence)
  if (caveat) return false
  return /(?:patron estacional|estacionalidad|comportamiento estacional|es estacional|causa estacional)/.test(sentence)
})

const mentionsOpenQuarter = (text) => /(?:trimestre.{0,30}(?:abierto|en curso|hasta hoy|a la fecha)|(?:hasta hoy|a la fecha).{0,30}trimestre)/.test(normalize(text))

const callsQuarterClosed = (text) => sentences(text).some((sentence) => {
  if (!/trimestre.{0,30}(?:cerrado|completo|finalizado|concluido)/.test(sentence)) return false
  return !/(?:no|nunca|sin).{0,40}trimestre.{0,30}(?:cerrado|completo|finalizado|concluido)|trimestre.{0,30}(?:no esta|no es|no se encuentra).{0,20}(?:cerrado|completo|finalizado|concluido)/.test(sentence)
})

const recurrenceSentences = (text) => sentences(text).filter((sentence) => /recurr/.test(sentence))

const isNegatedRecurrence = (sentence) => /(?:no hay|sin|no se observa|no se demuestra|ningun|ninguna)\b.{0,50}recurr/.test(sentence)

const productAliases = (product) => [normalize(product.id), normalize(product.description)]

const sentenceNamesProduct = (sentence, product) => productAliases(product).some((alias) => sentence.includes(alias))

const assertion = (id, dimension, passed, detail) => ({ id, dimension, passed, detail })

export const scoreResponse = (testCase, response) => {
  const normalized = normalize(response)
  const assertions = []
  const truth = testCase.ground_truth

  assertions.push(assertion(
    'risk_units',
    'economic_fidelity',
    includesNumber(normalized, truth.risk_units),
    `Debe contener ${truth.risk_units} unidades expuestas.`,
  ))
  assertions.push(assertion(
    'risk_amount',
    'economic_fidelity',
    includesNumber(normalized, truth.risk_amount),
    `Debe contener ${truth.risk_amount} de exposición a costo sin IVA.`,
  ))

  if (truth.comparable_window) {
    assertions.push(assertion(
      'comparable_window_acknowledged',
      'comparability',
      /base comparable.{0,30}(?:si|existe)|ventanas?.{0,30}(?:equivalentes|comparables)/.test(normalized),
      'Debe reconocer que existe una ventana previa equivalente.',
    ))
    for (const percentage of truth.comparison_percentages) {
      assertions.push(assertion(
        `comparison_percentage_${percentage}`,
        'comparability',
        includesPercentage(normalized, percentage),
        `La comparación determinística provista contiene ${percentage}%.`,
      ))
    }
  } else {
    assertions.push(assertion(
      'no_comparable_window_acknowledged',
      'comparability',
      /(?:base comparable.{0,30}(?:no|inexistente)|no (?:hay|existe).{0,30}base comparable|sin base comparable)/.test(normalized),
      'Debe reconocer que no existe base comparable.',
    ))
    assertions.push(assertion(
      'no_unsupported_comparison',
      'comparability',
      !hasUnsupportedComparison(response),
      'No puede afirmar mejora, deterioro o variación contra el período previo.',
    ))
  }

  assertions.push(assertion(
    'open_quarter_acknowledged',
    'quarter_state',
    mentionsOpenQuarter(response),
    'Debe identificar el trimestre actual como abierto, en curso o hasta hoy.',
  ))
  assertions.push(assertion(
    'quarter_not_closed',
    'quarter_state',
    !callsQuarterClosed(response),
    'No puede presentar el trimestre actual como cerrado o completo.',
  ))
  assertions.push(assertion(
    'no_seasonality_claim',
    'seasonality',
    !assertsSeasonality(response),
    'Dos ventanas no permiten afirmar estacionalidad.',
  ))

  const productById = new Map(testCase.products.map((product) => [product.id, product]))
  const recurrenceLines = recurrenceSentences(response)

  if (truth.recurring_product_ids.length === 0) {
    const affirmative = recurrenceLines.some((sentence) => !isNegatedRecurrence(sentence))
    assertions.push(assertion(
      'no_invented_recurrence',
      'recurrence',
      !affirmative,
      'No hay productos recurrentes en este caso.',
    ))
  } else {
    for (const productId of truth.recurring_product_ids) {
      const product = productById.get(productId)
      const correctlyNamed = recurrenceLines.some(
        (sentence) => !isNegatedRecurrence(sentence) && sentenceNamesProduct(sentence, product),
      )
      assertions.push(assertion(
        `recurring_${productId}`,
        'recurrence',
        correctlyNamed,
        `${product.description} aparece en ambas ventanas y debe ser el recurrente.`,
      ))
    }
  }

  for (const productId of truth.non_recurring_product_ids) {
    const product = productById.get(productId)
    const incorrectlyNamed = recurrenceLines.some(
      (sentence) => !isNegatedRecurrence(sentence) && sentenceNamesProduct(sentence, product),
    )
    assertions.push(assertion(
      `not_recurring_${productId}`,
      'recurrence',
      !incorrectlyNamed,
      `${product.description} no aparece en ambas ventanas y no puede llamarse recurrente.`,
    ))
  }

  const passed = assertions.filter((item) => item.passed).length
  return {
    case_id: testCase.id,
    passed,
    total: assertions.length,
    score: Number(((passed / assertions.length) * 100).toFixed(2)),
    assertions,
  }
}

export const aggregateScores = (caseScores) => {
  const dimensions = new Map()
  let passed = 0
  let total = 0

  for (const score of caseScores) {
    for (const item of score.assertions) {
      const current = dimensions.get(item.dimension) ?? { passed: 0, total: 0 }
      current.total += 1
      if (item.passed) current.passed += 1
      dimensions.set(item.dimension, current)
      total += 1
      if (item.passed) passed += 1
    }
  }

  return {
    passed,
    total,
    score: Number(((passed / total) * 100).toFixed(2)),
    dimensions: Object.fromEntries([...dimensions.entries()].map(([name, value]) => [
      name,
      { ...value, score: Number(((value.passed / value.total) * 100).toFixed(2)) },
    ])),
  }
}
