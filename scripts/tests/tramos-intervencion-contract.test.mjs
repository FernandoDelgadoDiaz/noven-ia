// Contrato del bloque A: el tramo y el tipo de intervención.
//
// LAS CUATRO PROPIEDADES QUE PROTEGE
//
//   1. LA FRONTERA A/B. A define la ventana; NO mide ni mueve ninguna cifra
//      visible. Si esta migración tocara `v_seguimiento_rag_actual` —de donde
//      salen los once campos de la tarjeta— sería B disfrazado.
//   2. Una oferta central puede existir SIN un RAG previo. Es el problema que
//      originó el bloque: hoy `oferta_centralizada` sólo es un
//      `motivo_finalizacion`, o sea la forma de TERMINAR un RAG.
//   3. El fin de un tramo se DERIVA; no hay tabla nueva ni camino de escritura
//      nuevo que pueda fallar en silencio.
//   4. Cada estado tiene su propio valor: `no_aplica` no es `fuera_de_escala`.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { CLASIFICACION_VISTAS } from '../live-isolation/clasificacion-tablas.mjs'

const MIGRACION = 'supabase/migrations/20260906004500_tramos_y_tipo_intervencion_v1.sql'
const sql = fs.readFileSync(path.join(process.cwd(), MIGRACION), 'utf8')

// Las aserciones de AUSENCIA miran el cuerpo: la cabecera nombra a propósito la
// vista que NO se toca, y una búsqueda ingenua la confundiría con un cambio.
const cuerpo = sql.replace(/^\s*--.*$/gm, '')

// --- 1. La frontera A/B -----------------------------------------------------

// Las vistas que la UI lee. Tocar cualquiera desde A mueve una cifra visible.
const VISTAS_QUE_VE_EL_OPERADOR = [
  'v_seguimiento_rag_actual',
  'v_vencimientos_operativos',
  'v_producto_sucursal_operativo',
  'v_productos_catalogo',
]

for (const vista of VISTAS_QUE_VE_EL_OPERADOR) {
  assert.ok(
    !new RegExp(`(CREATE|ALTER|DROP)[\\s\\S]{0,40}VIEW\\s+(public\\.)?${vista}\\b`, 'i').test(cuerpo),
    `A no puede tocar ${vista}: de ahí salen los números que el operador ya está viendo. ` +
      'Si hace falta cambiarla, es el bloque B.',
  )
}

// Medir es de B. Cuidado con la distinción, que este contrato aprendió a los
// golpes: ARRASTRAR una columna ya almacenada no es medir. `cobertura_al_sugerir`
// es instrumentación guardada en `intervenciones_rag` —una fila por tramo— y la
// vista la pasa tal cual. Lo prohibido es CALCULAR.
for (const patron of [
  /velocidad_observada/,
  /velocidad_necesaria/,
  /unidades_vendidas/,
  /\bcobertura\b(?!_al_sugerir)/,   // la calculada, no la guardada
  /dias_observados/,
]) {
  assert.ok(
    !patron.test(cuerpo),
    `${patron} es una medición y pertenece al bloque B: A sólo define la ventana`,
  )
}

// Y la contracara: arrastrar la instrumentación sí es legítimo y esperado,
// porque B la va a necesitar y vive en la misma fila que el tramo.
assert.match(
  cuerpo,
  /o\.cobertura_al_sugerir,/,
  'la instrumentación guardada viaja con su tramo: es la misma fila, no un cálculo',
)

// Una duración obligaría a decidir contra qué instante se cierra un tramo
// abierto, y esa decisión es de B.
assert.ok(
  !/\bnow\(\)/i.test(cuerpo),
  'la vista de tramos no puede depender del reloj: un tramo abierto no tiene fin todavía, ' +
    'y elegir uno es medir',
)

// --- 2. La oferta central tiene casa propia ---------------------------------

assert.match(
  cuerpo,
  /ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'rag'/,
  'el tipo por defecto es rag: las 17 filas existentes lo son y no hay nada que migrar',
)
assert.match(
  cuerpo,
  /CHECK \(tipo IN \('rag', 'oferta_central'\)\)/,
  'los dos únicos tipos, declarados',
)

// El porcentaje pertenece al RAG. Un cero sería afirmar "descuento cero" y
// además rompería el CHECK preexistente (porcentaje > 0).
assert.match(
  cuerpo,
  /ALTER COLUMN porcentaje_descuento DROP NOT NULL/,
  'sin esto una oferta central no se puede registrar: estaría obligada a inventar un porcentaje',
)
assert.match(
  cuerpo,
  /tipo = 'rag'\s*AND porcentaje_descuento IS NOT NULL/,
  'un RAG sin porcentaje no es un RAG',
)
assert.match(
  cuerpo,
  /tipo = 'oferta_central'\s*AND porcentaje_descuento IS NULL/,
  'una oferta central con porcentaje propio es un número inventado',
)

