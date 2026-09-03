import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const workflow = read('.github/workflows/analysis-provider-evaluation.yml')

assert.match(workflow, /pull_request:\n\s+branches:\n\s+- master/,
  'la evaluación sólo acompaña PRs a master')
assert.doesNotMatch(workflow, /\bpush:/,
  'el benchmark pago no corre en cada push a master')
assert.match(workflow, /scripts\/provider-evaluation\/\*\*/,
  'los cambios del harness deben disparar la evaluación')
assert.match(workflow, /OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}/,
  'la credencial sólo proviene de GitHub Actions Secrets')
assert.doesNotMatch(workflow, /VITE_OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY/,
  'el workflow no expone la clave al browser ni recibe acceso a producción')
assert.match(workflow, /npm run eval:analysis-providers -- --preflight/)
assert.match(workflow, /npm run eval:analysis-providers -- --output \.artifacts\/provider-evaluation\/openai-us\.json/)
assert.match(workflow, /if: always\(\)/,
  'la evidencia debe subirse aun cuando falle un guardarraíl')
assert.match(workflow, /retention-days: 30/)

console.log('✓ Workflow OpenAI evalúa sólo corpus sintético, usa Secrets y conserva evidencia')
