import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260830150000_problemas_activos_seguimiento_v1.sql'),
  'utf8',
)
const endpoint = fs.readFileSync(path.join(root, 'netlify/functions/problemas-activos.ts'), 'utf8')

assert.match(migration, /respondido_at/)
assert.match(migration, /respondido_por/)
assert.match(migration, /respuesta_tipo/)
assert.match(migration, /DROP CONSTRAINT IF EXISTS rag_escalamientos_unico_por_intervencion/)
assert.match(migration, /UNIQUE \(rag_id, observacion_id\)/)
assert.match(migration, /ON CONFLICT \(rag_id, observacion_id\) DO NOTHING/)
assert.match(migration, /vencimiento_observaciones_respuesta_escalamiento_trg/)
assert.match(migration, /intervenciones_rag_respuesta_escalamiento_trg/)
assert.match(migration, /acciones_operativas_respuesta_escalamiento_trg/)
assert.match(migration, /'control'/)
assert.match(migration, /'nueva_intervencion'/)
assert.match(migration, /'cierre_terminal'/)

assert.match(endpoint, /\.from\('v_vencimientos_operativos'\)/,
  'el alcance debe resolverse con el JWT sobre la vista operativa')
assert.match(endpoint, /global: \{ headers: \{ Authorization: `Bearer \$\{token\}` \} \}/)
assert.match(endpoint, /\.from\('rag_escalamientos'\)/,
  'el service role puede enriquecer sólo los vencimientos ya autorizados')
assert.match(endpoint, /\.in\('vencimiento_id', vencimientoIds\)/)
assert.match(endpoint, /producto_costo_ultima_observacion/)
assert.match(endpoint, /dinero_en_riesgo_sin_iva/)
assert.match(endpoint, /escalado_sin_respuesta/)
assert.match(endpoint, /intervencion_aplicada/)
assert.match(endpoint, /bajo_control/)
assert.match(endpoint, /requiere_cierre/)
assert.match(endpoint, /prioridad_orden/)
assert.match(endpoint, /problema_economico_activo_v1/)
assert.match(endpoint, /if \(estado === 'requiere_intervencion'\) return nivel === 'urgente' \? 4 : 5/,
  'una urgencia bajo control no debe desplazar problemas sin intervención')
assert.match(endpoint, /if \(estado === 'bajo_control'\) return nivel === 'urgente' \? 8 : 9/,
  'bajo control debe quedar detrás de los problemas que todavía requieren acción')
assert.match(endpoint, /Urgencia temporal bajo control: mantener seguimiento/)
assert.match(endpoint, /Riesgo activo sin RAG registrado en Noven: verificar en Glaciar/)
assert.doesNotMatch(endpoint, /00000000-0000-0000-0000-000000000001/,
  'el endpoint no debe hardcodear Sucursal 091')
assert.doesNotMatch(endpoint, /RAG \d+% recomendado|recomendado.*RAG/i,
  'el seguimiento no inventa porcentajes RAG')

console.log('✓ Problemas activos: respuesta, reescalamiento y prioridad por acción económica protegidos')
