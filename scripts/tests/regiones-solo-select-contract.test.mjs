// Contrato de la migración que reduce `public.regiones` a SELECT.
//
// `regiones` era la única tabla de negocio con DML abierto a `authenticated`.
// No era explotable —la única política cubre SELECT, así que un INSERT moría en
// RLS— pero la protección dependía de una AUSENCIA: que nadie hubiera escrito
// todavía una política de escritura. El grant sobraba desde el primer día.
//
// Lo que este contrato protege no es que la migración exista, sino que siga
// diciendo lo que dice: que revoca escritura sin tocar `service_role`, que deja
// la lectura explícita, y que no toca la política.
//
// La verificación de que el resultado EFECTIVO en la base es SELECT y nada más
// vive en `scripts/live-isolation/`, contra Postgres real con todas las
// migraciones aplicadas. Un contrato de texto no puede probar un grant.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MIGRACION = 'supabase/migrations/20260903120000_regiones_solo_select_v1.sql'
const sql = fs.readFileSync(path.join(process.cwd(), MIGRACION), 'utf8')

// --- Revoca la escritura ----------------------------------------------------

const revoke = /REVOKE\s+([\s\S]*?)\s+ON\s+TABLE\s+public\.regiones\s+FROM\s+authenticated/i.exec(sql)
assert.ok(revoke, 'la migración debe revocar privilegios sobre public.regiones a authenticated')

const revocados = revoke[1].split(',').map((p) => p.trim().toUpperCase())
for (const priv of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
  assert.ok(revocados.includes(priv), `debe revocar ${priv} sobre public.regiones`)
}
assert.ok(!revocados.includes('SELECT'),
  'no debe revocar SELECT: la aplicación lee regiones para armar la jerarquía')
assert.ok(!revocados.includes('ALL'),
  'REVOKE ALL dejaría a la app sin lectura; los privilegios se enumeran a propósito')

// --- Deja la lectura explícita ----------------------------------------------

assert.match(sql, /GRANT\s+SELECT\s+ON\s+TABLE\s+public\.regiones\s+TO\s+authenticated/i,
  'la lectura acotada por RLS debe quedar declarada, no depender de lo que sobrevivió al REVOKE')

// --- No toca lo que no debe -------------------------------------------------

assert.doesNotMatch(sql, /FROM\s+service_role|TO\s+service_role/i,
  'service_role escribe regiones desde las Netlify Functions: su grant no se toca')
assert.doesNotMatch(sql, /DROP\s+POLICY|CREATE\s+POLICY|ALTER\s+POLICY/i,
  'la política regiones_select_scope no cambia: este ítem es sobre grants')
// Sólo `regiones`: esta migración no puede aprovechar el viaje para cambiar
// permisos de otra tabla. Se mira el DDL, no las menciones —el encabezado
// explica por qué la tabla de suscripciones push es la excepción legítima, y
// nombrarla no es tocarla.
const ddl = sql.replace(/--[^\n]*/g, '')
const tablasTocadas = new Set(
  [...ddl.matchAll(/ON\s+TABLE\s+(\w+\.\w+)/gi)].map((m) => m[1].toLowerCase()),
)
assert.deepEqual([...tablasTocadas], ['public.regiones'],
  `esta migración sólo puede tocar public.regiones; tocó: ${[...tablasTocadas].join(', ')}`)

// Nada destructivo sobre datos.
for (const destructivo of [/\bDROP\s+TABLE\b/i, /\bTRUNCATE\s+TABLE\b/i, /\bDELETE\s+FROM\b/i, /\bUPDATE\s+public\./i]) {
  assert.doesNotMatch(sql, destructivo,
    'una migración de permisos no toca datos')
}

assert.match(sql, /BEGIN;[\s\S]*COMMIT;/,
  'la migración debe ser transaccional')

// --- push_subscriptions sigue siendo la excepción declarada -----------------
// Si alguien alguna vez decide que otra tabla puede escribirse desde el
// browser, tiene que pasar por acá y por el contrato de escrituras del cliente,
// no por un grant suelto en una migración.

const contratoEscrituras = fs.readFileSync(
  path.join(process.cwd(), 'scripts/tests/no-browser-business-writes.test.mjs'), 'utf8',
)
assert.match(contratoEscrituras, /push_subscriptions/,
  'el contrato de escrituras desde el browser debe seguir nombrando su única excepción')

console.log('✓ regiones queda con SELECT para authenticated; service_role y la política intactos')
