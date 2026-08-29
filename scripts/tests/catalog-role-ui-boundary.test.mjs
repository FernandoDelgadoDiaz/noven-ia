import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const capability = read('src/hooks/usePuedeGestionarCatalogoSucursal.ts')
const guard = read('src/components/auth/CatalogWriteRoute.tsx')
const router = read('src/router/index.tsx')
const layout = read('src/components/layout/AppLayout.tsx')
const pendientes = read('src/pages/PendientesCatalogo.tsx')

assert.match(capability, /\['gerente_sucursal', 'supervisor'\]\.includes\(acceso\.rol\)/,
  'catálogo escribible debe quedar limitado a gerente_sucursal y supervisor')
assert.doesNotMatch(capability, /\['gerente_zonal'|\['admin_organizacion'|\['operador'/,
  'zonal, jerarquía y operador no deben entrar en la allowlist de escritura de catálogo')
assert.match(capability, /ids\.add\(acceso\.sucursal_id\)/,
  'la capacidad debe conservar una lista explícita de sucursales gestionables')
assert.match(capability, /sucursalesGestionables\.has\(sucursalId\)/,
  'la ruta de escritura debe exigir la sucursal actual exacta')

assert.match(guard, /usePuedeGestionarCatalogoSucursal/)
assert.match(guard, /if \(!puedeGestionar\) return <Navigate to="\/dashboard" replace \/>/,
  'un acceso directo a escritura de catálogo debe redirigir si no hay capacidad local')

assert.match(router, /element: <CatalogWriteRoute \/>[\s\S]*?path: 'importar'[\s\S]*?path: 'importar\/familia'[\s\S]*?path: 'importar\/masivo'[\s\S]*?path: 'importar\/pendientes\/aprender'/,
  'las rutas de importación y aprendizaje deben compartir el guard local de catálogo')
assert.match(router, /path: 'importar\/pendientes',[\s\S]*?<PendientesCatalogo/,
  'la bandeja de pendientes debe seguir disponible como lectura')
assert.match(router, /element: <AdminRoute \/>[\s\S]*?path: 'admin'/,
  'Admin de personas debe conservar su guard de gerente de sucursal')

assert.match(layout, /gestionaCatalogo \? \[IMPORT_NAV_ITEM\] : \[\]/,
  'Importar debe aparecer por capacidad de catálogo, no por capacidad administrativa')
assert.match(layout, /administraSucursal \? \[ADMIN_NAV_ITEM\] : \[\]/,
  'Admin debe seguir reservado al gerente de sucursal')

assert.match(pendientes, /puedeGestionarPendiente = useCallback/,
  'la bandeja debe evaluar escritura pendiente por pendiente')
assert.match(pendientes, /pendiente\.sucursales\.some\(\(s\) => sucursalesGestionables\.has\(s\.id\)\)/,
  'un pendiente sólo es editable si tiene una detección en una sucursal gestionable')
assert.match(pendientes, /Parte de esta bandeja es sólo lectura/,
  'la UI debe explicar explícitamente el modo de lectura zonal')
assert.match(pendientes, /const editable = puedeGestionarPendiente\(p\)/,
  'cada card debe derivar su capacidad antes de mostrar controles')
assert.match(pendientes, /editable \? \([\s\S]*?Clasificar para toda la organización[\s\S]*?: \([\s\S]*?Solo lectura en tu alcance actual/,
  'los controles de clasificación no deben renderizarse para ítems de sólo lectura')

console.log('✓ Catálogo UI: zonal lee, gerente/supervisor local escriben y Admin sigue separado')
