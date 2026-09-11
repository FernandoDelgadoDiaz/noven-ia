// CONTRATO DE `informar_rag`: el camino del primer RAG.
//
// Lo que esta migración arregla es un hueco, no un permiso: un vencimiento sin
// intervención previa no tenía RPC para recibir su primer RAG, y sin
// intervención no hay tramo, y sin tramo el motor de cobertura no arranca.
//
// Las cuatro propiedades que este archivo cuida, en orden de lo que costaría
// perderlas:
//
//   1. Constata por alcance y no por jerarquía. (La frontera completa, con
//      mutantes, vive en `frontera-constatar-autorizar-contract.test.mjs`.)
//   2. Acepta un porcentaje fuera de la escala. Si la cadena puso 35% donde la
//      escala dice 30, eso PASÓ: rechazarlo no lo deshace, sólo deja a NoVen
//      ciego sobre un producto intervenido.
//   3. No es una puerta lateral para cambiar un RAG vigente. Ese camino sigue
//      siendo el circuito centralizado.
//   4. No inventa instrumentación ni la deja en NULL: delega en la función que
//      ya resuelve el escalón cero implícito y `fuera_de_escala`.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../..')

const sql = fs.readFileSync(
  path.join(RAIZ, 'supabase/migrations/20260911151500_informar_rag_constatacion_v1.sql'),
  'utf8',
)
const cuerpo = sql.replace(/^[ \t]*--.*$/gm, '')

const impl =
  cuerpo.match(
    /CREATE OR REPLACE FUNCTION noven_private\.informar_rag_impl[\s\S]*?\$function\$;/,
  )?.[0] ?? ''
assert.ok(impl, 'falta la implementación server-side de informar_rag')

// --- 1. El guard es el del alcance ------------------------------------------

assert.match(
  impl,
  /IF NOT noven_private\.puede_ver_producto_sucursal\(v_sucursal, v_producto\) THEN[\s\S]{0,200}?ERRCODE = '42501'/,
  'informar un RAG se autoriza por alcance sobre el producto',
)

// --- 2. La escala no puede bloquear una constatación -------------------------
//
// El único límite admisible es aritmético. Cualquier consulta a
// `rag_escala_descuento` dentro de esta RPC sería la escala gobernando lo que
// se puede DECLARAR, y no lo que se puede sugerir.

assert.match(
  impl,
  /IF p_porcentaje IS NULL OR p_porcentaje <= 0 OR p_porcentaje > 100 THEN/,
  'el porcentaje se valida por rango, no contra la escala',
)
assert.doesNotMatch(
  impl,
  /rag_escala_descuento/,
  'un porcentaje fuera de escala tiene que poder informarse igual: ocurrió',
)

// --- 3. No es una puerta lateral al cambio de precio -------------------------

assert.match(
  impl,
  /WHERE r\.vencimiento_id = p_vencimiento_id\s*\n\s*AND r\.tipo = 'rag'\s*\n\s*AND r\.finalizado_at IS NULL/,
  'antes de insertar hay que mirar si ya hay un RAG vivo de este vencimiento',
)
assert.match(
  impl,
  /IF v_vigente_pc IS NOT DISTINCT FROM p_porcentaje THEN\s*\n\s*RETURN v_vigente_id;/,
  'el mismo hecho informado dos veces devuelve la misma intervención, sin mover aplicado_at',
)
assert.match(
  impl,
  /RAISE EXCEPTION 'Ya hay un RAG vigente[\s\S]{0,200}?ERRCODE = '42501'/,
  'un porcentaje distinto sobre un RAG vivo es un cambio, y el cambio es del circuito',
)
assert.doesNotMatch(
  impl,
  /UPDATE public\.intervenciones_rag/,
  'informar el primer RAG no finaliza ni reemplaza ninguna intervención existente',
)

// El signo de porcentaje pegado al argumento en un RAISE sale al revés: `%%%`
// se lee como literal + argumento. Es un error mudo, sólo visible en el mensaje.
assert.doesNotMatch(impl, /RAISE EXCEPTION '[^']*%%%/, 'el formato %%% invierte el mensaje')

// --- 4. La intervención nace completa ----------------------------------------

assert.match(
  impl,
  /INSERT INTO public\.intervenciones_rag\([\s\S]{0,400}?'rag', p_porcentaje, v_cantidad, v_vmd/,
  'el RAG informado se inserta con su tipo y con el stock conocido al declararlo',
)
assert.match(
  impl,
  /PERFORM noven_private\.instrumentar_sugerencia_rag_impl\(\s*\n?\s*p_vencimiento_id, NULL::numeric, NULL::smallint, 'manual'\s*\n?\s*\);/,
  "la instrumentación se delega con origen 'manual': no hubo sugerencia que medir",
)
assert.doesNotMatch(
  impl,
  /escalones_estado/,
  'el escalón no se recalcula acá: dos cómputos del mismo número terminan divergiendo',
)

// --- 5. Superficie RPC -------------------------------------------------------

assert.match(
  cuerpo,
  /CREATE OR REPLACE FUNCTION public\.informar_rag\([\s\S]{0,400}?SECURITY INVOKER/,
  'el wrapper público es INVOKER; la autorización se resuelve dentro del DEFINER',
)

for (const funcion of [
  'noven_private\\.informar_rag_impl\\(uuid, numeric, text\\)',
  'public\\.informar_rag\\(uuid, numeric, text\\)',
]) {
  assert.match(
    cuerpo,
    new RegExp(`REVOKE ALL ON FUNCTION ${funcion}\\s*\\n?\\s*FROM PUBLIC, anon;`),
    `${funcion} debe revocarse antes de otorgarse: los defaults de Supabase ya la concedieron`,
  )
  assert.match(
    cuerpo,
    new RegExp(`GRANT EXECUTE ON FUNCTION ${funcion}\\s*\\n?\\s*TO authenticated;`),
    `${funcion} necesita EXECUTE para authenticated`,
  )
}

console.log('informar_rag: OK')
