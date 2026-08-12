// Runner de la suite de tests del importador.
//   npm test
//
// Ejecuta cada archivo scripts/tests/*.test.mjs en su propio proceso y devuelve
// código de salida distinto de cero si alguno falla, para poder encadenarlo con
// el build antes de un deploy.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.join(AQUI, 'tests')

const archivos = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()

if (archivos.length === 0) {
  console.error('No se encontraron tests en scripts/tests/')
  process.exit(1)
}

let fallaron = 0

for (const archivo of archivos) {
  console.log(`\n${'═'.repeat(70)}\n  ${archivo}\n${'═'.repeat(70)}`)
  const codigo = await new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(DIR, archivo)], { stdio: 'inherit' })
    p.on('close', resolve)
  })
  if (codigo !== 0) fallaron++
}

console.log(`\n${'═'.repeat(70)}`)
if (fallaron === 0) {
  console.log(`  ${archivos.length} archivo(s) de test — TODO EN VERDE`)
} else {
  console.log(`  ${fallaron} de ${archivos.length} archivo(s) FALLARON`)
}
console.log('═'.repeat(70))

process.exit(fallaron === 0 ? 0 : 1)
