// Contrato del workflow de regeneración de la expectativa móvil.
//
// El workflow existe porque regenerar exige un Supabase descartable y no todo
// entorno puede levantarlo. Al correr en CI, hereda un riesgo que el script
// local no tiene: está más cerca del repositorio y de credenciales de escritura.
//
// Lo que este contrato protege es que siga siendo una herramienta de lectura que
// produce un artefacto para revisar, y no un atajo que deje el gate verde solo.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workflowPath = path.join(root, '.github/workflows/regenerate-replay-expectation.yml')
const workflow = fs.readFileSync(workflowPath, 'utf8')

// --- Nunca automático -------------------------------------------------------
// La regeneración es una decisión, no un efecto secundario de pushear.
const disparadores = workflow.slice(workflow.indexOf('\non:'), workflow.indexOf('permissions:'))
assert.match(disparadores, /workflow_dispatch:/,
  'la regeneración se dispara a mano')
for (const automatico of ['push:', 'pull_request:', 'schedule:', 'workflow_run:']) {
  assert.doesNotMatch(disparadores, new RegExp(`\\n\\s*${automatico.replace(':', ':')}`),
    `la regeneración nunca debe dispararse por ${automatico.replace(':', '')}`)
}
assert.match(workflow, /motivo:\s*\n\s*description:/,
  'cada regeneración deja registrado su motivo en el historial de runs')

// --- No puede escribir en el repositorio ------------------------------------
assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/,
  'el workflow es de sólo lectura: no commitea ni pushea')
for (const escritura of [/git\s+push/, /git\s+commit/, /peter-evans\/create-pull-request/, /add-and-commit/]) {
  assert.doesNotMatch(workflow, escritura,
    'la expectativa regenerada se revisa y commitea a mano; el diff es lo que hay que mirar')
}

// --- Verifica que el ancla no fue tocada ------------------------------------
// Segunda red sobre la garantía del script: acá el resultado sale del entorno
// descartable hacia un humano, y es el último punto donde se puede frenar.
assert.match(workflow, /git diff --quiet -- scripts\/migration-replay\/baseline-v1\/expected-fingerprint\.json/,
  'debe fallar si la regeneración modificó el ancla de producción')
assert.match(workflow, /fingerprint-metadata\.json/,
  'el SHA registrado del ancla también se verifica')
assert.match(workflow, /La regeneración modificó el ancla de producción/,
  'el error debe decir qué pasó, no sólo fallar')

// --- Verifica que no tocó nada más ------------------------------------------
assert.match(workflow, /La regeneración tocó archivos inesperados/,
  'debe fallar si cambió algo fuera de la expectativa móvil')

// --- El resultado se valida antes de salir ----------------------------------
assert.match(workflow, /- name: Suite completa con la expectativa nueva\s*\n\s*run: npm test/,
  'la suite corre con la expectativa regenerada: mejor enterarse acá que después de commitear')

// --- El resultado sale y es revisable ---------------------------------------
assert.match(workflow, /name: expectativa-replay-regenerada/,
  'los archivos regenerados salen como artefacto')
assert.match(workflow, /if-no-files-found: error/,
  'un artefacto vacío es un fallo, no un éxito silencioso')
assert.match(workflow, /GITHUB_STEP_SUMMARY/,
  'el resumen permite revisar sin descargar')

// --- Espeja el entorno de CI ------------------------------------------------
// Una expectativa generada con otra versión no coincidiría con la que produce
// el gate, y el PR quedaría rojo igual.
const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')
const versionSupabase = ci.match(/supabase\/setup-cli@v1\s*\n\s*with:\s*\n\s*version:\s*([\d.]+)/)?.[1]
assert.ok(versionSupabase, 'no se pudo leer la versión de Supabase CLI de ci.yml')
assert.match(
  workflow,
  new RegExp(`supabase/setup-cli@v1\\s*\\n\\s*with:\\s*\\n\\s*version:\\s*${versionSupabase.replace(/\./g, '\\.')}`),
  `debe usar la misma CLI que el gate (${versionSupabase}): otra versión produce otra huella`,
)

const nodoCi = ci.match(/setup-node@v7\s*\n\s*with:\s*\n\s*node-version:\s*(\d+)/)?.[1]
assert.ok(nodoCi, 'no se pudo leer la versión de Node de ci.yml')
assert.match(
  workflow,
  new RegExp(`setup-node@v7\\s*\\n\\s*with:\\s*\\n\\s*node-version:\\s*${nodoCi}`),
  `debe usar el mismo Node que el gate (${nodoCi})`,
)

// --- Usa el regenerador del repositorio, no una copia ------------------------
assert.match(workflow, /run-baseline-replay\.sh --regenerate/,
  'debe usar el mismo script que se corre localmente, no una variante propia')

console.log('✓ El workflow de regeneración es manual, de sólo lectura, y no puede tocar el ancla')
