// Contrato del esquema de salidas de stock que no son venta.
//
// Lo que protege no es que la migración exista, sino cuatro propiedades que se
// pierden fácil en una edición posterior y que salen caras después:
//
//   1. Los cuatro estados son distinguibles. Colapsar `no_declarado` con cero
//      convertiría una ausencia en una certeza que nadie dio.
//   2. La cantidad la calcula el servidor. Si el cliente pudiera mandarla, el
//      registro que existe para limpiar el histórico sería falsificable, y de
//      paso volvería a cargarle una resta al operador.
//   3. El umbral es política de la organización, no una constante del código.
//   4. La migración no cambia ningún cálculo: capturar es inofensivo,
//      descontar mueve números que hoy se muestran y es otro bloque.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MIGRACION = 'supabase/migrations/20260905182910_salidas_no_venta_v1.sql'
const sql = fs.readFileSync(path.join(process.cwd(), MIGRACION), 'utf8')

// --- 1. Los cuatro estados, distinguibles -----------------------------------

for (const causa of ['transferencia', 'rotura', 'decomiso_parcial', 'otro']) {
  assert.ok(sql.includes(`'${causa}'`), `la causa ${causa} debe existir en el CHECK`)
}
assert.ok(sql.includes("'no_declarado'"),
  '"no sé" tiene que poder registrarse: si no se puede salir sin responder, se responde cualquier cosa')
assert.ok(sql.includes("'venta'"),
  'confirmar que fue venta es una respuesta, no la ausencia de respuesta')

// `no_declarado` deja las unidades en NULL y NO en cero. Es la propiedad que
// permite excluir del histórico los tramos sin declarar.
assert.match(sql, /no_venta_respuesta\s*=\s*'no_declarado'\s*AND\s*unidades_no_venta IS NULL/,
  'no_declarado no es cero: es una ausencia declarada')
assert.match(sql, /no_venta_respuesta IS NULL\s*AND\s*unidades_no_venta IS NULL/,
  'no haber preguntado deja ambas columnas en NULL')
assert.match(sql, /no_venta_respuesta\s*=\s*'venta'\s*AND\s*unidades_no_venta = 0/,
  'venta sí es cero unidades ajenas, y eso es una afirmación')

// --- 2. La cantidad la calcula el servidor ----------------------------------

assert.match(sql, /CREATE OR REPLACE FUNCTION public\.declarar_salida_no_venta\(\s*p_observacion_id bigint,\s*p_respuesta\s+text\s*\)/,
  'la RPC recibe la respuesta y NADA MÁS: si aceptara una cantidad, el dato dejaría de ser confiable')
assert.ok(!/p_unidades|p_cantidad_no_venta/.test(sql),
  'ningún parámetro de cantidad puede entrar por la RPC')
assert.match(sql, /GREATEST\(v_ctx\.bajada, 0\)/,
  'las unidades salen de la caída contra el control previo, calculada en el servidor')

// Sin control previo no hay caída que atribuir.
assert.match(sql, /cantidad_previa IS NULL THEN\s*RAISE EXCEPTION/,
  'declarar una causa sin control previo sería afirmar sobre una diferencia inexistente')

// --- 3. El umbral es de la organización -------------------------------------

assert.match(sql, /ALTER TABLE public\.organizaciones[\s\S]*?umbral_salida_anomala numeric NOT NULL DEFAULT 10/,
  'el umbral vive por organización, no como constante del producto')
assert.match(sql, /CHECK \(umbral_salida_anomala > 1\)/,
  'un umbral de 1 o menos preguntaría en cada control: no es un valor admisible')

// --- 4. Esta migración NO cambia cálculos -----------------------------------

assert.ok(!/CREATE OR REPLACE VIEW/.test(sql),
  'capturar el dato no toca la vista: el descuento en la velocidad observada es otro bloque, con sus propios contratos de mutación')
assert.ok(!/DROP (TABLE|COLUMN|VIEW)|DELETE FROM|TRUNCATE/i.test(sql),
  'nada destructivo')

// Las columnas nacen NULL y ninguna fila histórica se reescribe. La observación
// contaminada conocida —POSTRE DE MANI, 162 unidades transferidas leídas como
// venta— queda en NULL a propósito: escribir 162 hoy sería indistinguible de un
// dato declarado en su momento.
assert.ok(!/UPDATE public\.vencimiento_observaciones\s+SET no_venta/.test(
  sql.replace(/CREATE OR REPLACE FUNCTION[\s\S]*/, '')),
  'ninguna fila histórica se rellena: NULL significa "no se preguntó", que es la verdad')

// --- 5. Permisos: el patrón wrapper / impl ----------------------------------

for (const fn of ['contexto_salida_control', 'declarar_salida_no_venta']) {
  assert.ok(sql.includes(`noven_private.${fn}_impl`),
    `${fn} necesita su implementación SECURITY DEFINER en noven_private`)
  assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION noven_private\\.${fn}_impl`),
    `la implementación de ${fn} no puede ser ejecutable por clientes`)
  assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[^;]*TO authenticated`),
    `el wrapper público de ${fn} se concede a authenticated`)
}
assert.match(sql, /puede_leer_producto_sucursal\(a\.sucursal_id, a\.producto_id\)/,
  'el alcance se verifica en el servidor: una SECURITY DEFINER sin ese filtro leería cualquier sucursal')

// Toda SECURITY DEFINER lleva search_path vacío. Contar ocurrencias no sirve:
// los wrappers SECURITY INVOKER también lo fijan, así que los totales no
// coinciden y no tienen por qué. Lo que importa es que ninguna DEFINER quede
// sin él — una DEFINER con search_path heredado es escalable por un esquema
// puesto adelante.
const definers = [...sql.matchAll(/SECURITY DEFINER/g)]
assert.ok(definers.length >= 2, 'hay al menos dos implementaciones SECURITY DEFINER')
for (const m of definers) {
  const siguiente = sql.slice(m.index, m.index + 200)
  assert.match(siguiente, /SET search_path = ''/,
    'una SECURITY DEFINER sin search_path vacío es escalable por búsqueda de esquema')
}

console.log('✓ El esquema de salidas no-venta distingue los cuatro estados y no calcula en el cliente')