// --- 3. El tramo se deriva, no se almacena ----------------------------------

assert.ok(
  !/CREATE TABLE[\s\S]{0,60}tramo/i.test(cuerpo),
  'una tabla de tramos sería un segundo camino de escritura que puede fallar en silencio — es D-7',
)
assert.ok(
  !/CREATE TRIGGER|CREATE OR REPLACE TRIGGER/i.test(cuerpo),
  'nada de triggers: la derivación no puede desincronizarse porque no se mantiene',
)
assert.match(
  cuerpo,
  /CREATE OR REPLACE VIEW public\.v_intervencion_tramos/,
  'el tramo vive en una vista derivada',
)

// LEAST ignora los NULL, así que da la más temprana de las dos fechas que
// exista y NULL sólo cuando no hay ninguna. Ése es el tramo abierto.
assert.match(
  cuerpo,
  /LEAST\(o\.finalizado_at, o\.siguiente_inicio\)\s*AS fin/,
  'el fin es la finalización explícita o el arranque del siguiente, lo que ocurra antes',
)
assert.match(
  cuerpo,
  /lead\(r\.aplicado_at\) OVER w AS siguiente_inicio/,
  'el arranque del tramo siguiente sale de la propia tabla, ordenada',
)

// --- 4. Superposición: registrar sí, atribuir no ----------------------------

assert.match(
  cuerpo,
  /o\.siguiente_inicio IS NOT NULL\s*\n?\s*AND \(o\.finalizado_at IS NULL OR o\.finalizado_at > o\.siguiente_inicio\)\) AS superpuesto/,
  'un tramo cuya siguiente intervención arrancó mientras seguía vivo queda MARCADO, ' +
    'para que B lo excluya sabiendo por qué en vez de mezclarlo',
)

// --- 5. no_aplica existe Y algo lo escribe ----------------------------------

// Un estado permitido por el CHECK que nadie produce parece cubierto y no lo
// está. Las dos mitades tienen que estar.
assert.match(
  cuerpo,
  /escalones_estado IN \('fuera_de_escala', 'sin_escala', 'no_aplica'\)/,
  'el CHECK admite no_aplica',
)
assert.match(
  cuerpo,
  /IF v_rag\.tipo <> 'rag' THEN[\s\S]{0,200}?v_estado\s*:=\s*'no_aplica'/,
  'y la instrumentación efectivamente lo escribe: una oferta central no recorre la escala',
)

// El orden importa: si la rama de tipo no fuera la primera, una oferta central
// caería en sin_escala o fuera_de_escala antes de llegar a la suya.
const iTipo = cuerpo.indexOf("IF v_rag.tipo <> 'rag'")
const iEscala = cuerpo.indexOf('ELSIF NOT v_hay_escala')
assert.ok(
  iTipo > 0 && iEscala > iTipo,
  'la rama del tipo va primero: si no, una oferta central se clasificaría por la escala ' +
    'que justamente no recorre',
)

// --- 6. La vista queda expuesta como corresponde ----------------------------

assert.match(
  cuerpo,
  /ALTER VIEW public\.v_intervencion_tramos SET \(security_invoker = true\)/,
  'sin security_invoker la vista evalúa RLS como su dueño y el aislamiento multitenant desaparece',
)
assert.match(
  cuerpo,
  /GRANT SELECT ON TABLE public\.v_intervencion_tramos TO authenticated/,
  'la vista es de lectura para authenticated',
)
assert.ok(
  !/GRANT (INSERT|UPDATE|DELETE)[\s\S]{0,60}v_intervencion_tramos/i.test(cuerpo),
  'ninguna escritura sobre la vista de tramos',
)
assert.equal(
  CLASIFICACION_VISTAS.v_intervencion_tramos,
  'vista_lectura_tenant',
  'la vista nueva tiene que estar clasificada, o el verificador de exposición no la mira',
)

// --- 7. No se toca la otra vista de tramos ----------------------------------

// `v_resultado_vencimiento_tramos` ya existe con OTRA granularidad —intervalos
// entre eventos, sólo para vencimientos cerrados—. Comparten palabra y no
// concepto; que A la dejara distinta sería mover algo que no vino a mover.
// Lo prohibido es DDL contra ella, no NOMBRARLA: el COMMENT de la vista nueva la
// menciona a propósito, para que quien lea el catálogo no confunda las dos
// unidades. Distinguir "tocar" de "mencionar" es lo que evita que este contrato
// obligue a borrar justo la aclaración que hace falta.
assert.ok(
  !/(CREATE|ALTER|DROP)[\s\S]{0,40}(VIEW\s+)?(public\.)?v_resultado_vencimiento_tramos\b/i.test(cuerpo),
  'la vista de tramos preexistente no se toca: comparte el nombre pero no la unidad',
)

console.log('✓ El tramo se deriva, la oferta central tiene casa, y A no mueve ninguna cifra visible')
