import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = fs.readFileSync(path.join(root, 'src/pages/Scanner.tsx'), 'utf8')

assert.match(source, /diasDonacion = \(productoEncontrado as ProductoConPoliticaScanner\)\.dias_donacion \?\? null/)
assert.match(source, /diasDonacion == null\s*\? null\s*:\s*calcularNivelRiesgo\([\s\S]*?diasDonacion,\s*\)/)
assert.match(source, /SIN POLÍTICA/)
assert.match(source, /Noven no calcula ni infiere un nivel de riesgo/)
assert.doesNotMatch(
  source,
  /calcularNivelRiesgo\(diasRestantes, vencimientoExistente\.cantidad, productoEncontrado\.venta_media_diaria\)/,
)
assert.doesNotMatch(source, /usuarioId=\{user\?\.id \?\? ''\}/)

console.log('✓ Scanner no calcula riesgo sin política y no arrastra usuarioId legacy')
