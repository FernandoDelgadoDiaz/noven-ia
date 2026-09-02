import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { CANDIDATES, missingCredentialNames } from '../provider-evaluation/candidates.mjs'
import {
  buildProviderRequest,
  extractProviderResponse,
  loadSystemAdmin,
  runEvaluation,
} from '../provider-evaluation/run-evaluation.mjs'

assert.deepEqual(missingCredentialNames({}), [
  'FIREWORKS_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
])
assert.deepEqual(missingCredentialNames({
  FIREWORKS_API_KEY: 'x',
  OPENAI_API_KEY: 'x',
  ANTHROPIC_API_KEY: 'x',
}), [])

const deepseek = CANDIDATES.find((candidate) => candidate.provider === 'Fireworks AI')
const openai = CANDIDATES.find((candidate) => candidate.provider === 'OpenAI')
const anthropic = CANDIDATES.find((candidate) => candidate.provider === 'Anthropic')

assert.equal(deepseek.endpoint, 'https://us.api.fireworks.ai/inference/v1/chat/completions')
assert.equal(deepseek.model, 'accounts/fireworks/routers/deepseek-v4-flash-0731-us')
assert.equal(deepseek.request_options.reasoning_effort, 'none')
assert.equal(openai.endpoint, 'https://us.api.openai.com/v1/responses')
assert.equal(openai.request_options.store, false)
assert.equal(anthropic.endpoint, 'https://api.anthropic.com/v1/messages')
assert.equal(anthropic.request_options.inference_geo, 'us')
assert.ok(CANDIDATES.every((candidate) => candidate.documentation.jurisdiction.startsWith('https://')))
assert.ok(CANDIDATES.every((candidate) => candidate.documentation.retention.startsWith('https://')))

const systemPrompt = await loadSystemAdmin()
assert.match(systemPrompt, /Sólo compare períodos cuando/)
assert.match(systemPrompt, /No afirme estacionalidad/)

const syntheticPrompt = 'Sucursal SYN-TEST. EAN: SYNTHETIC-NOT-A-REAL-EAN-TEST.'
const secret = 'contract-secret-not-real'
const deepseekRequest = buildProviderRequest(deepseek, secret, systemPrompt, syntheticPrompt)
assert.equal(deepseekRequest.headers.Authorization, `Bearer ${secret}`)
assert.equal(deepseekRequest.body.messages[1].content, syntheticPrompt)
const openaiRequest = buildProviderRequest(openai, secret, systemPrompt, syntheticPrompt)
assert.equal(openaiRequest.body.store, false)
assert.equal(openaiRequest.body.input[1].content, syntheticPrompt)
const anthropicRequest = buildProviderRequest(anthropic, secret, systemPrompt, syntheticPrompt)
assert.equal(anthropicRequest.headers['x-api-key'], secret)
assert.equal(anthropicRequest.body.inference_geo, 'us')
assert.equal(anthropicRequest.body.messages[0].content, syntheticPrompt)

assert.equal(extractProviderResponse(deepseek, {
  model: deepseek.model,
  choices: [{ message: { content: 'deepseek ok' } }],
}).text, 'deepseek ok')
assert.equal(extractProviderResponse(openai, {
  model: openai.model,
  output: [{ content: [{ type: 'output_text', text: 'openai ok' }] }],
}).text, 'openai ok')
assert.equal(extractProviderResponse(anthropic, {
  model: anthropic.model,
  content: [{ type: 'text', text: 'anthropic ok' }],
}).text, 'anthropic ok')

await assert.rejects(
  runEvaluation({ environment: {} }),
  /Faltan credenciales: FIREWORKS_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY/,
)

const source = fs.readFileSync(path.join(process.cwd(), 'scripts/provider-evaluation/run-evaluation.mjs'), 'utf8')
assert.doesNotMatch(source, /SUPABASE_(?:URL|SERVICE_ROLE_KEY)|meqvjabgyrgwkxpclqxp/)
assert.match(source, /synthetic_deterministic_only/)
assert.match(source, /SYNTHETIC-NOT-A-REAL-EAN-/)
assert.match(source, /flag: 'wx'/, 'el resultado no debe sobrescribir evidencia anterior')

console.log('✓ Runner multi-proveedor usa sólo corpus sintético, rutas US y falla sin credenciales')
