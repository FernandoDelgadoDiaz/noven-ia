// CONTRATO DEL PASO 5: la verificación en góndola.
//
// El circuito RAG centralizado se probó de punta a punta en producción y se
// cortó en el último paso: ninguna RPC emitía `confirmada` ni `no_aplicada`. El
// modelo de eventos los admitía desde el principio —CHECK, transiciones,
// compuerta de habilitación y roles— pero nadie podía insertarlos.
//
// Lo que este archivo cuida, en orden de lo que costaría perderlo:
//
//   1. La confirmación es IDEMPOTENTE, no excepcional. Entre la ejecución zonal
//      y la verificación pasa al menos un día operativo, y en esa ventana
//      alguien puede abrir el tramo a mano —ya pasó—. Una confirmación que
//      asume que el tramo no existe falla la segunda vez.
//   2. `aplicado_at` no se retrotrae NUNCA. Mover el inicio de un tramo
//      inventa o borra días de medición que no ocurrieron.
//   3. `no_aplicada` no toca ninguna intervención. Constata que el precio NO
//      está: no hay tramo que abrir ni que cerrar.
//   4. La RPC no vuelve a decidir quién puede hacer la transición. Eso lo
//      resuelve el trigger del historial; duplicar la regla es como se empieza
//      a divergir. (El lado de la frontera vive en
//      `frontera-constatar-autorizar-contract.test.mjs`.)
//   5. El resultado no viaja como texto desde el navegador: dos wrappers, cada
//      uno con el suyo fijo.
//   6. La vista conserva `security_invoker` y expone `reintentos_no_aplicada`,
//      que es lo único que distingue una solicitud que ya volvió de góndola de
//      una nueva después de re-ejecutarse.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../..')

const sql = fs.readFileSync(
  path.join(RAIZ, 'supabase/migrations/20260917143000_confirmacion_gondola_rag_v1.sql'),
  'utf8',
)
// Los comentarios se descartan antes de comprobar nada: el encabezado de esta
// migración EXPLICA por qué no se retrotrae `aplicado_at` y por qué no hay
// lista de roles. Sin esta línea, la prosa correcta haría pasar código
// incorrecto.
const cuerpo = sql.replace(/^[ \t]*--.*$/gm, '')

const impl =
  cuerpo.match(
    /CREATE OR REPLACE FUNCTION noven_private\.verificar_cambio_rag_impl[\s\S]*?\$function\$;/,
  )?.[0] ?? ''
assert.ok(impl, 'falta la implementación server-side de la verificación en góndola')

// --- 1. El motivo de finalización que el circuito escribe --------------------

function revisarMotivos(fuente) {
  const check = fuente.match(
    /ADD CONSTRAINT intervenciones_rag_motivo_finalizacion_check[\s\S]*?\);/,
  )?.[0] ?? ''
  assert.ok(check, 'la migración debe redefinir el CHECK de motivo_finalizacion')
  assert.match(
    check,
    /'reemplazado_por_circuito'/,
    'el circuito necesita su propio motivo: `reemplazado` es el cierre manual y el de la reconstrucción histórica',
  )
  // Los motivos viejos siguen vivos en filas ya escritas. Quitarlos del CHECK
  // no reescribe la historia: la vuelve inválida.
  for (const motivo of ['reemplazado', 'oferta_centralizada', 'decision_comercial', 'otro']) {
    assert.match(
      check,
      new RegExp(`'${motivo}'`),
      `el CHECK no puede dejar afuera a '${motivo}': ya hay filas con ese motivo`,
    )
  }
}

revisarMotivos(cuerpo)

// --- 2. El inicio del tramo no se mueve --------------------------------------
//
// Es la propiedad más fácil de romper sin que nadie lo note: un UPDATE que
// "cuadre" `aplicado_at` con la ejecución zonal se lee razonable y falsea toda
// la medición del tramo.

function revisarAplicadoAt(codigo) {
  assert.doesNotMatch(
    codigo,
    /SET[\s\S]{0,200}?aplicado_at\s*=/,
    'la verificación no puede mover `aplicado_at` de una intervención existente: el inicio de un tramo es cuándo el precio empezó a estar',
  )
}

revisarAplicadoAt(impl)

