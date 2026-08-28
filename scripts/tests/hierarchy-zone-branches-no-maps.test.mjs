import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pantalla = fs.readFileSync(path.join(raiz, 'src/pages/AdminAccesos.tsx'), 'utf8')
const index = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8')

const checks = [
  ['estado de zonas abiertas', pantalla.includes('const [zonasAbiertas, setZonasAbiertas]')],
  ['zona es botón real', pantalla.includes('onClick={() => toggleZona(zona.id)}')],
  ['zona informa aria-expanded', pantalla.includes('aria-expanded={zonaAbierta}')],
  ['lista sucursales de la zona', pantalla.includes('sucursalesZona.map((sucursal)')],
  ['muestra código de sucursal', pantalla.includes('Sucursal {sucursal.codigo}')],
  ['muestra nombre de sucursal', pantalla.includes('{sucursal.nombre}')],
  ['sin chips legacy de zona', !pantalla.includes('rounded-full bg-brand-light text-brand border border-brand/15')],
  ['desactiva detección de dirección', index.includes('format-detection') && index.includes('address=no')],
]

let fallos = 0
for (const [nombre, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${nombre}`)
  if (!ok) fallos++
}

if (fallos > 0) {
  console.error(`\n${fallos} chequeo(s) fallaron`)
  process.exit(1)
}

console.log(`\nTODOS LOS TESTS PASAN (${checks.length})`)
