// Contrato del escalón cero implícito.
//
// LO QUE PROTEGE
//
// Que una intervención sin otra anterior cuente los escalones que subió. El
// producto estaba sin descuento: ése es el escalón cero, un punto de partida
// conocido y no un dato que falta. La versión anterior devolvía NULL en ese
// caso, y medido contra producción eso era el 82% de las intervenciones —14 de
// 17 son la primera de su vencimiento—.
//
// Y que el número no se invente cuando no se puede medir. Tres situaciones que
// antes compartían el mismo NULL quedan separadas, según la regla de
// `ai/rules.md`: no instrumentada, fuera de escala, y sin escala configurada.
//
// POR QUÉ ESTE CONTRATO ES DE TEXTO Y NO DE EJECUCIÓN
//
// La regla vive en plpgsql dentro de una función SECURITY DEFINER. Reescribirla
// en JavaScript para poder ejecutarla sería tener la misma regla en dos
// lenguajes, que es exactamente lo que el bloque 5a evitó a propósito: se
// separan con el tiempo y entonces el contrato miente. Se verifica la forma de
// la regla en el SQL, y la ejecución real se hizo contra producción en
// transacción deshecha.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MIGRACION = 'supabase/migrations/20260905223000_escalon_cero_implicito_v1.sql'
const sql = fs.readFileSync(path.join(process.cwd(), MIGRACION), 'utf8')

// Las aserciones de AUSENCIA tienen que mirar el cuerpo, no el archivo entero:
// la cabecera de la migración cita el CASE defectuoso para explicar qué se
// estaba arreglando, y una búsqueda ingenua lo confundiría con el defecto
// todavía presente. Lo encontró este mismo contrato al escribirlo.
const cuerpo = sql.replace(/^\s*--.*$/gm, '')

// --- 1. El escalón cero existe y es cero, no uno ----------------------------

// La tentación es asumir que la primera intervención sube UN escalón. Contra la
// escala vigente eso sería falso en 12 de los 14 casos reales: seis arrancan en
// 30 (dos escalones) y cinco en 50 (tres). Lo que se fija es el ORIGEN en cero,
// para que el salto lo determine el escalón de llegada.
assert.match(
  sql,
  /IF v_anterior IS NULL THEN\s*\n\s*v_esc_desde := 0;/,
  'sin intervención previa el escalón de partida es 0 — el producto estaba sin descuento',
)
assert.match(
  sql,
  /v_aplicados := \(v_esc_hasta - v_esc_desde\)::smallint/,
  'los escalones se cuentan como llegada menos partida, nunca como una constante',
)
assert.ok(
  !/v_aplicados := 1\b/.test(cuerpo),
  'asumir 1 escalón para toda primera intervención subcontaría 12 de los 14 casos reales',
)

// La regresión concreta: la versión anterior devolvía NULL cuando no había
// escalón de partida, sin distinguir que "no hay anterior" es información.
assert.ok(
  !/WHEN v_esc_desde IS NULL OR v_esc_hasta IS NULL THEN NULL/.test(cuerpo),
  'vuelve el CASE que colapsaba el escalón cero con un dato faltante',
)

// --- 2. Los cuatro casos, distinguibles -------------------------------------

for (const estado of ['medido', 'fuera_de_escala', 'sin_escala']) {
  assert.ok(sql.includes(`'${estado}'`), `falta el estado ${estado}`)
}

// El CHECK es lo que impide que un estado y su número se contradigan: un
// "medido" sin número, o un "fuera de escala" con uno, serían peores que el
// NULL que este trabajo vino a eliminar.
assert.match(
  sql,
  /escalones_estado IS NULL AND escalones_aplicados IS NULL/,
  'no instrumentada: sin estado y sin número. Son las 17 filas previas a D-7',
)
assert.match(
  sql,
  /escalones_estado = 'medido' AND escalones_aplicados IS NOT NULL/,
  'medido exige número: un estado que dice haber medido sin medición es una mentira estructural',
)
assert.match(
  sql,
  /escalones_estado IN \('fuera_de_escala', 'sin_escala'\)\s*\n?\s*AND escalones_aplicados IS NULL/,
  'los dos casos no medibles no llevan número: ahí es donde se inventaría uno',
)

// --- 3. Fuera de escala y sin escala NO son el mismo estado -----------------

// Es la aplicación directa del criterio de ai/rules.md. Colapsarlos diría "este
// descuento es raro" cuando lo que pasa es que falta configurar la organización.
assert.match(
  sql,
  /IF NOT v_hay_escala THEN[\s\S]{0,200}?v_estado\s*:=\s*'sin_escala'/,
  'sin escala configurada tiene su propio estado: no hay contra qué medir',
)
assert.match(
  sql,
  /ELSIF v_esc_desde IS NULL OR v_esc_hasta IS NULL THEN[\s\S]{0,200}?v_estado\s*:=\s*'fuera_de_escala'/,
  'hay escala y el porcentaje no está en ella: ése es fuera_de_escala',
)

// --- 4. No se inventa ningún número -----------------------------------------

assert.ok(
  !/(round|floor|ceil|nearest)\s*\(/i.test(cuerpo),
  'interpolar o redondear al escalón vecino convierte "no sé" en un número que después nadie distingue de una medición',
)

// --- 5. No se recalcula el histórico ----------------------------------------

// D-7: las 17 intervenciones previas nunca se instrumentaron. Un UPDATE masivo
// acá les inventaría evidencia que nadie generó.
const updates = cuerpo.match(/UPDATE\s+public\.intervenciones_rag/gi) ?? []
assert.equal(
  updates.length,
  1,
  'el único UPDATE es el de la función, sobre la fila que se está instrumentando: ' +
    'un backfill le inventaría escalones a las 17 filas que D-7 dejó sin evidencia',
)

// --- 6. El grant sigue puesto -----------------------------------------------

// CREATE OR REPLACE sobre la implementación no altera su ACL, pero reemplazar
// la función es justo el momento en que se repite el error de #162.
assert.match(
  sql,
  /GRANT EXECUTE ON FUNCTION noven_private\.instrumentar_sugerencia_rag_impl\(uuid, numeric, smallint, text\)\s*\n?\s*TO authenticated/,
  'authenticated necesita EXECUTE sobre la implementación: el wrapper es SECURITY INVOKER',
)

console.log('✓ El escalón cero cuenta desde cero y los cuatro casos son distinguibles')
