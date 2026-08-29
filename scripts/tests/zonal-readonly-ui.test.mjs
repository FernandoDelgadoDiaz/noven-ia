import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const capability = read('src/hooks/usePuedeOperarSucursal.ts')
const catalogCapability = read('src/hooks/usePuedeGestionarCatalogo.ts')
const operationalRoute = read('src/components/auth/OperationalRoute.tsx')
const catalogWriteRoute = read('src/components/auth/CatalogWriteRoute.tsx')
const router = read('src/router/index.tsx')
const layout = read('src/components/layout/AppLayout.tsx')
const dashboard = read('src/pages/Dashboard.tsx')
const vencimientos = read('src/pages/Vencimientos.tsx')
const pendientesCatalogo = read('src/pages/PendientesCatalogo.tsx')

assert.match(capability, /\['gerente_sucursal', 'supervisor', 'operador'\]\.includes\(acceso\.rol\)/,
  'capacidad operativa debe estar limitada a roles locales')
assert.doesNotMatch(capability, /gerente_zonal|admin_organizacion/,
  'zonal y jerarquía no son roles operativos')
assert.match(capability, /acceso\.sucursal_id === sucursalId/,
  'la operación debe exigir la sucursal exacta')

assert.match(operationalRoute, /usePuedeOperarSucursal/)
assert.match(operationalRoute, /if \(!puedeOperar\) return <Navigate to="\/dashboard" replace \/>/,
  'acceso directo a ruta operativa debe redirigir')
assert.match(router, /element: <OperationalRoute \/>[\s\S]*?path: 'scanner'/,
  'Scanner debe estar detrás del guard operativo')

assert.match(layout, /BASE_NAV_ITEMS\.filter\(\(item\) => item\.to !== '\/scanner' \|\| puedeOperar\)/,
  'menú desktop debe ocultar Scanner al zonal')
assert.match(layout, /\{puedeOperar && \([\s\S]*?<NavLink to="\/scanner"/,
  'acción flotante móvil de Scanner debe existir sólo con capacidad operativa')

assert.match(dashboard, /onClick=\{puedeOperar \? \(\) => setVencimientoEditando\(v\) : undefined\}/,
  'alertas de Dashboard deben ser lectura para zonal')
assert.match(dashboard, /onRegistrarAccion=\{puedeOperar \? handleRegistrarAccion : undefined\}/,
  'zonal no debe ver acciones de donación/decomiso')
assert.match(dashboard, /\{puedeOperar && vencimientoEditando !== null/,
  'modal de edición requiere capacidad operativa')

assert.match(vencimientos, /\{puedeOperar && \([\s\S]*?aria-label="Nuevo registro"/,
  'Vencimientos no debe mostrar Nuevo registro al zonal')
assert.match(vencimientos, /onClick=\{puedeOperar \? \(\) => setVencimientoEditando\(v\) : undefined\}/,
  'cards de vencimientos deben ser lectura para zonal')
assert.match(vencimientos, /\{puedeOperar && vencimientoEditando !== null/,
  'modal de vencimiento requiere capacidad operativa')

assert.match(catalogCapability, /\['gerente_sucursal', 'supervisor'\]\.includes\(acceso\.rol\)/,
  'gestión de catálogo debe quedar limitada a gerente/supervisor local')
assert.match(catalogCapability, /sucursalesGestionables\.has\(sucursalId\)/,
  'las rutas de escritura deben exigir que la sucursal actual sea gestionable')
assert.match(catalogWriteRoute, /usePuedeGestionarCatalogo/)
assert.match(catalogWriteRoute, /if \(!puedeGestionar\) return <Navigate to="\/importar\/pendientes" replace \/>/,
  'una ruta de escritura sin capacidad local debe volver a la bandeja de lectura')
assert.match(router, /element: <CatalogWriteRoute \/>[\s\S]*?path: 'importar\/pendientes\/aprender'/,
  'Aprender CSV debe estar detrás del guard de escritura de catálogo')
assert.match(pendientesCatalogo, /sucursalesGestionables/,
  'Pendientes debe conocer las sucursales locales gestionables')
assert.match(pendientesCatalogo, /pendiente\.sucursales\.some\(\(s\) => sucursalesGestionables\.has\(s\.id\)\)/,
  'la escritura en una bandeja zonal debe resolverse ítem por ítem')
assert.match(pendientesCatalogo, /Parte de esta bandeja es sólo lectura/,
  'la UI debe explicar el alcance de lectura zonal')
assert.match(pendientesCatalogo, /const editable = puedeGestionarPendiente\(p\)/,
  'cada pendiente debe calcular su capacidad antes de renderizar controles')
assert.match(pendientesCatalogo, /Solo lectura en tu alcance actual/,
  'un ítem fuera del scope local no debe mostrar acciones de clasificación')

console.log('✓ gerente zonal: UI de lectura, sin Scanner; catálogo escribe sólo por scope local del ítem')
