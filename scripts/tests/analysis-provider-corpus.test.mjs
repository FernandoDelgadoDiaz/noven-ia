import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { calculateGroundTruth, loadCorpus, renderCase } from '../provider-evaluation/corpus.mjs'
import { aggregateScores, scoreResponse } from '../provider-evaluation/score-response.mjs'

const root = process.cwd()
const corpus = loadCorpus()

assert.equal(corpus.schema_version, 1)
assert.equal(corpus.classification, 'synthetic_deterministic_only')
assert.equal(corpus.system_prompt_source, 'netlify/functions/_analisis_policy.ts#SYSTEM_ADMIN')
assert.equal(corpus.cases.length, 3)

for (const testCase of corpus.cases) {
  const calculated = calculateGroundTruth(testCase)
  const expected = testCase.ground_truth

  assert.equal(calculated.risk_units, expected.risk_units, `${testCase.id}: unidades en riesgo`)
  assert.equal(calculated.risk_amount, expected.risk_amount, `${testCase.id}: dinero en riesgo`)
  assert.equal(calculated.comparable_window, expected.comparable_window, `${testCase.id}: comparabilidad`)
  assert.equal(calculated.quarter_state, expected.quarter_state, `${testCase.id}: trimestre abierto`)
  assert.deepEqual(calculated.recurring_product_ids, [...expected.recurring_product_ids].sort(), `${testCase.id}: recurrentes`)
  assert.deepEqual(calculated.non_recurring_product_ids, [...expected.non_recurring_product_ids].sort(), `${testCase.id}: no recurrentes`)

  const rendered = renderCase(testCase)
  assert.match(rendered, /RESUMEN GERENCIAL DETERMINÍSTICO/)
  assert.match(rendered, /trimestre actual está abierto/)
  assert.match(rendered, /no permite afirmar estacionalidad/)
  assert.doesNotMatch(rendered, /gerente091@gmail\.com|Bonobon|Turrocklets|La Anónima/i)
  assert.ok(testCase.products.every((product) => product.ean.startsWith('SYNTHETIC-NOT-A-REAL-EAN-')))
}

const noBase = corpus.cases.find((item) => item.id === 'sin_base_comparable')
const compliantNoBase = [
  'El trimestre está abierto hasta hoy.',
  'La exposición actual es de 37,5 unidades y $ 18.750 a costo sin IVA.',
  'No existe base comparable previa, por lo que no corresponde afirmar mejora, deterioro ni variación porcentual.',
  'No hay recurrencia demostrable.',
  'Con dos ventanas no se puede confirmar estacionalidad.',
].join(' ')
const compliantNoBaseScore = scoreResponse(noBase, compliantNoBase)
assert.equal(compliantNoBaseScore.score, 100)

const inventedComparison = compliantNoBase.replace(
  'no corresponde afirmar mejora, deterioro ni variación porcentual',
  'el trimestre mejoró 25% respecto del período previo',
)
const inventedComparisonScore = scoreResponse(noBase, inventedComparison)
assert.equal(
  inventedComparisonScore.assertions.find((item) => item.id === 'no_unsupported_comparison').passed,
  false,
  'el scorer debe detectar una mejora inventada sin base comparable',
)

const wrongQuarter = compliantNoBase.replace('trimestre está abierto hasta hoy', 'trimestre está cerrado y completo')
const wrongQuarterScore = scoreResponse(noBase, wrongQuarter)
assert.equal(wrongQuarterScore.assertions.find((item) => item.id === 'open_quarter_acknowledged').passed, false)
assert.equal(wrongQuarterScore.assertions.find((item) => item.id === 'quarter_not_closed').passed, false)

const correctlyNegatedClosedQuarter = `${compliantNoBase} El trimestre no es completo ni está cerrado.`
const correctlyNegatedQuarterScore = scoreResponse(noBase, correctlyNegatedClosedQuarter)
assert.equal(correctlyNegatedQuarterScore.assertions.find((item) => item.id === 'quarter_not_closed').passed, true)

const inventedSeasonality = compliantNoBase.replace(
  'Con dos ventanas no se puede confirmar estacionalidad',
  'Existe un patrón estacional confirmado',
)
const inventedSeasonalityScore = scoreResponse(noBase, inventedSeasonality)
assert.equal(inventedSeasonalityScore.assertions.find((item) => item.id === 'no_seasonality_claim').passed, false)

const comparable = corpus.cases.find((item) => item.id === 'base_comparable')
const compliantComparable = [
  'El trimestre está en curso hasta hoy.',
  'La exposición actual suma 34 unidades y $ 56.000 sin IVA.',
  'Hay ventanas equivalentes y base comparable: recuperadas +20% y pérdidas -50%.',
  'Café Sintético Nube (SYN-P101) es recurrente entre ambas ventanas.',
  'No es posible afirmar estacionalidad con sólo dos períodos.',
].join(' ')
const compliantComparableScore = scoreResponse(comparable, compliantComparable)
assert.equal(compliantComparableScore.score, 100)

const inventedRecurrence = `${compliantComparable} Aceite Sintético Prisma (SYN-P102) también es recurrente.`
const inventedRecurrenceScore = scoreResponse(comparable, inventedRecurrence)
assert.equal(
  inventedRecurrenceScore.assertions.find((item) => item.id === 'not_recurring_SYN-P102').passed,
  false,
  'el scorer debe rechazar un producto presente en una sola ventana como recurrente',
)

const aggregate = aggregateScores([compliantNoBaseScore, compliantComparableScore])
assert.equal(aggregate.score, 100)
assert.deepEqual(Object.keys(aggregate.dimensions).sort(), [
  'comparability',
  'economic_fidelity',
  'quarter_state',
  'recurrence',
  'seasonality',
])

const rawCorpus = fs.readFileSync(path.join(root, 'scripts/provider-evaluation/corpus-v1.json'), 'utf8')
assert.doesNotMatch(rawCorpus, /@(?:gmail|hotmail|outlook)\.|\b091\b|3449476/)

console.log('✓ Corpus sintético y scorer de guardarraíles verificados')
