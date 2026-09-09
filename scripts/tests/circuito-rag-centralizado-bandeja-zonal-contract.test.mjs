import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const migration = read('supabase/migrations/20260909144530_rag_centralizado_bandeja_zonal_v1.sql')
const page = read('src/pages/BandejaRagZonal.tsx')
const accessPage = read('src/pages/AdminAccesos.tsx')
const accessApi = read('netlify/functions/admin-accesos.ts')
const invitationApi = read('netlify/functions/admin-invitaciones.ts')
const layout = read('src/components/layout/AppLayout.tsx')
const router = read('src/router/index.tsx')
const ragRoute = read('src/components/auth/RagZonalRoute.tsx')
const standardRoute = read('src/components/auth/StandardAppRoute.tsx')
const defaultRoute = read('src/components/auth/DefaultAuthenticatedRoute.tsx')
const e2e = read('e2e/critical-flows.spec.mjs')
const e2eFixture = read('e2e/fixtures/rag-zonal-fixture.mjs')
const liveGates = read('scripts/live-isolation/gates-1-3.mjs')

function functionDefinition(pattern, message) {
  const definition = migration.match(pattern)?.[0]
  assert.ok(definition, message)
  return definition
}

const context = functionDefinition(
  /CREATE OR REPLACE FUNCTION public\.listar_contexto_altas_v1\([\s\S]*?\n\$\$;/,
  'falta el contexto de altas con cobertura zonal',
)
const registerInvitation = functionDefinition(
  /CREATE OR REPLACE FUNCTION public\.registrar_invitacion_acceso_v1\([\s\S]*?\n\$\$;/,
  'falta el alta jerárquica del rol de precios',
)
const listImpl = functionDefinition(
  /CREATE OR REPLACE FUNCTION noven_private\.listar_bandeja_rag_zonal_impl\(\)[\s\S]*?\n\$\$;/,
  'falta la implementación privada de la bandeja zonal',
)
const executeImpl = functionDefinition(
  /CREATE OR REPLACE FUNCTION noven_private\.ejecutar_solicitud_cambio_rag_impl\([\s\S]*?\n\$\$;/,
  'falta la implementación privada de la ejecución',
)

assert.match(migration, /rol IN \('gerente_zonal', 'administrativa_precios_zonal'\)[\s\S]*?zona_id IS NOT NULL[\s\S]*?sucursal_id IS NULL/,
  'la invitación del rol nuevo debe exigir zona y prohibir sucursal')
assert.match(registerInvitation, /p_rol NOT IN \([\s\S]*?'administrativa_precios_zonal'/)
assert.match(registerInvitation, /p_rol IN \('gerente_zonal', 'administrativa_precios_zonal'\)[\s\S]*?p_zona_id IS NULL OR p_sucursal_id IS NOT NULL/)
assert.doesNotMatch(registerInvitation, /FROM public\.usuario_accesos/,
  'el alta no debe depender de que ya exista una persona con cobertura gerencial')
assert.match(context, /'gerentes_zonales_pendientes'/)
assert.match(context, /'administrativas_precios_pendientes'/)
assert.match(accessPage, /Invitar gerente zonal/)
assert.match(accessPage, /Continuar sin gerente zonal/,
  'la falta de gerente debe pedir una decisión explícita pero permitir continuar')
assert.match(accessApi, /rol === 'gerente_zonal' \|\| rol === 'administrativa_precios_zonal'/)
assert.match(invitationApi, /detalle\.rol === 'administrativa_precios_zonal'/,
  'regenerar debe conservar el circuito jerárquico y la zona')

for (const definition of [listImpl, executeImpl]) {
  assert.match(definition, /SECURITY DEFINER/)
  assert.match(definition, /SET search_path TO ''/)
  assert.match(definition, /auth\.uid\(\)/,
    'la identidad efectiva se resuelve dentro del servidor')
  assert.match(definition, /ua\.rol = 'administrativa_precios_zonal'/)
  assert.match(definition, /ua\.sucursal_id IS NULL/)
  assert.match(definition, /ua\.activo = true/)
}

assert.match(listImpl, /ua\.zona_id = s\.zona_id/,
  'cada solicitud debe coincidir con la zona exacta del acceso')
assert.match(listImpl, /s\.ultimo_evento IN \('solicitada', 'no_aplicada', 'ejecutada'\)/)
assert.match(listImpl, /s\.ultimo_evento_at >= now\(\) - interval '24 hours'/,
  'los ejecutados permanecen visibles sólo durante la ventana acordada')
assert.match(listImpl, /ORDER BY[\s\S]*?bandeja\.sucursal_codigo[\s\S]*?bandeja\.sector_nombre[\s\S]*?bandeja\.familia_nombre[\s\S]*?bandeja\.fin_accion/,
  'el orden operativo es sucursal, sector/familia y fin de acción')

assert.match(executeImpl, /WHERE s\.id = p_solicitud_id[\s\S]*?FOR UPDATE/,
  'la ejecución debe serializar doble click y concurrencia')
assert.match(executeImpl, /ua\.organizacion_id = v_solicitud\.organizacion_id[\s\S]*?ua\.zona_id = v_solicitud\.zona_id/,
  'la ejecución vuelve a validar organización y zona exactas')
assert.match(executeImpl, /IF v_ultimo\.tipo = 'ejecutada' THEN[\s\S]*?RETURN v_ultimo\.id/,
  'un reintento debe devolver el evento existente')
assert.match(executeImpl, /v_ultimo\.tipo NOT IN \('solicitada', 'no_aplicada'\)/)
assert.match(executeImpl, /v_ocurrida_at := clock_timestamp\(\)[\s\S]*?INSERT INTO public\.solicitud_cambio_rag_eventos/,
  'la hora se toma después del lock y justo antes de insertar')
assert.match(executeImpl, /AT TIME ZONE 'America\/Argentina\/Buenos_Aires'\)::date \+ 1/)
assert.doesNotMatch(executeImpl, /(?:INSERT INTO|UPDATE) public\.intervenciones_rag/,
  'ejecutar no puede abrir ni modificar el tramo RAG')

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.listar_bandeja_rag_zonal\(\)[\s\S]*?SECURITY INVOKER/)
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.ejecutar_solicitud_cambio_rag\([\s\S]*?SECURITY INVOKER/)
for (const signature of [
  'noven_private\\.listar_bandeja_rag_zonal_impl\\(\\)',
  'public\\.listar_bandeja_rag_zonal\\(\\)',
  'noven_private\\.ejecutar_solicitud_cambio_rag_impl\\(uuid\\)',
  'public\\.ejecutar_solicitud_cambio_rag\\(uuid\\)',
]) {
  assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION ${signature}[\\s\\S]{0,100}FROM PUBLIC, anon, authenticated, service_role`))
  assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION ${signature}[\\s\\S]{0,80}TO authenticated, service_role`))
}

