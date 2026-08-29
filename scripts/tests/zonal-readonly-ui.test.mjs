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
assert.doesNotMatch(catalogCapability, /gerente_zonal|admin_organizacion|operador/,
  'zonal, jerarquía y operador no deben adquirir escritura de catálogo')
assert.match(catalogCapability, /acceso\.sucursal_id === sucursalId/,
  'gestión de catálogo debe exigir la sucursal exacta')
assert.match(catalogWriteRoute, /usePuedeGestionarCatalogo/)
assert.match(catalogWriteRoute, /if \(!puedeGestionar\) return <Navigate to="\/importar\/pendientes" replace \/>/,
  'ruta de aprendizaje CSV debe redirigir si no existe capacidad de catálogo')
assert.match(router, /element: <CatalogWriteRoute \/>[\s\S]*?path: 'importar\/pendientes\/aprender'/,
  'Aprender CSV debe estar detrás del guard de escritura de catálogo')
assert.match(pendientesCatalogo, /const \{ puedeGestionar \} = usePuedeGestionarCatalogo\(\)/,
  'Pendientes debe conocer la capacidad de escritura')
assert.match(pendientesCatalogo, /if \(!puedeGestionar\) throw new Error\('No tenés permiso para clasificar productos\.'\)/,
  'la acción de clasificación debe fallar cerrado también en cliente')
assert.match(pendientesCatalogo, /\{!puedeGestionar && \([\s\S]*?Modo lectura\./,
  'el zonal debe ver explícitamente que Pendientes está en modo lectura')
assert.match(pendientesCatalogo, /\{puedeGestionar && seleccion\.length > 0 && \(/,
  'clasificación masiva debe ocultarse sin capacidad local')
assert.match(pendientesCatalogo, /\{puedeGestionar && \([\s\S]*?type="checkbox"/,
  'selección para clasificar debe ocultarse al zonal')
assert.match(pendientesCatalogo, /\{puedeGestionar && \([\s\S]*?Clasificar para toda la organización/,
  'acción individual de clasificación debe ocultarse al zonal')

console.log('✓ gerente zonal: UI de lectura, sin Scanner ni acciones operativas o de catálogo')
