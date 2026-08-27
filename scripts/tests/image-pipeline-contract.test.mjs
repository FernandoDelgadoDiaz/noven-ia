import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const source = fs.readFileSync(path.join(ROOT, 'src/lib/image-pipeline.ts'), 'utf8')

assert.match(source, /FULL_TARGET_BYTES\s*=\s*900\s*\*\s*1024/, 'La imagen principal debe apuntar a menos de 1 MB')
assert.match(source, /THUMB_TARGET_BYTES\s*=\s*180\s*\*\s*1024/, 'La miniatura debe mantener un objetivo liviano')
assert.match(source, /for \(const intento of intentos\)/, 'La compresión debe reintentar de forma adaptativa')
assert.match(source, /render\.blob\.size <= targetBytes/, 'Cada intento debe validar el peso obtenido')
assert.match(source, /maxSide: 1200, quality: 0\.78/, 'Debe conservar máxima calidad como primer intento')
assert.match(source, /maxSide: 560, quality: 0\.48/, 'Debe existir un fallback fuerte para fotos móviles difíciles')
assert.doesNotMatch(source, /La foto optimizada todavía supera 1 MB\. Probá con otra imagen\./, 'No se debe rechazar una foto móvil tras un único intento')

console.log('✓ Fotos de producto usan compresión adaptativa antes de rechazar la imagen')
