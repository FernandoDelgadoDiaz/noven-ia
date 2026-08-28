import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const hook = fs.readFileSync(path.join(ROOT, 'src/hooks/useSucursalActual.ts'), 'utf8')
const jerarquia = fs.readFileSync(path.join(ROOT, 'src/pages/AdminAccesos.tsx'), 'utf8')

function assert(condicion, mensaje) {
  if (!condicion) {
    console.error(`✗ ${mensaje}`)
    process.exit(1)
  }
  console.log(`✓ ${mensaje}`)
}

assert(hook.includes("const STORAGE_EVENT = 'noven:sucursal-cambio'"), 'el contexto define un evento compartido de cambio de sucursal')
assert(hook.includes("window.addEventListener(STORAGE_EVENT, sincronizar)"), 'todas las instancias del hook escuchan cambios de sucursal')
assert(hook.includes("window.dispatchEvent(new Event(STORAGE_EVENT))"), 'seleccionar una sucursal notifica al resto de la app')
assert(hook.includes("a.rol === 'gerente_sucursal'"), 'la sucursal propia se resuelve desde usuario_accesos')
assert(hook.includes('if (sucursalPropiaId)'), 'la sucursal propia tiene prioridad como default multitenant')

assert(jerarquia.includes('Estructura disponible'), 'la jerarquía usa una sección estructurada')
assert(jerarquia.includes('regionesAbiertas'), 'las regiones son plegables en móvil')
assert(jerarquia.includes('ChevronRight') && jerarquia.includes('ChevronDown'), 'la expansión de regiones tiene señal visual clara')
assert(!jerarquia.includes('rounded-full bg-brand-light text-brand border border-brand/15'), 'se eliminaron las pastillas de zonas')
assert(jerarquia.includes("sucursalesRegion"), 'cada región muestra su total de sucursales')
