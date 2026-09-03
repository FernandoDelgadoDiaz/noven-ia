// Contrato del workflow que corre el corpus contra el proveedor real.
//
// El corpus corre sin red en `npm test` —sus contratos verifican estructura y
// detectores—, pero medir adherencia exige llamar al proveedor, y eso necesita
// la credencial. Este workflow es el único lugar donde eso pasa.
//
// Lo que se protege acá es que siga siendo capaz de fallar y que mida lo que
// producción despliega, no una configuración propia.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workflow = fs.readFileSync(path.join(root, '.github/workflows/analysis-provider-evaluation.yml'), 'utf8')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

// --- Corre cuando cambia algo que puede mover el resultado -----------------
//
// El prompt, la Function y el corpus. Si el disparo no cubre los tres, un
// cambio de prompt puede entrar sin que nadie mida qué le hizo al modelo.

for (const ruta of [
  'netlify/functions/_analisis_policy.ts',
  'netlify/functions/analisis.ts',
  'scripts/evaluacion-proveedor/**',
]) {
  assert.ok(workflow.includes(ruta),
    `el workflow debe dispararse ante cambios en ${ruta}`)
}

// --- Usa el corpus del repositorio -----------------------------------------
//
// Hubo dos corpus a la vez —uno en `scripts/provider-evaluation/` y otro en
// `scripts/evaluacion-proveedor/`— porque se construyeron en paralelo sin
// verse. Se consolidó en el segundo; este assert impide que el primero
// reaparezca y que la evaluación mida contra un corpus que ya nadie mantiene.

assert.equal(pkg.scripts['eval:analysis-providers'],
  'node scripts/evaluacion-proveedor/correr.mjs',
  'la evaluación tiene que correr el corpus consolidado')
assert.doesNotMatch(workflow, /scripts\/provider-evaluation/,
  'scripts/provider-evaluation/ se consolidó en scripts/evaluacion-proveedor/')
assert.ok(!fs.existsSync(path.join(root, 'scripts/provider-evaluation')),
  'no puede volver a haber dos corpus de evaluación en el repositorio')

// --- La credencial viene de secretos, nunca del código ---------------------

assert.match(workflow, /OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}/,
  'la credencial se inyecta desde los secretos del repositorio')
assert.doesNotMatch(workflow, /OPENAI_API_KEY:\s*['"]?sk-/,
  'jamás una clave literal en el workflow')

// --- Preflight antes de medir ----------------------------------------------
//
// Separa "el proveedor no responde" de "el modelo no adhiere": un problema de
// despliegue y uno de calidad se arreglan distinto, y confundirlos hace perder
// una ronda entera.

const posPreflight = workflow.indexOf('--preflight')
const posEvaluacion = workflow.indexOf('--output')
assert.ok(posPreflight !== -1, 'debe verificar credencial y modelo antes de medir')
assert.ok(posPreflight < posEvaluacion,
  'el preflight va antes de la evaluación, no después')

// --- Mide la varianza ------------------------------------------------------
//
// `temperature` es 0.2, no 0: la respuesta no es determinista aunque el corpus
// sí lo sea. Una sola corrida por escenario no distingue un guardarraíl sólido
// de uno que falla una vez de cada tres.

const repeticiones = /--repeticiones (\d+)/.exec(workflow)
assert.ok(repeticiones, 'la evaluación debe repetir cada escenario')
assert.ok(Number(repeticiones[1]) >= 3,
  `con ${repeticiones?.[1]} repetición(es) no se distingue un guardarraíl sólido de uno intermitente`)

// --- El resultado queda como evidencia -------------------------------------

assert.match(workflow, /upload-artifact/,
  'el informe de la evaluación tiene que quedar guardado: es la evidencia de la decisión')
assert.match(workflow, /permissions:\s*\n\s*contents: read/,
  'el workflow no escribe en el repositorio')

// --- No puede pasar en vacío -----------------------------------------------

assert.doesNotMatch(workflow, /continue-on-error/,
  'un guardarraíl roto tiene que romper el workflow')
assert.doesNotMatch(workflow, /\|\|\s*true/,
  '`|| true` convierte la evaluación en decorativa')

console.log('✓ La evaluación contra el proveedor real usa el corpus consolidado, hace preflight y repite')