assert.equal((page.match(/supabase\.rpc\(/g) ?? []).length, 2,
  'la pantalla usa sólo las RPC de listar y ejecutar')
assert.match(page, /supabase\.rpc\('listar_bandeja_rag_zonal'\)/)
assert.match(page, /supabase\.rpc\('ejecutar_solicitud_cambio_rag'/)
assert.doesNotMatch(page, /supabase\.from\(/,
  'el browser no escribe ni compone la bandeja desde tablas')
assert.match(page, /timeZone: 'America\/Argentina\/Buenos_Aires'/)
assert.match(page, /Marcar como ejecutada/)
assert.doesNotMatch(page, /Exportar|Imprimir|Ejecutar seleccionadas|confirmar_solicitud_cambio_rag/,
  'lote, exportación y confirmación en góndola pertenecen a bloques posteriores')

assert.match(ragRoute, /rol === 'administrativa_precios_zonal'[\s\S]*?Boolean\(acceso\.zona_id\)[\s\S]*?acceso\.sucursal_id === null/)
assert.match(router, /element: <RagZonalRoute \/>[\s\S]*?path: 'rag\/zona'/)
assert.match(standardRoute, /esSoloAdministrativaPrecios[\s\S]*?<Navigate to="\/rag\/zona" replace \/>/)
assert.match(defaultRoute, /esSoloAdministrativaPrecios \? '\/rag\/zona' : '\/dashboard'/)
assert.match(layout, /esSoloAdministrativaPrecios \? \[\] : BASE_NAV_ITEMS/)
assert.match(layout, /!esSoloAdministrativaPrecios[\s\S]*?&& soportado/,
  'el rol puro no recibe la invitación a notificaciones operativas')
assert.match(layout, /!esSoloAdministrativaPrecios && <SucursalContextSelector/)
assert.match(e2e, /name: 'Continuar sin gerente zonal'/)
assert.match(e2e, /name: 'Marcar como ejecutada'/)
assert.match(e2e, /p_solicitud_id: RAG_ZONAL_IDS\.request/)
assert.match(e2eFixture, /rpc === 'listar_bandeja_rag_zonal'/)
assert.match(e2eFixture, /rpc === 'ejecutar_solicitud_cambio_rag'/)
assert.match(liveGates, /Gate 4: administrativa ejecuta sólo su zona/)
assert.match(liveGates, /cross-zone execution was not rejected/)
assert.match(liveGates, /double click created more than one execution event/)
assert.match(liveGates, /execution opened a RAG intervention/)

console.log('✓ bloque 3 RAG: alta zonal no bloqueante, bandeja acotada y ejecución individual idempotente')
