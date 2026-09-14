import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const SRC = path.join(ROOT, 'src')

// Superficie RPC browser de NOVEN auditada explícitamente.
// Cualquier incorporación aquí requiere revisión de alcance/RLS/RPC.
const ALLOWED_BROWSER_RPCS = new Set([
  'aceptar_invitacion_acceso_v1',
  // Precondición de seguridad: la contraseña sólo se toca si la identidad
  // actual tiene una invitación pendiente y vigente con el mismo email.
  'validar_invitacion_pendiente_v1',
  'actualizar_imagen_producto_operador_v2',
  'anular_vencimiento_carga_incorrecta',
  'buscar_conflicto_codigos_scanner',
  'buscar_producto_scanner',
  'cerrar_vencimiento_operativo',
  'completar_cod_art_producto_scanner',
  // Lee exclusivamente los insumos server-side de la última caída para que el
  // cliente decida si corresponde preguntar; no acepta cantidades calculadas
  // por el navegador.
  'contexto_salida_control',
  'crear_producto_scanner',
  // Declara la causa sobre una observación ya autorizada. Las unidades se
  // derivan en el servidor y una transferencia nunca se vuelve venta.
  'declarar_salida_no_venta',
  // C2 separa cada cierre por tipo: ninguna de estas RPC puede cerrar "la viva".
  'finalizar_oferta_central',
  'finalizar_rag_vigente',
  'guardar_vencimiento_y_stock_scanner_v1',
  // El click abre una oferta central desde el stock ya conocido; no recibe ni
  // permite retrotraer fecha de inicio.
  'informar_oferta_central',
  // Constata el primer RAG de un vencimiento. Autoriza por alcance sobre el
  // producto —constatar un hecho no es autorizar un cambio— y no puede tocar un
  // RAG vigente: ese camino sigue siendo el circuito centralizado.
  'informar_rag',
  // Lectura dedicada: devuelve sólo las zonas activas del rol de precios y las
  // solicitudes operables de esas zonas.
  'listar_bandeja_rag_zonal',
  'listar_familias_scanner',
  'listar_mis_alertas_zonales_v1',
  'modo_imagen_producto_operador',
  'registrar_control_vencimiento_dashboard',
  'responder_alerta_zonal_v1',
  // El browser identifica el vencimiento; rol, alcance, porcentaje y snapshot
  // se resuelven dentro de la implementación server-side.
  'solicitar_cambio_rag',
  // La administrativa identifica una solicitud; actor, zona, estado y fecha de
  // habilitación se resuelven en servidor y el doble click es idempotente.
  'ejecutar_solicitud_cambio_rag',
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
  `RPC aprobadas pero sin caller browser: ${aprobadasSinCaller.join(', ')}. Revisar si corresponde revocar EXECUTE.`,
)

assert.equal(usados.size, 25, 'La superficie browser esperada debe permanecer en 25 RPC explícitas')
assert.equal(usados.has('listar_resumen_radar_zonal_v1'), false, 'El resumen Radar huérfano no debe volver al navegador')

console.log(`✓ Allowlist browser RPC: ${usados.size} entradas explícitas y sin superficie huérfana`)
