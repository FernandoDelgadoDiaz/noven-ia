import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const server = read('netlify/functions/analisis.ts')
const environmentExample = read('.env.example')

assert.match(server, /const openaiKey = process\.env\.OPENAI_API_KEY/)
assert.doesNotMatch(server, /DEEPSEEK_API_KEY|api\.deepseek\.com|deepseek-chat/)
assert.doesNotMatch(server, /VITE_OPENAI_API_KEY/,
  'la credencial de OpenAI nunca puede exponerse al bundle del browser')

// La ruta es la global, no la regional. La residencia de datos regional es
// función de cuentas empresariales y este proyecto no es elegible: figura como
// "Global" y el campo no es editable.
//
// Lo que se afirma acá es sólo lo que se puede sostener: que la inferencia va
// contra el endpoint oficial de OpenAI, con credencial server-only y sin
// almacenamiento voluntario. NO se afirma residencia en reposo — ver
// `ai/decisions.md`. Un contrato que dijera "endpoint regional" pasaría a
// certificar una garantía que la cuenta no tiene.
assert.match(server, /fetch\('https:\/\/api\.openai\.com\/v1\/chat\/completions'/,
  'la inferencia debe ir al endpoint oficial de OpenAI')
assert.doesNotMatch(server, /us\.api\.openai\.com|eu\.api\.openai\.com/,
  'los endpoints regionales exigen residencia de datos, que esta cuenta no tiene: usarlos falla con incorrect_hostname')
assert.match(server, /model: 'gpt-5\.6-terra'/)
assert.match(server, /\{ role: 'system', content: SYSTEM_ADMIN \}/,
  'la migración conserva el system prompt vigente')
assert.match(server, /\{ role: 'user', content: datosFormateados \}/,
  'la migración conserva la entrada autorizada vigente')
assert.match(server, /max_completion_tokens: 1500/)
assert.match(server, /reasoning_effort: 'none'/,
  'Chat Completions debe preservar un análisis directo y acotado')
assert.match(server, /temperature: 0\.2/)
assert.match(server, /store: false/,
  'la solicitud no debe habilitar almacenamiento voluntario de la respuesta')
assert.match(server, /openaiData\.choices\?\.\[0\]\?\.message\?\.content\?\.trim\(\)/,
  'se conserva el contrato de respuesta compatible con Chat Completions')

assert.match(environmentExample, /OPENAI_API_KEY=.*secreto — solo en Netlify/)
assert.doesNotMatch(environmentExample, /DEEPSEEK_API_KEY/)

console.log('✓ Análisis IA migra a OpenAI sin exponer la clave ni cambiar su contrato')
