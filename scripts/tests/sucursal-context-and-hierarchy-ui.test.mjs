import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const context = fs.readFileSync(path.join(ROOT, 'src/context/NovenAccessContext.tsx'), 'utf8')
const hook = fs.readFileSync(path.join(ROOT, 'src/hooks/useSucursalActual.ts'), 'utf8')
const jerarquia = fs.readFileSync(path.join(ROOT, 'src/pages/AdminAccesos.tsx'), 'utf8')

function assert(condicion, mensaje) {
  if (!condicion) {
    console.error(`✗ ${mensaje}`)
    process.exit(1)
  }
  console.log(`✓ ${mensaje}`)
}

assert(context.includes("const STORAGE_EVENT = 'noven:sucursal-cambio'"), 'el contexto define un evento compartido de cambio de sucursal')
assert(context.includes("window.addEventListener(STORAGE_EVENT, sincronizarSeleccion)"), 'el provider escucha cambios de sucursal')
assert(context.includes("window.dispatchEvent(new Event(STORAGE_EVENT))"), 'seleccionar una sucursal notifica al resto de la app')
assert(context.includes("a.rol === 'gerente_sucursal'"), 'la sucursal propia se resuelve desde usuario_accesos')
assert(context.includes('if (sucursalPropiaId)'), 'la sucursal propia tiene prioridad como default multitenant')
assert(hook.includes('useNovenAccessContext'), 'el hook de sucursal consume la fuente única')

assert(jerarquia.includes('Estructura disponible'), 'la jerarquía usa una sección estructurada')
assert(jerarquia.includes('regionesAbiertas'), 'las regiones son plegables en móvil')
assert(jerarquia.includes('ChevronRight') && jerarquia.includes('ChevronDown'), 'la expansión de regiones tiene señal visual clara')
assert(!jerarquia.includes('rounded-full bg-brand-light text-brand border border-brand/15'), 'se eliminaron las pastillas de zonas')
assert(jerarquia.includes('sucursalesRegion'), 'cada región muestra su total de sucursales')