// El tramo NUEVO sí nace con su instante explícito, que es el de la
// confirmación: dejarlo al default lo separaría del evento que lo justifica.
assert.match(
  impl,
  /INSERT INTO public\.intervenciones_rag\([\s\S]{0,400}?aplicado_at[\s\S]{0,400}?v_ocurrida_at/,
  'el tramo nuevo arranca en el instante de la confirmación, no en un default',
)

// --- 3. Idempotencia, no excepción -------------------------------------------

function revisarIdempotencia(codigo) {
  assert.match(
    codigo,
    /IF FOUND AND v_rag_pc IS NOT DISTINCT FROM v_solicitud\.porcentaje_solicitado THEN/,
    'un RAG vivo ya en el porcentaje solicitado es el caso normal de la ventana entre ejecución y verificación: hay que reconocerlo',
  )
  assert.doesNotMatch(
    codigo,
    /RAISE EXCEPTION 'Ya hay un RAG vigente/,
    'la confirmación no puede fallar porque el tramo ya exista: fallaría la segunda vez y dejaría la ventana abierta para siempre',
  )
}

revisarIdempotencia(impl)

// Sólo se reclama lo que el circuito puede reclamar como suyo. Una intervención
// ya marcada `sugerida_aceptada`/`sugerida_rechazada` se deja como está.
assert.match(
  impl,
  /SET origen_sugerencia = NULL\s*\n\s*WHERE id = v_rag_id\s*\n\s*AND \(origen_sugerencia IS NULL OR origen_sugerencia = 'manual'\);/,
  'corregir la atribución sólo alcanza a la intervención manual o sin instrumentar',
)

// --- 4. La instrumentación se delega, no se recalcula ------------------------

assert.match(
  impl,
  /PERFORM noven_private\.instrumentar_sugerencia_rag_impl\(\s*\n?\s*v_solicitud\.vencimiento_id,\s*\n?\s*v_solicitud\.cobertura_al_sugerir,\s*\n?\s*v_solicitud\.escalones_sugeridos,\s*\n?\s*'sugerida_aceptada'\s*\n?\s*\);/,
  "el RAG que nace del circuito se instrumenta con el snapshot de la solicitud y origen 'sugerida_aceptada': sí hubo sugerencia, y fue aceptada",
)
assert.doesNotMatch(
  impl,
  /escalones_estado|escalones_aplicados/,
  'el escalón no se recalcula acá: dos cómputos del mismo número terminan divergiendo',
)

// --- 5. `no_aplicada` no toca ninguna intervención ---------------------------

function revisarNoAplicada(codigo) {
  const corte = codigo.indexOf("IF p_resultado = 'no_aplicada' THEN")
  assert.ok(corte > 0, "la rama de `no_aplicada` tiene que cortar explícitamente")
  const antes = codigo.slice(0, corte)
  assert.doesNotMatch(
    antes,
    /INSERT INTO public\.intervenciones_rag|UPDATE public\.intervenciones_rag/,
    'constatar que el precio NO está no abre, cierra ni corrige ninguna intervención',
  )
  assert.match(
    codigo.slice(corte, corte + 400),
    /RETURN v_evento_id;/,
    'la rama de `no_aplicada` devuelve el evento y termina ahí',
  )
}

revisarNoAplicada(impl)

// --- 6. La transición no se re-decide ----------------------------------------
//
// El trigger `validar_evento_solicitud_cambio_rag` ya resuelve quién puede
// emitir cada evento, en qué orden y desde qué fecha. Lo que la RPC autoriza es
// el ALCANCE sobre el producto, que es el lado correcto de la frontera.

assert.match(
  impl,
  /IF NOT noven_private\.puede_ver_producto_sucursal\(\s*\n?\s*v_solicitud\.sucursal_id, v_solicitud\.producto_id\s*\n?\s*\) THEN[\s\S]{0,200}?ERRCODE = '42501'/,
  'verificar en góndola se autoriza por alcance sobre el producto',
)
assert.doesNotMatch(
  impl,
  /\b(?:ua\.)?rol\s*(?:IN\s*\(|=\s*')/,
  'la lista de roles ya está en el trigger del historial: repetirla acá crea dos copias de la misma regla',
)
assert.doesNotMatch(
  impl,
  /habilitada_desde/,
  'la compuerta de habilitación la aplica el trigger; recalcularla acá la dejaría divergir',
)

// El doble click devuelve el evento vigente en vez de duplicarlo, y lo hace
// ANTES de mirar el estado: un reintento tardío nunca debe morir con "ya no
// admite verificación".
const idem = impl.indexOf('IF v_ultimo.tipo = p_resultado THEN')
const estado = impl.indexOf("IF v_ultimo.tipo <> 'ejecutada' THEN")
assert.ok(idem > 0 && estado > 0, 'faltan las dos comprobaciones de estado')
assert.ok(
  idem < estado,
  'la comprobación de idempotencia va antes que la de estado: si no, un reintento de red falla',
)

// --- 7. Dos caminos, sin un `resultado` viajando por la red ------------------

function revisarWrappers(fuente) {
  for (const [nombre, resultado] of [
    ['confirmar_cambio_rag_en_gondola', 'confirmada'],
    ['registrar_cambio_rag_no_aplicado', 'no_aplicada'],
  ]) {
    const wrapper = fuente.match(
      new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nombre}\\([\\s\\S]*?\\$\\$;`),
    )?.[0] ?? ''
    assert.ok(wrapper, `falta el wrapper público ${nombre}`)
    assert.match(
      wrapper,
      /SECURITY INVOKER/,
      `${nombre} es INVOKER; la autorización se resuelve dentro del DEFINER`,
    )
    assert.match(
      wrapper,
      new RegExp(`verificar_cambio_rag_impl\\(p_solicitud_id, '${resultado}', p_nota\\)`),
      `${nombre} tiene que fijar el resultado en el servidor: si lo aceptara como parámetro, confirmar y desmentir se distinguirían por un string que manda el cliente`,
    )
  }
}

revisarWrappers(cuerpo)

// --- 8. La vista distingue lo que vuelve de lo que es nuevo ------------------

const vista = cuerpo.match(
  /CREATE OR REPLACE VIEW public\.v_solicitudes_cambio_rag_actual[\s\S]*?reintentos ON true;/,
)?.[0] ?? ''
assert.ok(vista, 'la vista debe recrearse con el contador de reintentos')
assert.match(
  vista,
  /reintentos\.veces AS reintentos_no_aplicada/,
  'una solicitud re-ejecutada vuelve a `lista_confirmacion`: sin el contador es idéntica a una que nunca falló',
)
assert.match(
  vista,
  /LEFT JOIN LATERAL \(\s*\n\s*SELECT count\(\*\)::integer AS veces[\s\S]{0,200}?AND e\.tipo = 'no_aplicada'\s*\n\s*\) reintentos ON true/,
  'el contador sale del historial append-only, no de una columna que alguien tenga que mantener',
)

// `CREATE OR REPLACE VIEW` conserva la ACL pero NO las reloptions. Sin esta
// línea la vista dejaría de evaluar RLS con los privilegios de quien consulta.
assert.match(
  cuerpo,
  /ALTER VIEW public\.v_solicitudes_cambio_rag_actual\s*\n\s*SET \(security_invoker = true\);/,
  'security_invoker no sobrevive al reemplazo de la vista y hay que volver a fijarlo',
)

// La bandeja zonal es donde el aviso tiene que llegar: la solicitud reaparece
// sola, y el contador es lo que la distingue de una nueva.
assert.match(
  cuerpo,
  /s\.reintentos_no_aplicada\s*\n\s*FROM public\.v_solicitudes_cambio_rag_actual s/,
  'la bandeja zonal tiene que exponer los reintentos',
)

// --- 9. Superficie RPC -------------------------------------------------------

for (const funcion of [
  'noven_private\\.verificar_cambio_rag_impl\\(uuid, text, text\\)',
  'public\\.confirmar_cambio_rag_en_gondola\\(uuid, text\\)',
  'public\\.registrar_cambio_rag_no_aplicado\\(uuid, text\\)',
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

// --- Mutantes ----------------------------------------------------------------
//
// Cada uno rompe exactamente una de las propiedades de arriba, por el camino
// más plausible: no son ataques rebuscados, son la versión razonable del error.

assert.throws(
  () => revisarAplicadoAt(`
    UPDATE public.intervenciones_rag
    SET aplicado_at = v_ejecutada_at,
        origen_sugerencia = 'sugerida_aceptada'
    WHERE id = v_rag_id;
  `),
  /no puede mover .aplicado_at./,
  'retrotraer el inicio del tramo para cuadrarlo con la ejecución zonal tiene que hacer fallar el contrato',
)

assert.throws(
  () =>
    revisarIdempotencia(
      impl.replace(
        /IF FOUND AND v_rag_pc IS NOT DISTINCT FROM v_solicitud\.porcentaje_solicitado THEN/,
        "IF FOUND THEN\n    RAISE EXCEPTION 'Ya hay un RAG vigente' USING ERRCODE = '42501';\n  END IF;\n  IF false THEN",
      ),
    ),
  /no puede fallar porque el tramo ya exista|es el caso normal/,
  'convertir la ventana entre ejecución y verificación en una excepción tiene que hacer fallar el contrato',
)

assert.throws(
  () =>
    revisarNoAplicada(
      impl.replace(
        "IF p_resultado = 'no_aplicada' THEN",
        "UPDATE public.intervenciones_rag SET finalizado_at = now() WHERE vencimiento_id = v_solicitud.vencimiento_id;\n  IF p_resultado = 'no_aplicada' THEN",
      ),
    ),
  /no abre, cierra ni corrige ninguna intervención/,
  'cerrar el tramo vigente al constatar que el precio no está tiene que hacer fallar el contrato',
)

assert.throws(
  () =>
    revisarMotivos(
      cuerpo.replace(/'reemplazado',\n\s*'reemplazado_por_circuito',/, "'reemplazado_por_circuito',"),
    ),
  /no puede dejar afuera a 'reemplazado'/,
  'sacar un motivo viejo del CHECK invalida filas ya escritas y tiene que hacer fallar el contrato',
)

assert.throws(
  () =>
    revisarWrappers(
      cuerpo.replace(
        /verificar_cambio_rag_impl\(p_solicitud_id, 'confirmada', p_nota\)/,
        'verificar_cambio_rag_impl(p_solicitud_id, p_resultado, p_nota)',
      ),
    ),
  /fijar el resultado en el servidor/,
  'un wrapper que acepta el resultado del cliente tiene que hacer fallar el contrato',
)

console.log('confirmación en góndola: OK')
