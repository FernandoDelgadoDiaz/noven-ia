// Contrato del bloque B: medir cada tramo contra su propia ventana.
//
// ESTE ES EL BLOQUE QUE MUEVE CIFRAS VISIBLES, y su parte más peligrosa es
// justamente la que hoy no mueve ninguna: el descuento de salidas no-venta da
// CERO impacto porque todavía no hay declaraciones cargadas. Un error ahí no da
// síntoma hoy y aparecería la primera vez que un operario declare una
// transferencia, cuando ya nadie mire el PR.
//
// Por eso este contrato verifica la FORMA de la fórmula en el SQL, y la
// ejecución real se ejercita contra la base con declaraciones PROVOCADAS dentro
// de transacción deshecha — el mismo método de los casos D y E del escalón cero.
//
// LA REGLA DE LA VENTANA MÍNIMA NO SE INVENTA ACÁ. Es `ventanaObservable` de
// `src/lib/ragCobertura.ts`. Como la medición ocurre en SQL y la sugerencia en
// TypeScript, la regla existe en dos lugares por necesidad; este contrato es lo
// que impide que se separen.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MIGRACION = 'supabase/migrations/20260906160000_medicion_por_tramo_v1.sql'
const sql = fs.readFileSync(path.join(process.cwd(), MIGRACION), 'utf8')
const cuerpo = sql.replace(/^\s*--.*$/gm, '')

const motor = fs.readFileSync(path.join(process.cwd(), 'src/lib/ragCobertura.ts'), 'utf8')
const badge = fs.readFileSync(
  path.join(process.cwd(), 'src/components/dashboard/RagSeguimientoBadge.tsx'), 'utf8')

// --- 1. El contrato de columnas no se rompe ---------------------------------
//
// Cinco consumidores leen esta vista. `CREATE OR REPLACE VIEW` no deja quitar ni
// reordenar columnas, pero sí dejaría renombrar el sentido de una: la lista
// explícita es lo que hace visible una omisión en la revisión.
const COLUMNAS_QUE_ALGUIEN_LEE = [
  'vencimiento_id', 'familia_id', 'dias_donacion', 'dias_comerciales_restantes',
  'rag_id', 'rag_porcentaje', 'rag_aplicado_at', 'cantidad_base_rag',
  'observada_at', 'cantidad_observada', 'cantidad_actual_estimacion',
  'unidades_vendidas_observadas', 'dias_observados', 'velocidad_observada',
  'velocidad_necesaria', 'estado_seguimiento_rag', 'dias_desde_ultimo_rag',
]
for (const col of COLUMNAS_QUE_ALGUIEN_LEE) {
  assert.ok(
    new RegExp(`AS ${col}\\b|\\b${col},`).test(cuerpo),
    `la vista dejó de exponer "${col}", que algún consumidor lee`,
  )
}

// --- 2. El descuento de salidas no-venta ------------------------------------

assert.match(
  cuerpo,
  /sum\(x\.unidades_no_venta\)/,
  'las unidades no-venta declaradas se suman dentro de la ventana del tramo',
)
// La ventana del descuento: desde el inicio del tramo hasta la observación que
// se está midiendo. Ni antes ni después, o se contarían salidas de otro tramo.
assert.match(
  cuerpo,
  /x\.observada_at > tramo\.inicio\s*\n?\s*AND x\.observada_at <= obs\.observada_at/,
  'el descuento se acota a la ventana del tramo: fuera de ella pertenece a otro',
)
// Restar y no sumar, y no bajar de cero.
assert.match(
  cuerpo,
  /GREATEST\(tramo\.cantidad_al_iniciar - obs\.cantidad_comprometida, 0::numeric\)\s*\n?\s*- nv\.unidades_no_venta/,
  'las no-venta se RESTAN de la caída bruta',
)
assert.ok(
  !/\+ nv\.unidades_no_venta/.test(cuerpo),
  'sumar las no-venta invertiría el sentido del ajuste',
)

// --- 3. La ventana mínima, con la MISMA regla que el motor ------------------

assert.match(
  motor,
  /return dias \* velocidadNecesaria >= 1/,
  'si cambió la definición de ventanaObservable en TypeScript, este contrato ' +
    'tiene que revisarse: la vista la reimplementa en SQL',
)
assert.match(
  cuerpo,
  /\* COALESCE\([\s\S]{0,400}?\) >= 1/,
  'la vista aplica dias × velocidad_necesaria >= 1, igual que el motor',
)
assert.match(cuerpo, /'ventana_insuficiente'::text/,
  'un tramo sin ventana suficiente tiene estado propio')

// --- 4. El ORDEN de las ramas, que es donde vive la regla -------------------

const i = (t) => cuerpo.indexOf(t)
assert.ok(
  i("'ventana_insuficiente'::text") < i("'sin_movimiento'::text"),
  'la guarda de ventana va ANTES de sin_movimiento: sobre tres minutos, ' +
    '"no se movió nada" no es una observación, es la duración del tramo',
)
assert.ok(
  i("obs.cantidad_comprometida = 0::numeric THEN 'efectivo'") < i("'ventana_insuficiente'::text"),
  'haber vendido todo es un desenlace, no un cociente: no lo tapa la ventana corta',
)
assert.ok(
  i("'dato_a_revisar'::text") < i("'ventana_insuficiente'::text"),
  'un dato incoherente se muestra igual, aunque la ventana sea corta',
)

// --- 5. efectivo_por_vmd ya no existe ---------------------------------------
//
// Declaraba efectiva una intervención SIN observación, contra la venta media de
// Glaciar. Es circular: la VMD describe cómo se movía el producto SIN
// intervención.
assert.ok(
  !/efectivo_por_vmd/.test(cuerpo),
  'la vista no puede volver a afirmar efectividad sin evidencia propia',
)
assert.ok(
  !/venta_media_diaria\s*>=/.test(cuerpo),
  'ninguna rama de estado puede comparar contra la VMD de Glaciar',
)
assert.ok(
  !/efectivo_por_vmd/.test(badge),
  'la tarjeta tampoco debe seguir manejando un estado que la vista ya no emite',
)

// --- 6. El inicio del tramo sale del tramo, no del click -------------------
//
// El circuito de ejecución centralizada va a mover el inicio a la confirmación
// en góndola. Si la vista leyera `aplicado_at` directamente, ese cambio la
// rompería en silencio.
assert.match(
  cuerpo,
  /FROM public\.v_intervencion_tramos t/,
  'la ventana arranca en v_intervencion_tramos, no en intervenciones_rag',
)
assert.ok(
  !/r\.aplicado_at/.test(cuerpo),
  'nada puede leer aplicado_at directamente: el inicio del tramo es una ' +
    'propiedad del tramo, y va a dejar de coincidir con el click que decide el descuento',
)

// --- 7. La tarjeta distingue el estado nuevo -------------------------------
assert.match(
  badge,
  /case 'ventana_insuficiente':/,
  'sin su propio case, el estado nuevo caería en el mensaje genérico y volvería ' +
    'a confundirse con "no hay evidencia"',
)

console.log('✓ B mide cada tramo contra su ventana, descuenta lo que no fue venta y no afirma sin evidencia')
