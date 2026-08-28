import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const modal = read('src/components/scanner/ScannerModal.tsx')
const fallback = read('src/components/scanner/Html5QrcodeFallback.tsx')

assert.match(
  modal,
  /lazy\(\(\) => import\('\.\/Html5QrcodeFallback'\)\)/,
  'ScannerModal debe cargar el fallback pesado con import dinámico',
)
assert.doesNotMatch(
  modal,
  /from ['"]html5-qrcode['"]/,
  'el chunk inicial de ScannerModal no debe importar html5-qrcode de forma estática',
)
assert.match(
  modal,
  /'BarcodeDetector' in window/,
  'ScannerModal debe conservar la preferencia por BarcodeDetector nativo',
)
assert.match(
  fallback,
  /from ['"]html5-qrcode['"]/,
  'el componente diferido debe conservar la implementación html5-qrcode',
)
assert.match(
  fallback,
  /scanner\.start\([\s\S]*?facingMode:\s*'environment'/,
  'el fallback debe conservar la cámara trasera y el flujo de inicio existente',
)
assert.match(
  fallback,
  /Html5QrcodeScannerState\.SCANNING[\s\S]*?Html5QrcodeScannerState\.PAUSED/,
  'el fallback debe conservar el cleanup seguro del scanner',
)

console.log('✓ Scanner carga html5-qrcode sólo al entrar en el fallback')
