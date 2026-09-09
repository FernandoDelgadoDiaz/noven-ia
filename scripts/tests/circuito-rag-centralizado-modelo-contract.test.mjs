import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migration = fs.readFileSync(path.join(
  root,
  'supabase/migrations/20260909020007_circuito_rag_centralizado_modelo_estados_v1.sql',
), 'utf8')
const types = fs.readFileSync(path.join(root, 'src/types/index.ts'), 'utf8')

assert.match(migration, /CREATE TABLE public\.solicitudes_cambio_rag/)
assert.match(migration, /CREATE TABLE public\.solicitud_cambio_rag_eventos/)
assert.match(migration, /FOREIGN KEY \(organizacion_id, porcentaje_solicitado\)[\s\S]*?rag_escala_descuento/)
assert.match(migration, /FOREIGN KEY \(sucursal_id, zona_id, organizacion_id\)/)
assert.match(migration, /FOREIGN KEY \(vencimiento_id, producto_id, sucursal_id\)/)

// La solicitud y sus eventos sólo se leen desde el browser. Las transiciones
// de los siguientes bloques deberán pasar por RPCs, nunca por DML directo.
for (const table of ['solicitudes_cambio_rag', 'solicitud_cambio_rag_eventos']) {
  assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`))
  assert.match(migration, new RegExp(`GRANT SELECT ON TABLE public\\.${table} TO authenticated`))
  assert.doesNotMatch(
    migration,
    new RegExp(`GRANT (?:INSERT|UPDATE|DELETE)[\\s\\S]{0,80}public\\.${table}[\\s\\S]{0,20}authenticated`, 'i'),
    `${table} no admite DML directo del browser`,
  )
}

assert.match(migration, /BEFORE UPDATE OR DELETE ON public\.solicitudes_cambio_rag/)
assert.match(migration, /BEFORE UPDATE OR DELETE ON public\.solicitud_cambio_rag_eventos/)
assert.match(migration, /Transición RAG centralizada inválida/)
assert.match(migration, /v_anterior\.tipo = 'solicitada' AND NEW\.tipo <> 'ejecutada'/)
assert.match(migration, /v_anterior\.tipo = 'ejecutada' AND NEW\.tipo NOT IN \('confirmada', 'no_aplicada'\)/)
assert.match(migration, /v_anterior\.tipo = 'no_aplicada' AND NEW\.tipo <> 'ejecutada'/)
assert.match(migration, /NEW\.habilitada_desde <> v_fecha_evento \+ 1/)
assert.match(migration, /NEW\.ocurrida_at < v_solicitud\.creada_at/)
assert.match(migration, /NEW\.ocurrida_at < v_anterior\.ocurrida_at/)

assert.match(migration, /ua\.rol = 'administrativa_precios_zonal'[\s\S]*?ua\.zona_id = v_solicitud\.zona_id/)
assert.match(migration, /NEW\.tipo = 'ejecutada'[\s\S]*?administrativa_precios_zonal/)
assert.match(migration, /NEW\.tipo = 'solicitada'[\s\S]*?gerente_sucursal', 'supervisor'/)
assert.match(migration, /NEW\.tipo IN \('confirmada', 'no_aplicada'\)[\s\S]*?ua\.rol = 'operador'/)

assert.match(migration, /CREATE VIEW public\.v_solicitudes_cambio_rag_actual[\s\S]*?security_invoker = true/)
assert.match(migration, /THEN 'ejecutada_no_habilitada'/)
assert.match(migration, /WHEN ultimo\.tipo = 'ejecutada' THEN 'lista_confirmacion'/)

assert.match(migration, /ADD COLUMN solicitud_cambio_rag_id uuid/)
assert.match(migration, /UNIQUE \(solicitud_cambio_rag_id\)/)
assert.match(types, /\| 'administrativa_precios_zonal'/)

// El rol nuevo sólo aparece en su modelo y helper específico. Enumerarlo en un
// helper operativo existente le regalaría scanner/radar/escrituras por accidente.
for (const file of [
  'supabase/migrations/20260828000210_role_scope_invariants_v2.sql',
  'supabase/migrations/20260828000220_zonal_read_only_boundary_v1.sql',
  'src/hooks/usePuedeOperarSucursal.ts',
  'src/hooks/usePuedeVerAnalisis.ts',
  'src/hooks/usePuedeGestionarCatalogoSucursal.ts',
]) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  assert.doesNotMatch(source, /administrativa_precios_zonal/, `${file} no debe heredar el rol nuevo`)
}

console.log('✓ circuito RAG centralizado: modelo inmutable, estados y rol zonal acotado')
