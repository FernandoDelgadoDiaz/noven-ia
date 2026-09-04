// Contrato del esquema del motor de reacción inmediata (Capa A).
//
// Lo que este contrato protege no es que la migración exista, sino tres
// propiedades que son fáciles de perder en una edición posterior y caras de
// recuperar:
//
//   1. La escala de descuentos es POLÍTICA DE UNA ORGANIZACIÓN, no una
//      constante del producto. Si alguien la convierte en un array literal en
//      el código, la organización siguiente no puede tener otra sin un deploy.
//   2. La instrumentación no puede afirmar nada sobre las intervenciones
//      históricas, que no la tienen.
//   3. El juicio del RAG usa la velocidad necesaria de SU ventana, no la de
//      hoy. Es la diferencia entre un histórico usable y uno sesgado.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MIGRACION = 'supabase/migrations/20260904120000_rag_cobertura_escala_e_instrumentacion_v1.sql'
const sql = fs.readFileSync(path.join(process.cwd(), MIGRACION), 'utf8')

// --- 1. La escala vive en la base, por organización -------------------------

assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.rag_escala_descuento/,
  'la escala de descuentos debe ser una tabla, no una constante')
assert.match(sql, /organizacion_id\s+uuid\s+NOT NULL[\s\S]*?REFERENCES public\.organizaciones\(id\)/,
  'la escala se acota por organización: es política de cada una, no del producto')
assert.match(sql, /PRIMARY KEY \(organizacion_id, escalon\)/,
  'el escalón ordena la escala dentro de cada organización')
assert.match(sql, /UNIQUE \(organizacion_id, porcentaje\)/,
  'un porcentaje repetido en dos escalones haría ambiguo "subir uno"')
assert.match(sql, /CHECK \(porcentaje > 0 AND porcentaje <= 100\)/,
  'un porcentaje fuera de (0,100] no es un descuento')

