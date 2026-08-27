import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

const migration = read('supabase/migrations/20260827000340_radar_zonal_v1.sql')
const push = read('netlify/functions/enviar-push-radar-zonal.ts')
const hook = read('src/hooks/useRadarZonal.ts')

assert.match(migration, /ps\.stock_actual\s*>\s*0/, 'Radar Zonal debe filtrar sucursales con stock positivo')
assert.match(migration, /sd\.zona_id\s*=\s*v_zona/, 'Radar Zonal debe limitar candidatos a la misma zona')
assert.match(migration, /usuario_familias_sucursal/, 'El destinatario debe resolverse por familia × sucursal')
assert.match(migration, /ua\.rol\s*=\s*'operador'/, 'La notificación operativa debe dirigirse al operador responsable')
assert.match(migration, /vx\.activo\s*=\s*true/, 'Debe detectar seguimiento local activo antes de notificar')
assert.match(migration, /'ya_controlado'/, 'Una sucursal que ya controla el SKU debe quedar excluida de la notificación')
assert.match(migration, /UNIQUE \(zona_id, producto_id, fecha_vencimiento\)/, 'Debe existir un solo evento por zona + producto + fecha')
assert.match(migration, /'misma_fecha','otra_fecha','no_lo_tengo','revisar_despues'/, 'Debe preservar las cuatro respuestas operativas del MVP')
assert.match(migration, /cantidad comprometida/i, 'El contrato debe distinguir stock total de cantidad comprometida')

assert.match(push, /alerta_zonal_id/, 'El push debe despacharse por evento zonal')
assert.match(push, /alertas_zonales_destinos/, 'El push debe usar destinatarios prefiltrados por la base')
assert.doesNotMatch(push, /\.from\(['"]usuario_familias['"]\)/, 'El push zonal no debe volver al mapping legacy global por familia')
assert.doesNotMatch(push, /\.from\(['"]usuarios['"]\).*\.eq\(['"]rol['"],\s*['"]admin['"]\)/s, 'El push zonal no debe notificar administradores globales por defecto')

assert.match(hook, /listar_mis_alertas_zonales_v1/, 'La UI debe leer la bandeja zonal scoped')
assert.match(hook, /responder_alerta_zonal_v1/, 'La UI debe responder mediante RPC atómico')

console.log('✓ Radar Zonal respeta zona, stock, familia, responsabilidad y no redundancia')
