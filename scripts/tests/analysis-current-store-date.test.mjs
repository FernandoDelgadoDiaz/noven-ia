import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.join(process.cwd(), 'netlify/functions/analisis.ts'), 'utf8')

assert.match(source, /America\/Argentina\/Buenos_Aires/)
assert.match(source, /fechaOperacionalYmd/)
assert.match(source, /trimestreOperacional\(hoyYmd\)/)
assert.doesNotMatch(source, /SUCURSAL_LEGACY/)
assert.doesNotMatch(source, /new Date\(fechaVencimiento\)/)

console.log('✓ Análisis IA usa fecha operacional Argentina y no contexto legacy')
