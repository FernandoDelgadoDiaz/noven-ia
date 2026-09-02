import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { CANDIDATES, missingCredentialNames } from './candidates.mjs'
import { loadCorpus, renderCase } from './corpus.mjs'
import { aggregateScores, scoreResponse } from './score-response.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const POLICY_PATH = path.join(ROOT, 'netlify/functions/_analisis_policy.ts')
const CORPUS_PATH = path.join(HERE, 'corpus-v1.json')
const DEFAULT_OUTPUT = path.join(ROOT, '.artifacts/provider-evaluation/latest.json')

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

export const loadSystemAdmin = async () => {
  const source = fs.readFileSync(POLICY_PATH, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: POLICY_PATH,
  }).outputText
  const encoded = Buffer.from(transpiled, 'utf8').toString('base64')
  const policyModule = await import(`data:text/javascript;base64,${encoded}`)
  if (typeof policyModule.SYSTEM_ADMIN !== 'string' || !policyModule.SYSTEM_ADMIN.trim()) {
    throw new Error('No se pudo cargar SYSTEM_ADMIN desde su fuente canónica.')
  }
  return policyModule.SYSTEM_ADMIN
}

export const buildProviderRequest = (candidate, apiKey, systemPrompt, userPrompt) => {
  if (candidate.api === 'openai_chat') {
    return {
      endpoint: candidate.endpoint,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        model: candidate.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ...candidate.request_options,
      },
    }
  }

  if (candidate.api === 'openai_responses') {
    return {
      endpoint: candidate.endpoint,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        model: candidate.model,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ...candidate.request_options,
      },
    }
  }

  if (candidate.api === 'anthropic_messages') {
    return {
      endpoint: candidate.endpoint,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: {
        model: candidate.model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        ...candidate.request_options,
      },
    }
  }

  throw new Error(`API no soportada en el benchmark: ${candidate.api}`)
}

export const extractProviderResponse = (candidate, payload) => {
  let text = ''
  if (candidate.api === 'openai_chat') {
    text = payload.choices?.[0]?.message?.content ?? ''
  } else if (candidate.api === 'openai_responses') {
    text = payload.output_text ?? payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === 'output_text')
      .map((item) => item.text ?? '')
      .join('\n') ?? ''
  } else if (candidate.api === 'anthropic_messages') {
    text = payload.content
      ?.filter((item) => item.type === 'text')
      .map((item) => item.text ?? '')
      .join('\n') ?? ''
  }

  if (!text.trim()) throw new Error(`${candidate.id}: respuesta sin texto evaluable.`)
  return {
    text: text.trim(),
    response_model: payload.model ?? null,
    usage: payload.usage ?? null,
  }
}

const requestCandidate = async (candidate, apiKey, systemPrompt, userPrompt, fetchImpl) => {
  const request = buildProviderRequest(candidate, apiKey, systemPrompt, userPrompt)
  const started = performance.now()
  const response = await fetchImpl(request.endpoint, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(120_000),
  })
  const elapsedMs = Math.round(performance.now() - started)
  const raw = await response.text()

  if (!response.ok) {
    throw new Error(`${candidate.id}: HTTP ${response.status}: ${raw.slice(0, 1000)}`)
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error(`${candidate.id}: el proveedor devolvió JSON inválido.`)
  }

  return { ...extractProviderResponse(candidate, payload), elapsed_ms: elapsedMs }
}

const publicCandidate = (candidate) => ({
  id: candidate.id,
  provider: candidate.provider,
  model: candidate.model,
  api: candidate.api,
  endpoint: candidate.endpoint,
  request_options: candidate.request_options,
  jurisdiction: candidate.jurisdiction,
  retention: candidate.retention,
  documentation: candidate.documentation,
})

export const runEvaluation = async ({
  environment = process.env,
  fetchImpl = fetch,
  generatedAt = new Date().toISOString(),
} = {}) => {
  const missing = missingCredentialNames(environment)
  if (missing.length) {
    throw new Error(`Faltan credenciales: ${missing.join(', ')}`)
  }

  const corpusRaw = fs.readFileSync(CORPUS_PATH, 'utf8')
  const corpus = loadCorpus()
  if (corpus.classification !== 'synthetic_deterministic_only') {
    throw new Error('El runner sólo acepta un corpus clasificado como sintético determinístico.')
  }
  const systemPrompt = await loadSystemAdmin()
  const candidateResults = []

  for (const candidate of CANDIDATES) {
    const cases = []
    for (const testCase of corpus.cases) {
      const userPrompt = renderCase(testCase)
      if (!userPrompt.includes('SYNTHETIC-NOT-A-REAL-EAN-')) {
        throw new Error(`${testCase.id}: el payload perdió su marcador sintético.`)
      }
      const response = await requestCandidate(
        candidate,
        environment[candidate.api_key_env],
        systemPrompt,
        userPrompt,
        fetchImpl,
      )
      cases.push({
        case_id: testCase.id,
        input_sha256: sha256(userPrompt),
        response: response.text,
        response_model: response.response_model,
        usage: response.usage,
        elapsed_ms: response.elapsed_ms,
        score: scoreResponse(testCase, response.text),
      })
    }

    candidateResults.push({
      candidate: publicCandidate(candidate),
      aggregate: aggregateScores(cases.map((item) => item.score)),
      cases,
    })
  }

  return {
    schema_version: 1,
    generated_at: generatedAt,
    corpus: {
      id: corpus.corpus_id,
      sha256: sha256(corpusRaw),
      case_count: corpus.cases.length,
      classification: corpus.classification,
    },
    system_prompt: {
      source: corpus.system_prompt_source,
      sha256: sha256(systemPrompt),
    },
    scoring_policy: 'Sólo adherencia mecánica a verdad económica, comparabilidad, trimestre abierto, estacionalidad y recurrencia; el estilo no puntúa.',
    candidates: candidateResults,
  }
}

const parseOutputPath = (argv) => {
  const index = argv.indexOf('--output')
  if (index === -1) return DEFAULT_OUTPUT
  if (!argv[index + 1]) throw new Error('Falta la ruta después de --output.')
  return path.resolve(argv[index + 1])
}

const main = async () => {
  if (process.argv.includes('--preflight')) {
    const missing = missingCredentialNames()
    console.log(JSON.stringify({
      ready: missing.length === 0,
      missing,
      candidates: CANDIDATES.map(publicCandidate),
    }, null, 2))
    if (missing.length) process.exitCode = 2
    return
  }

  const outputPath = parseOutputPath(process.argv.slice(2))
  const results = await runEvaluation()
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, { flag: 'wx' })
  console.log(`Evaluación escrita en ${outputPath}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