// --- 1b. La migración NO carga ninguna escala -------------------------------
//
// Esta migración creó la TABLA; el contenido de la escala es política comercial
// de cada organización y se carga como operación de datos. Un INSERT acá
// impondría la escala de un retailer a todo deployment futuro del producto, y
// una vez aplicada la migración no se puede sacar sin borrar datos.
//
// Se mira el SQL efectivo, no el archivo entero: los comentarios explican
// justamente por qué no hay semilla, y buscar sobre ellos daría un falso
// positivo.
const sqlEfectivo = sql
  .replace(/^\s*--.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')

assert.doesNotMatch(sqlEfectivo, /INSERT\s+INTO\s+public\.rag_escala_descuento/i,
  'la escala es política de cada organización: no se siembra desde una migración')

// La forma concreta que hay que evitar es el abanico sobre organizaciones: un
// INSERT que las recorra todas le impone la escala a organizaciones que nunca
// la eligieron, incluso en una base que todavía no existe.
assert.doesNotMatch(sqlEfectivo, /FROM\s+public\.organizaciones[\s\S]{0,400}?CROSS\s+JOIN\s*\(\s*VALUES/i,
  'ninguna migración puede abanicar valores de política sobre todas las organizaciones')

// Y tampoco por la puerta de atrás: los porcentajes de La Anónima no son
// constantes del producto y no deben aparecer como literales en el SQL.
assert.doesNotMatch(sqlEfectivo, /\(\s*7\s*(?:::smallint)?\s*,\s*70\b/,
  'el escalón 7 = 70% es política de La Anónima, no del producto')

// --- 2. RLS y exposición ----------------------------------------------------

assert.match(sql, /ALTER TABLE public\.rag_escala_descuento ENABLE ROW LEVEL SECURITY/,
  'la escala es dato de organización: va con RLS')
assert.match(sql, /REVOKE ALL ON TABLE public\.rag_escala_descuento FROM PUBLIC, anon, authenticated/,
  'los grants se declaran explícitos, no se heredan')
// La escala se lee desde el cliente y no se escribe nunca. Se mira el conjunto
// de privilegios otorgado, no la cadena exacta: agregar INSERT a la misma
// sentencia GRANT es la forma más probable de que esto se rompa.
const grantEscala = /GRANT ([A-Z, ]+) ON TABLE public\.rag_escala_descuento TO authenticated/.exec(sql)
assert.ok(grantEscala, 'el cliente necesita leer la escala para presentar la sugerencia')
assert.deepEqual(grantEscala[1].split(',').map((x) => x.trim()), ['SELECT'],
  `la escala es de sólo lectura desde el browser; se otorgó: ${grantEscala[1]}`)
assert.match(sql, /USING \(noven_private\.tiene_acceso_organizacion\(organizacion_id\)\)/,
  'la política tiene que acotar por organización, no ser permisiva')

// --- 3. La instrumentación no inventa historia ------------------------------

for (const columna of [
  'cobertura_al_sugerir',
  'escalones_sugeridos',
  'escalones_aplicados',
  'origen_sugerencia',
]) {
  assert.ok(sql.includes(`ADD COLUMN IF NOT EXISTS ${columna}`),
    `falta la columna de instrumentación ${columna}`)
}

// Ninguna puede traer DEFAULT: las 16 intervenciones históricas no tienen estos
// datos, y un default afirmaría sobre ellas algo que nadie midió.
const bloqueColumnas = sql.slice(
  sql.indexOf('ALTER TABLE public.intervenciones_rag'),
  sql.indexOf('DO $$'),
)
assert.doesNotMatch(bloqueColumnas, /DEFAULT/,
  'las columnas de instrumentación son nullable sin default: NULL significa "no instrumentada", que es la verdad')

assert.match(sql, /origen_sugerencia IS NULL OR origen_sugerencia IN \(/,
  'el CHECK debe admitir NULL para la historia previa')
for (const origen of ['sugerida_aceptada', 'sugerida_rechazada', 'manual']) {
  assert.ok(sql.includes(`'${origen}'`), `falta el origen ${origen}`)
}

// --- 3b. La instrumentación se escribe, no queda decorativa -----------------
//
// Columnas que nadie llena no sirven para nada en seis meses.

assert.match(sql, /CREATE OR REPLACE FUNCTION noven_private\.instrumentar_sugerencia_rag_impl/,
  'tiene que existir el impl que escribe la instrumentación')
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.instrumentar_sugerencia_rag/,
  'y su wrapper público')

const impl = sql.slice(
  sql.indexOf('CREATE OR REPLACE FUNCTION noven_private.instrumentar_sugerencia_rag_impl'),
  sql.indexOf('CREATE OR REPLACE FUNCTION public.instrumentar_sugerencia_rag'),
)

// `authenticated` sólo tiene SELECT sobre intervenciones_rag y no debe tener
// más, así que la escritura pasa por un DEFINER acotado, como el resto del
// repositorio.
assert.match(impl, /SECURITY DEFINER/, 'el impl escribe donde authenticated no puede')
assert.match(impl, /SET search_path = ''/, 'un DEFINER sin search_path fijo es una escalada esperando')
assert.match(impl, /noven_private\.puede_ver_producto_sucursal/,
  'el DEFINER tiene que verificar permiso sobre el producto, no confiar en el llamador')
assert.match(impl, /auth\.uid\(\)/, 'la identidad sale del token, no de un parámetro')

// Se escribe una sola vez: es evidencia histórica, no un campo de estado.
assert.match(impl, /origen_sugerencia IS NOT NULL THEN\s*\n\s*RETURN;/,
  'la instrumentación no se pisa: una intervención ya instrumentada queda como está')

// Los escalones aplicados los calcula el SERVIDOR contra la escala. Si los
// informara el cliente, la evidencia dependería de que el browser los calcule
// bien, que es justo lo que no se puede auditar después.
assert.match(impl, /FROM public\.rag_escala_descuento/,
  'los escalones aplicados se derivan de la escala en el servidor')
assert.doesNotMatch(impl, /p_escalones_aplicados/,
  'el cliente no informa los escalones aplicados: los calcula el servidor')

// Un porcentaje fuera de la escala deja NULL, no un número inventado.
assert.match(impl, /v_esc_desde IS NULL OR v_esc_hasta IS NULL THEN NULL/,
  'si algún porcentaje no está en la escala, los escalones quedan NULL')

const grantRpc = /GRANT EXECUTE ON FUNCTION public\.instrumentar_sugerencia_rag\([^)]*\)\s*\n?\s*TO authenticated/
assert.match(sql, grantRpc, 'el cliente tiene que poder llamar al wrapper')
assert.match(sql, /REVOKE ALL ON FUNCTION noven_private\.instrumentar_sugerencia_rag_impl[\s\S]{0,120}FROM PUBLIC, anon, authenticated/,
  'el impl no se llama directo desde el cliente')

// --- 4. El juicio usa la necesaria de su propia ventana ---------------------

assert.match(sql, /velocidad_necesaria_al_aplicar/,
  'hace falta la necesaria que regía al aplicar el RAG')
assert.match(sql, /cantidad_comprometida_al_aplicar\s*\n?\s*\/ GREATEST\(v\.fecha_vencimiento - \(rag\.aplicado_at AT TIME ZONE/,
  'la necesaria al aplicar se reconstruye con la ventana comercial de ese día')

// El corazón del cambio: la rama que decide efectivo/insuficiente ya no puede
// compararse contra la necesaria de hoy.
//
// Hay que mirar el LADO DERECHO del >=, no la rama entera:
// `cantidad_comprometida_al_aplicar` aparece igual en el numerador de la
// velocidad observada, así que buscarlo en toda la rama pasa aunque el
// estándar de comparación haya vuelto a ser el de hoy. Lo comprobé: la
// primera versión de esta aserción no detectaba esa regresión.
const juicio = sql.slice(sql.indexOf("WHEN obs.observada_at <= rag.aplicado_at THEN 'pendiente_control_operador'"))
const ramaEfectivo = juicio.slice(0, juicio.indexOf("THEN 'efectivo'::text"))
const estandar = ramaEfectivo.slice(ramaEfectivo.lastIndexOf('>='))

assert.match(estandar, /rag\.aplicado_at AT TIME ZONE/,
  'el estándar de comparación debe reconstruirse con la ventana del día en que se aplicó el RAG;\n'
  + '  usar la de hoy marca como fallidos RAGs que durante su ventana venían cumpliendo')
assert.doesNotMatch(estandar.replace(/COALESCE\([\s\S]*$/, ''), /op\.hoy/,
  'la comparación primaria no puede usar la ventana de hoy')

// --- 4b. Las columnas nuevas van al final de la vista -----------------------
//
// `CREATE OR REPLACE VIEW` en Postgres SÓLO permite agregar columnas al final:
// insertarlas en el medio cambia el nombre de una columna existente en esa
// posición y la sentencia falla entera.
//
// Esto no es teórico: la primera versión de esta migración las insertaba antes
// de `estado_seguimiento_rag` y el replay se cayó al aplicarla. Cambiar el
// orden vuelve a romperlo, así que queda asertado.

const posEstado = sql.indexOf('END AS estado_seguimiento_rag')
assert.ok(posEstado !== -1, 'la vista debe conservar estado_seguimiento_rag')
for (const nueva of ['velocidad_necesaria_al_aplicar', 'cobertura', 'dias_desde_ultimo_rag']) {
  assert.ok(sql.indexOf(`END AS ${nueva}`) > posEstado,
    `"${nueva}" tiene que ir DESPUÉS de estado_seguimiento_rag:\n`
    + '  CREATE OR REPLACE VIEW sólo admite columnas nuevas al final')
}

// --- 5. Las magnitudes que el motor necesita --------------------------------

for (const columna of ['cobertura', 'dias_desde_ultimo_rag']) {
  assert.ok(sql.includes(`AS ${columna}`), `la vista debe exponer ${columna}`)
}

// La cobertura de decisión se mide contra la necesaria de HOY: la decisión de
// hoy se toma con la ventana de hoy.
const bloqueCobertura = sql.slice(sql.indexOf('END AS cobertura') - 1200, sql.indexOf('END AS cobertura'))
assert.match(bloqueCobertura, /v\.fecha_vencimiento - op\.hoy - s\.dias_donacion/,
  'la cobertura que decide el salto usa la ventana comercial de hoy')

// --- 6. Nada destructivo, nada fuera de alcance -----------------------------

// Se mira el SQL que la migración EJECUTA al aplicarse, sin los cuerpos de
// función: un UPDATE dentro de una función corre después, sobre la fila que el
// usuario acaba de crear, y es justamente lo que la instrumentación necesita.
// Lo que no puede haber es una reescritura masiva el día que se aplica.
const alAplicar = sql.replace(/\$function\$[\s\S]*?\$function\$/g, '')

for (const prohibido of [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bDROP\s+FUNCTION\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bUPDATE\s+public\./i,
]) {
  assert.doesNotMatch(alAplicar, prohibido,
    'al aplicarse, la migración no reescribe ni borra nada: la historia RAG es auditable')
}

// Los umbrales de riesgo y la política de donación no son de este bloque.
//
// Se mira el DDL sin comentarios: el encabezado dice explícitamente qué NO
// cambia, y nombrar un umbral para prometer no tocarlo no es tocarlo. Una
// aserción sobre menciones marcaría esa promesa como si fuera la violación.
const ddl = sql.replace(/--[^\n]*/g, '')
assert.doesNotMatch(ddl, /\b(45|20)\s*(::|\)|,)?\s*(?:days?|dias)/i,
  'los umbrales 45/20 no se redefinen en esta migración')
assert.doesNotMatch(ddl, /\bUPDATE\s+public\.sectores\b/i,
  'la política 2/10 vive en sectores.dias_donacion y no se toca acá')
assert.doesNotMatch(ddl, /ALTER TABLE public\.sectores/i,
  'sectores no es de este bloque')

assert.match(sql, /BEGIN;[\s\S]*COMMIT;/, 'la migración debe ser transaccional')

// --- 7. La tabla nueva está clasificada por exposición ----------------------

const clasificacion = fs.readFileSync(
  path.join(process.cwd(), 'scripts/live-isolation/clasificacion-tablas.mjs'), 'utf8',
)
assert.match(clasificacion, /rag_escala_descuento: 'lectura_tenant'/,
  'una tabla nueva sin clasificar rompe el gate de exposición, y con razón')

console.log('✓ Escala configurable por organización, instrumentación sin default, juicio contra la ventana propia')
