import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const migration = read('supabase/migrations/20260828000230_server_write_scope_v1.sql')
const masiva = read('netlify/functions/importar-asistido-completo.ts')
const aprender = read('netlify/functions/aprender-pendientes-familia.ts')
const resolver = read('netlify/functions/resolver-pendiente-catalogo.ts')
const listar = read('netlify/functions/listar-pendientes-catalogo.ts')
const analisis = read('netlify/functions/analisis.ts')

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.validar_operacion_local_server_v1/)
assert.match(migration, /ua\.rol IN \('gerente_sucursal','supervisor'\)/)
const operationGate = migration.match(/CREATE OR REPLACE FUNCTION public\.validar_operacion_local_server_v1[\s\S]*?\$\$;/)?.[0] ?? ''
assert.doesNotMatch(operationGate, /gerente_zonal|admin_organizacion/,
  'gate de escritura no admite zonal ni jerarquía')

assert.match(migration, /ALTER FUNCTION public\.aplicar_importacion_glaciar_familia_v1[\s\S]*?RENAME TO aplicar_importacion_glaciar_familia_legacy_v1/)
assert.match(migration, /CREATE FUNCTION public\.aplicar_importacion_glaciar_familia_v1[\s\S]*?validar_operacion_local_server_v1/)
assert.match(migration, /ALTER FUNCTION public\.aplicar_importacion_glaciar_masiva_v2[\s\S]*?RENAME TO aplicar_importacion_glaciar_masiva_legacy_v2/)
assert.match(migration, /CREATE FUNCTION public\.aplicar_importacion_glaciar_masiva_v2[\s\S]*?validar_operacion_local_server_v1/)
assert.match(migration, /ALTER FUNCTION public\.resolver_producto_pendiente_catalogo[\s\S]*?RENAME TO resolver_producto_pendiente_catalogo_legacy_v1/)
assert.match(migration, /CREATE FUNCTION public\.resolver_producto_pendiente_catalogo[\s\S]*?validar_resolucion_pendiente_server_v1/)
assert.match(migration, /ALTER FUNCTION public\.resolver_pendientes_catalogo_por_familia_csv[\s\S]*?RENAME TO resolver_pendientes_catalogo_por_familia_csv_legacy_v1/)
assert.match(migration, /CREATE FUNCTION public\.resolver_pendientes_catalogo_por_familia_csv[\s\S]*?validar_operacion_local_server_v1/)

for (const legacy of [
  'aplicar_importacion_glaciar_familia_legacy_v1',
  'aplicar_importacion_glaciar_masiva_legacy_v2',
  'resolver_producto_pendiente_catalogo_legacy_v1',
  'resolver_pendientes_catalogo_por_familia_csv_legacy_v1',
]) {
  assert.match(
    migration,
    new RegExp(`REVOKE ALL ON FUNCTION public\\.${legacy}[\\s\\S]*?service_role`),
    `${legacy} debe quedar inaccesible incluso al service_role directo`,
  )
}

assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.aplicar_importacion_glaciar_masiva\([\s\S]*?service_role/,
  'la implementación masiva base tampoco puede quedar invocable directamente por service_role',
)
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.listar_productos_pendientes_catalogo\(uuid\)[\s\S]*?service_role/,
  'la lectura legacy de pendientes no puede reabrir scope admin_organizacion desde un Function',
)

assert.match(masiva, /validar_operacion_local_server_v1/)
assert.ok(masiva.indexOf('validar_operacion_local_server_v1') < masiva.indexOf('Buffer.from(archivoBase64'),
  'importación masiva autoriza antes de procesar archivo')
assert.match(aprender, /validar_operacion_local_server_v1/)
assert.ok(aprender.indexOf('validar_operacion_local_server_v1') < aprender.indexOf('Buffer.from(archivoBase64'),
  'aprendizaje autoriza antes de procesar archivo')
assert.match(resolver, /validar_resolucion_pendiente_server_v1/)
assert.match(listar, /listar_productos_pendientes_catalogo_v2/)
assert.doesNotMatch(listar, /rpc\('listar_productos_pendientes_catalogo'/,
  'el caller debe usar exclusivamente la lectura v2 filtrada')

const pendingRead = migration.match(/CREATE OR REPLACE FUNCTION public\.listar_productos_pendientes_catalogo_v2[\s\S]*?\$\$;/)?.[0] ?? ''
assert.match(pendingRead, /ua\.rol='gerente_zonal' AND ua\.zona_id=s\.zona_id/)
assert.match(pendingRead, /ua\.rol IN \('gerente_sucursal','supervisor'\)[\s\S]*?ua\.sucursal_id=s\.id/)
assert.doesNotMatch(pendingRead, /admin_organizacion/,
  'jerarquía no amplía la lectura de pendientes')

const analysisScope = analisis.match(/const alcanceGerencial = accesos\.some\([\s\S]*?\n\s*\)/)?.[0] ?? ''
assert.ok(analysisScope, 'Análisis IA debe tener un gate de scope explícito')
assert.match(analysisScope, /gerente_zonal/)
assert.match(analysisScope, /gerente_sucursal/)
assert.match(analysisScope, /supervisor/)
assert.doesNotMatch(analysisScope, /admin_organizacion/,
  'admin_organizacion no debe abrir sucursales en Análisis IA')
assert.doesNotMatch(analysisScope, /operador/,
  'el análisis gerencial no se concede al operador')

console.log('✓ writers server-only locales + lecturas zonales sin expansión jerárquica')
