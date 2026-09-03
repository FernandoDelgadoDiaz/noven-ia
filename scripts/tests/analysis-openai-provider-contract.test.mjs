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

assert.match(server, /fetch\('https:\/\/us\.api\.openai\.com\/v1\/chat\/completions'/,
  'la inferencia debe usar el endpoint regional de Estados Unidos')
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

console.log('✓ Análisis IA migra a OpenAI US sin exponer la clave ni cambiar su contrato')
