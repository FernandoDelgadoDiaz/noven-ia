import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const SRC = path.join(ROOT, 'src')

// Superficie autenticada de NOVEN verificada en producción.
// Cualquier incorporación aquí requiere revisión explícita de alcance/RLS/RPC.
const ALLOWED_BROWSER_RPCS = new Set([
  'aceptar_invitacion_acceso_v1',
  'actualizar_imagen_producto_operador_v2',
  'anular_vencimiento_carga_incorrecta',
  'buscar_conflicto_codigos_scanner',
  'buscar_producto_scanner',
  'cerrar_vencimiento_operativo',
  'completar_cod_art_producto_scanner',
  'crear_producto_scanner',
  'guardar_vencimiento_y_stock_scanner_v1',
  'listar_familias_scanner',
  'listar_mis_alertas_zonales_v1',
  'modo_imagen_producto_operador',
  'registrar_control_vencimiento_dashboard',
  'responder_alerta_zonal_v1',
  'vincular_ean_producto_scanner',
])

function archivosFuente(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...archivosFuente(abs))
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(abs)
  }
  return out
}

const usados = new Map()
const rpcPattern = /\.rpc\(\s*['"]([^'"]+)['"]/g

for (const abs of archivosFuente(SRC)) {
  const source = fs.readFileSync(abs, 'utf8')
  let match
  while ((match = rpcPattern.exec(source)) !== null) {
    const name = match[1]
    const refs = usados.get(name) ?? []
    refs.push(path.relative(ROOT, abs))
    usados.set(name, refs)
  }
}

const noAprobadas = [...usados.keys()].filter((name) => !ALLOWED_BROWSER_RPCS.has(name)).sort()
assert.deepEqual(
  noAprobadas,
  [],
  `RPC browser sin revisión explícita: ${noAprobadas.join(', ')}`,
)

const aprobadasSinCaller = [...ALLOWED_BROWSER_RPCS].filter((name) => !usados.has(name)).sort()
assert.deepEqual(
  aprobadasSinCaller,
  [],
  `RPC autenticadas aprobadas pero sin caller browser: ${aprobadasSinCaller.join(', ')}. Revisar si corresponde revocar EXECUTE.`,
)

assert.equal(usados.size, 15, 'La superficie browser esperada debe permanecer en 15 RPC explícitas')
assert.ok(!usados.has('listar_resumen_radar_zonal_v1'), 'el resumen Radar huérfano no debe volver al navegador')

console.log(`✓ Allowlist browser RPC: ${usados.size} entradas explícitas y sin superficie huérfana`)
