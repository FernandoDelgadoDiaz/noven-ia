import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const migration = read('supabase/migrations/20260909092814_rag_centralizado_validacion_sucursal_v1.sql')
const modal = read('src/components/dashboard/EditarVencimientoModalSeguro.tsx')
const badge = read('src/components/dashboard/RagSeguimientoBadge.tsx')
const bandeja = read('src/components/dashboard/BandejaRagSucursal.tsx')
const hook = read('src/hooks/useSolicitudCambioRag.ts')
const e2e = read('e2e/critical-flows.spec.mjs')
const e2eFixture = read('e2e/fixtures/scanner-write-fixture.mjs')

const impl = migration.match(
  /CREATE OR REPLACE FUNCTION noven_private\.solicitar_cambio_rag_impl\([\s\S]*?\n\$\$;/,
)?.[0]
assert.ok(impl, 'falta la implementación privada de la solicitud')

assert.match(impl, /p_vencimiento_id uuid/)
assert.doesNotMatch(impl, /p_(?:porcentaje|rol|sucursal|zona|organizacion|cobertura)/,
  'el cliente no puede aportar decisión, alcance ni evidencia')
assert.match(impl, /auth\.uid\(\)/, 'la identidad se resuelve server-side')
assert.match(impl, /FOR UPDATE OF v/, 'el vencimiento se bloquea para serializar doble click')
assert.match(impl, /ua\.rol IN \('gerente_sucursal', 'supervisor'\)/,
  'sólo gerencia o supervisión de la sucursal validan')
assert.match(impl, /ua\.sucursal_id = v_sucursal_id/,
  'el permiso debe coincidir con la sucursal del vencimiento')
assert.match(impl, /ultimo\.tipo <> 'confirmada'/,
  'una solicitud abierta se reutiliza de forma idempotente')
assert.match(impl, /JOIN LATERAL \([\s\S]*?FROM public\.rag_escala_descuento/,
  'el siguiente escalón se deriva de la escala autorizada')
assert.match(impl, /sg\.estado_seguimiento_rag IN \('insuficiente', 'sin_movimiento'\)/)
assert.match(impl, /INSERT INTO public\.solicitudes_cambio_rag/,
  'la decisión crea un snapshot inmutable')
assert.match(impl, /INSERT INTO public\.solicitud_cambio_rag_eventos/,
  'la solicitud nace con su primer evento en la misma transacción')
assert.doesNotMatch(impl, /(?:INSERT INTO|UPDATE) public\.intervenciones_rag/,
  'solicitar no abre ni modifica una intervención')

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.solicitar_cambio_rag\([\s\S]*?SECURITY INVOKER/)
assert.match(migration, /REVOKE ALL ON FUNCTION public\.solicitar_cambio_rag\(uuid\)[\s\S]{0,100}FROM PUBLIC, anon, authenticated, service_role/)
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.solicitar_cambio_rag\(uuid\)[\s\S]{0,80}TO authenticated, service_role/)
assert.match(migration, /IF p_porcentaje_rag IS NOT NULL THEN[\s\S]*?circuito centralizado/,
  'la RPC de control debe rechazar el atajo de porcentaje')
assert.match(migration, /REVOKE ALL ON FUNCTION public\.instrumentar_sugerencia_rag/,
  'la instrumentación anterior deja de ser superficie browser')

assert.match(modal, /Informar \$\{sugerencia\.hasta\}%/)
assert.match(modal, /Requiere gerente o supervisor/)
assert.match(modal, /p_porcentaje_rag: null/)
assert.match(modal, /supabase\.rpc\('solicitar_cambio_rag'/)
assert.doesNotMatch(modal, /instrumentar_sugerencia_rag|setRagPorcentaje/)
assert.match(badge, /Pendiente de ejecución zonal/)
assert.match(badge, /Lista para verificar en góndola/)
assert.match(badge, /operadora asignada a la familia/,
  'el seguimiento deja explícito quién puede verificar en góndola')
assert.match(bandeja, /espera_validacion: 'Esperando validación'/)
assert.match(bandeja, /a\.diasComerciales - b\.diasComerciales \|\| b\.dineroRiesgo - a\.dineroRiesgo/,
  'la bandeja ordena por urgencia y después por dinero, sin score compuesto')
assert.match(bandeja, /\.from\('v_solicitudes_cambio_rag_actual'\)/)
assert.match(bandeja, /\.from\('v_seguimiento_rag_actual'\)/)
assert.doesNotMatch(bandeja, /\.rpc\(/,
  'la bandeja del gerente es seguimiento; la acción sigue dentro del producto')

assert.match(hook, /from\('v_solicitudes_cambio_rag_actual'\)/)
assert.match(hook, /\.order\('creada_at', \{ ascending: false \}\)/)
assert.match(hook, /error: error\.message/,
  'un error real no se disfraza como ausencia de solicitud')
assert.match(hook, /disponible: false/,
  'el despliegue gradual tolera que la vista todavía no exista')

assert.match(e2e, /getByRole\('button', \{ name: 'Informar 30%' \}\)/,
  'el recorrido E2E valida la nueva acción gerencial')
assert.match(e2e, /call\.name === 'solicitar_cambio_rag'/)
assert.match(e2e, /registrar_control_vencimiento_dashboard'\)\)\.toHaveLength\(0\)/,
  'el recorrido prueba que informar no reutiliza la RPC de control')
assert.doesNotMatch(e2e, /getByPlaceholder\('Ej\. 30'\)/,
  'el E2E no puede reintroducir el porcentaje editable anterior')
assert.match(e2eFixture, /rpc === 'solicitar_cambio_rag'/)

console.log('✓ Validación sucursal: solicitud server-side, idempotente y sin cambio directo de precio')
console.log('✓ UI: gerencia informa; operadora ve restricción y seguimiento del estado')
