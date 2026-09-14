// Regresión del incidente en que una solicitud RAG usaba clock_timestamp()
// mientras su primer evento heredaba DEFAULT now() (inicio de transacción).
// El trigger temporal rechazaba entonces una operación válida y revertía todo.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const MIGRATION = path.join(
  ROOT,
  'supabase/migrations/20260914232526_fijar_timestamp_primer_evento_rag.sql',
)

const migration = fs.readFileSync(MIGRATION, 'utf8')

function sinComentarios(sql) {
  return sql.replace(/^\s*--.*$/gm, '')
}

function cuerpoSolicitud(sql) {
  const funcion = sinComentarios(sql).match(
    /CREATE OR REPLACE FUNCTION noven_private\.solicitar_cambio_rag_impl\([\s\S]*?\n\$\$;/,
  )?.[0]

  assert.ok(funcion, 'falta redefinir solicitar_cambio_rag_impl en el hotfix')
  return funcion
}

function verificarTimestampCompartido(sql) {
  const funcion = cuerpoSolicitud(sql)

  assert.match(funcion, /v_creada_at := clock_timestamp\(\);/)
  assert.match(
    funcion,
    /creada_at,\s*jornada_zonal\s*\) VALUES \([\s\S]*?v_creada_at,\s*v_jornada_zonal\s*\)/,
    'la solicitud debe persistir el instante capturado por el servidor',
  )
  assert.match(
    funcion,
    /INSERT INTO public\.solicitud_cambio_rag_eventos \(\s*solicitud_id,\s*tipo,\s*actor_id,\s*ocurrida_at\s*\) VALUES \(\s*v_solicitud_id,\s*'solicitada',\s*v_uid,\s*v_creada_at\s*\);/,
    'el primer evento debe usar exactamente el timestamp de la solicitud',
  )
}

verificarTimestampCompartido(migration)

assert.match(
  migration,
  /REVOKE ALL ON FUNCTION noven_private\.solicitar_cambio_rag_impl\(uuid\)\s+FROM PUBLIC, anon, authenticated, service_role;/,
)
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION noven_private\.solicitar_cambio_rag_impl\(uuid\)\s+TO authenticated, service_role;/,
)

// Prueba mutacional: si alguien vuelve a dejar que el primer evento tome now(),
// el contrato debe ponerse rojo aunque la columna siga estando explícita.
const mutante = migration.replace(
  /('solicitada',\s*v_uid,\s*)v_creada_at/,
  '$1now()',
)
assert.notEqual(mutante, migration, 'el mutante no alteró la migración')
assert.throws(
  () => verificarTimestampCompartido(mutante),
  /primer evento debe usar exactamente/,
)

console.log('Contrato timestamp del primer evento RAG OK')
