// Contrato del bloque C1: convivencia de RAG y oferta central.
//
// EL DEFECTO QUE ESTE CONTRATO EXISTE PARA IMPEDIR
//
// `registrar_intervencion_rag_invoker_v1` finalizaba TODAS las intervenciones
// vivas del vencimiento, sin filtrar por tipo:
//
//     UPDATE public.intervenciones_rag SET finalizado_at = now(),
//            motivo_finalizacion = 'reemplazado'
//     WHERE vencimiento_id = p_vencimiento_id AND finalizado_at IS NULL;
//
// Mientras el índice único garantizaba una sola viva por vencimiento, ese
// UPDATE no podía equivocarse. Al levantar el índice para permitir la
// convivencia, PONER UN RAG ENCIMA DE UNA OFERTA CENTRAL LA CIERRA EN SILENCIO
// y la marca "reemplazado" — el caso exacto que la convivencia existe para
// permitir, fallando sin ningún síntoma.
//
// Es la forma de error más cara de esta base: una función que hoy no puede
// fallar porque el caso no existe, y que falla en silencio en cuanto exista.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MIGRACION = 'supabase/migrations/20260906230000_convivencia_rag_oferta_central_v1.sql'
const sql = fs.readFileSync(path.join(process.cwd(), MIGRACION), 'utf8')
const cuerpo = sql.replace(/^\s*--.*$/gm, '')

// --- 1. EL MUTANTE QUE MÁS IMPORTA · el UPDATE acotado por tipo -------------

assert.match(
  cuerpo,
  /UPDATE public\.intervenciones_rag[\s\S]{0,400}?WHERE vencimiento_id = p_vencimiento_id\s*\n\s*AND finalizado_at IS NULL\s*\n\s*AND tipo = 'rag';/,
  'el reemplazo de RAG tiene que acotarse a tipo = rag: sin ese filtro, poner un ' +
    'RAG encima de una oferta central la cierra en silencio marcándola "reemplazado"',
)

// Y el INSERT declara su tipo en vez de confiar en el default: si mañana el
// default cambia, una intervención de RAG podría nacer con otro tipo.
assert.match(
  cuerpo,
  /INSERT INTO public\.intervenciones_rag\([\s\S]{0,300}?tipo,[\s\S]{0,600}?'rag',/,
  'el RAG nuevo declara tipo = rag explícitamente',
)

// --- 2. El índice y las funciones NO se pueden separar ----------------------
//
// Si el índice sube en un deploy y las funciones se acotan en el siguiente,
// queda una ventana con el cierre silencioso armado. Esta aserción es lo que
// impide que un refactor futuro los parta en dos migraciones.
assert.match(cuerpo, /DROP INDEX IF EXISTS public\.intervenciones_rag_un_vigente_por_vencimiento_uidx/,
  'el índice viejo, por vencimiento solo, se baja')
assert.match(
  cuerpo,
  /CREATE UNIQUE INDEX IF NOT EXISTS intervenciones_rag_un_vigente_por_tipo_uidx\s*\n\s*ON public\.intervenciones_rag \(vencimiento_id, tipo\)\s*\n\s*WHERE finalizado_at IS NULL/,
  'el índice nuevo es por (vencimiento, tipo): un RAG y una oferta central conviven, ' +
    'dos del mismo tipo no',
)
assert.ok(
  cuerpo.indexOf('DROP INDEX') < cuerpo.indexOf("AND tipo = 'rag';"),
  'el índice y el filtro por tipo viven en la misma migración, y el filtro no puede ' +
    'quedar para después: sería dejar la ventana abierta',
)

// Nunca queda sin invariante de unicidad: el nuevo se crea en la misma
// transacción que baja el viejo.
assert.ok(
  cuerpo.indexOf('DROP INDEX') < cuerpo.indexOf('CREATE UNIQUE INDEX'),
  'primero baja el viejo y después sube el nuevo, en la misma migración',
)

// --- 3. La instrumentación mide el RAG, no la oferta central ---------------

assert.match(
  cuerpo,
  /FROM public\.intervenciones_rag r\s*\n\s*WHERE r\.vencimiento_id = p_vencimiento_id\s*\n\s*AND r\.finalizado_at IS NULL\s*\n\s*AND r\.tipo = 'rag'/,
  'la instrumentación toma el RAG vivo y no "la viva": con convivencia esa podría ' +
    'ser la oferta central, y los escalones se escribirían sobre la fila equivocada',
)

// --- 4. Los tramos se cierran dentro de su tipo ----------------------------

assert.match(
  cuerpo,
  /WINDOW w AS \(PARTITION BY r\.vencimiento_id, r\.tipo/,
  'sin particionar por tipo, abrir una oferta central cierra el tramo del RAG',
)
assert.ok(
  !/PARTITION BY r\.vencimiento_id\s+ORDER BY/.test(cuerpo),
  'no puede quedar ninguna ventana particionada sólo por vencimiento',
)

// `superpuesto` ahora significa convivencia entre tipos distintos, y el
// solapamiento se calcula bien: un tramo abierto no tiene fin, y tratar ese
// NULL como "no se solapa" sería justo al revés de la verdad.
assert.match(
  cuerpo,
  /o2\.tipo <> c\.tipo/,
  'superpuesto compara tramos de tipos DISTINTOS: dos del mismo tipo ya los impide el índice',
)
assert.match(
  cuerpo,
  /COALESCE\(o2\.fin, 'infinity'::timestamptz\)[\s\S]{0,200}?COALESCE\(c\.fin,\s*'infinity'::timestamptz\)/,
  'un tramo abierto se solapa hacia adelante: su extremo es infinito, no NULL',
)

// --- 5. La ventana arranca en el PRIMER tramo abierto ----------------------
//
// Con dos precios vigentes el efecto observado empezó cuando empezó el primero.
// Medir desde el segundo descartaría los días en que el primero ya actuaba.
assert.match(
  cuerpo,
  /WHERE t\.vencimiento_id = v\.id AND t\.abierto\s*\n\s*ORDER BY t\.inicio ASC\s*\n\s*LIMIT 1/,
  'la ventana arranca en el primer tramo abierto, no en el último',
)

// --- 6. Un solo número, marcado como no atribuible -------------------------

for (const col of ['intervenciones_abiertas', 'hay_oferta_central', 'medicion_atribuible']) {
  assert.ok(cuerpo.includes(col), `falta la columna ${col}`)
}
assert.match(
  cuerpo,
  /\(abiertas\.cuantas <= 1\)\s*AS medicion_atribuible/,
  'con más de una intervención viva la medición es del efecto combinado y NO se ' +
    'puede atribuir: el operador la usa igual, el histórico tiene que excluirla',
)
// Una sola cobertura. Dos serían dos números que no se pueden calcular por
// separado, presentados como si se pudiera.
assert.equal(
  (cuerpo.match(/\bAS cobertura\b/g) ?? []).length, 1,
  'una sola cobertura: la del efecto combinado',
)

// --- 7. security_invoker, la lección del bloque B --------------------------

assert.match(
  cuerpo,
  /ALTER VIEW public\.v_seguimiento_rag_actual SET \(security_invoker = true\)/,
  'CREATE OR REPLACE VIEW no conserva las reloptions: sin esto la vista evalúa RLS ' +
    'como su dueño y el aislamiento multitenant desaparece',
)

console.log('✓ RAG y oferta central conviven, y ninguno cierra al otro en silencio')
