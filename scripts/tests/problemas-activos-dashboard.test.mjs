import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dashboard = fs.readFileSync(path.join(root, 'src/pages/Dashboard.tsx'), 'utf8')
const problemas = fs.readFileSync(path.join(root, 'src/pages/Problemas.tsx'), 'utf8')
const hook = fs.readFileSync(path.join(root, 'src/hooks/useProblemasActivos.ts'), 'utf8')
const panel = fs.readFileSync(path.join(root, 'src/components/dashboard/ProblemasActivosPanel.tsx'), 'utf8')

assert.match(hook, /\.netlify\/functions\/problemas-activos/)
assert.match(hook, /Authorization: `Bearer \$\{token\}`/)
assert.match(hook, /requestSeq/, 'debe descartar respuestas obsoletas al cambiar de sucursal')

assert.doesNotMatch(dashboard, /<ProblemasActivosPanel/,
  'Problemas Activos no debe ocupar espacio dentro del Dashboard')
assert.match(dashboard, /useProblemasActivos\(sucursalId\)/,
  'el Dashboard conserva el refresco coordinado de problemas')
assert.match(dashboard, /refetchProblemas\(\)/)

assert.match(problemas, /useProblemasActivos\(sucursalId\)/,
  'la solapa Problemas debe conservar la fuente de datos existente')
assert.match(problemas, /<ProblemasActivosPanel/,
  'la solapa Problemas debe reutilizar el panel real')
assert.match(problemas, /navigate\('\/vencimientos\?filtro=riesgo'\)/)

for (const estado of [
  'requiere_cierre',
  'escalado_sin_respuesta',
  'requiere_revision',
  'requiere_intervencion',
  'intervencion_aplicada',
  'bajo_control',
  'dato_a_revisar',
]) {
  assert.match(panel, new RegExp(estado), `el panel debe representar el estado ${estado}`)
}

assert.match(panel, /problemas abiertos/)
assert.match(panel, /requieren acción/)
assert.match(panel, /sin respuesta/)
assert.match(panel, /bajo control/)
assert.match(panel, /Verificar RAG/, 'si falta RAG en Noven no debe afirmar que no existe en Glaciar')
assert.match(panel, /costo s\/IVA/)
assert.match(panel, /motivo_prioridad/, 'cada caso debe explicar por qué ocupa su posición')
assert.doesNotMatch(panel, /score|puntaje|ranking IA/i, 'no debe presentar un score opaco como prioridad')
assert.doesNotMatch(panel, /RAG \d+% recomendado|recomendado.*RAG/i, 'no debe inventar porcentajes RAG')

console.log('✓ Problemas Activos mantiene estado, dinero, unidades y prioridad explicable en su solapa propia')
