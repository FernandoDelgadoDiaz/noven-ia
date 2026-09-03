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

assert.deepEqual(missingCredentialNames({}), ['OPENAI_API_KEY'])
assert.deepEqual(missingCredentialNames({
  OPENAI_API_KEY: 'x',
}), [])

const openai = CANDIDATES.find((candidate) => candidate.provider === 'OpenAI')

assert.equal(CANDIDATES.length, 1)
assert.equal(openai.endpoint, 'https://us.api.openai.com/v1/chat/completions')
assert.equal(openai.model, 'gpt-5.6-terra')
assert.equal(openai.api, 'openai_chat')
assert.equal(openai.request_options.max_completion_tokens, 1500)
assert.equal(openai.request_options.reasoning_effort, 'none')
assert.equal(openai.request_options.temperature, 0.2)
assert.equal(openai.request_options.store, false)
assert.ok(CANDIDATES.every((candidate) => candidate.documentation.jurisdiction.startsWith('https://')))
assert.ok(CANDIDATES.every((candidate) => candidate.documentation.retention.startsWith('https://')))

const systemPrompt = await loadSystemAdmin()
assert.match(systemPrompt, /Sólo compare períodos cuando/)
assert.match(systemPrompt, /No afirme estacionalidad/)

const syntheticPrompt = 'Sucursal SYN-TEST. EAN: SYNTHETIC-NOT-A-REAL-EAN-TEST.'
const secret = 'contract-secret-not-real'
const openaiRequest = buildProviderRequest(openai, secret, systemPrompt, syntheticPrompt)
assert.equal(openaiRequest.headers.Authorization, `Bearer ${secret}`)
assert.equal(openaiRequest.body.store, false)
assert.equal(openaiRequest.body.reasoning_effort, 'none')
assert.equal(openaiRequest.body.messages[0].content, systemPrompt)
assert.equal(openaiRequest.body.messages[1].content, syntheticPrompt)

assert.equal(extractProviderResponse(openai, {
  model: openai.model,
  choices: [{ message: { content: 'openai ok' } }],
}).text, 'openai ok')

await assert.rejects(
  runEvaluation({ environment: {} }),
  /Faltan credenciales: OPENAI_API_KEY/,
)

const requests = []
const result = await runEvaluation({
  environment: { OPENAI_API_KEY: secret },
  generatedAt: '2026-09-03T00:00:00.000Z',
  fetchImpl: async (url, init) => {
    requests.push({ url, init })
    return new Response(JSON.stringify({
      model: openai.model,
      choices: [{ message: { content: 'El trimestre está abierto hasta hoy. No se puede afirmar estacionalidad.' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  },
})
assert.equal(requests.length, 3, 'el proveedor elegido recibe exactamente un request por caso sintético')
assert.ok(requests.every((request) => request.url === openai.endpoint))
assert.ok(requests.every((request) => JSON.parse(request.init.body).store === false))
assert.equal(result.candidates.length, 1)
assert.equal(result.candidates[0].cases.length, 3)
assert.match(result.decision, /OpenAI fue elegido/)
assert.doesNotMatch(JSON.stringify(result), new RegExp(secret), 'la evidencia nunca incluye la clave')

const source = fs.readFileSync(path.join(process.cwd(), 'scripts/provider-evaluation/run-evaluation.mjs'), 'utf8')
assert.doesNotMatch(source, /SUPABASE_(?:URL|SERVICE_ROLE_KEY)|meqvjabgyrgwkxpclqxp/)
assert.match(source, /synthetic_deterministic_only/)
assert.match(source, /SYNTHETIC-NOT-A-REAL-EAN-/)
assert.match(source, /flag: 'wx'/, 'el resultado no debe sobrescribir evidencia anterior')

console.log('✓ Runner del OpenAI elegido usa sólo corpus sintético, ruta US y falla sin credencial')
