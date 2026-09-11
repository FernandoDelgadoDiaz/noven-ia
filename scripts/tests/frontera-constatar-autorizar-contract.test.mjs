// CONTRATO DE LA FRONTERA: constatar un hecho y autorizar un cambio son
// permisos distintos.
//
// La frontera existía en el código desde `informar_oferta_central`, pero sin
// nombre y sin contrato. Al reconstruir el circuito RAG se reconstruyó sólo el
// lado de autorizar, y el primer RAG —que es una constatación— quedó pidiendo
// jerarquía. Nueve vencimientos se quedaron fuera del motor por esa omisión.
// Lo que no tiene contrato se vuelve a omitir.
//
// LA REGLA, EN LAS DOS DIRECCIONES:
//
//   constatar  → guard por ALCANCE sobre el producto
//                (`noven_private.puede_ver_producto_sucursal`), NUNCA por lista
//                de roles: quien está parado frente a la góndola puede declarar
//                lo que ve, sea operador, gerente o supervisor.
//
//   autorizar  → guard por ROL EXPLÍCITO (`ua.rol IN (...)` / `ua.rol = '...'`),
//                nunca sólo por alcance: cambiar un precio o ejecutarlo en la
//                cadena es una decisión con jerarquía, y tener acceso al
//                producto no es tenerla.
//
// El registro es la parte que hay que mantener: toda RPC nueva de las familias
// informar / finalizar / solicitar / ejecutar tiene que declararse de un lado o
// del otro, y el contrato falla mientras no lo esté. Esa falla es el punto.
//
// Al final del archivo, mutantes en las dos direcciones: un constatador con
// lista de roles y un autorizador que se conforma con el alcance tienen que
// hacer fallar estas mismas comprobaciones. Un contrato que no se puede romper
// no está verificando nada.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../..')
const MIGRACIONES = path.join(RAIZ, 'supabase/migrations')

/** Familias de RPC que cruzan la frontera y por lo tanto deben clasificarse. */
const FAMILIAS = /^(?:informar|finalizar|solicitar|ejecutar)_[a-z0-9_]*_impl$/

const FRONTERA = new Map([
  // Constatar: declarar un hecho que ya ocurrió en la góndola.
  ['informar_rag_impl', 'constatacion'],
  ['informar_oferta_central_impl', 'constatacion'],
  // Cerrar una intervención también es constatar: el precio dejó de estar.
  ['finalizar_intervencion_por_tipo_impl', 'constatacion'],
  // Autorizar: pedir el cambio de precio, y ejecutarlo en la cadena.
  ['solicitar_cambio_rag_impl', 'autorizacion'],
  ['ejecutar_solicitud_cambio_rag_impl', 'autorizacion'],
])

// --- Extracción --------------------------------------------------------------
//
// Varias de estas funciones se redefinen en migraciones posteriores. Vale la
// ÚLTIMA, que es la que queda en la base: verificar una definición superada
// daría verde sobre código que ya no existe.

const archivos = fs
  .readdirSync(MIGRACIONES)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const cuerpos = new Map()

for (const archivo of archivos) {
  const sql = fs.readFileSync(path.join(MIGRACIONES, archivo), 'utf8')
  const patron =
    /CREATE OR REPLACE FUNCTION noven_private\.([a-z0-9_]+)\s*\([\s\S]*?AS (\$[a-z_]*\$)([\s\S]*?)\2;/g
  let m
  while ((m = patron.exec(sql)) !== null) {
    const [, nombre, , cuerpo] = m
    // Los comentarios se descartan ANTES de comprobar nada. Este mismo
    // repositorio tiene migraciones cuyo encabezado explica la frontera citando
    // `ua.rol IN (...)`: sin esta línea, una prosa correcta haría pasar un guard
    // incorrecto.
    cuerpos.set(nombre, {
      archivo,
      codigo: cuerpo.replace(/^[ \t]*--.*$/gm, ''),
    })
  }
}

// --- La comprobación ---------------------------------------------------------

const USA_ALCANCE = /noven_private\.puede_ver_producto_sucursal\s*\(/
const LISTA_ROLES = /\b(?:ua\.)?rol\s*(?:IN\s*\(|=\s*')/

/**
 * Lanza si el cuerpo no respeta el lado de la frontera que declaró. Es una
 * función y no assertions sueltas para que los mutantes de abajo puedan
 * ejercitar exactamente el mismo camino que la verificación real.
 */
function revisarFrontera(nombre, lado, codigo) {
  if (lado === 'constatacion') {
    assert.match(
      codigo,
      USA_ALCANCE,
      `${nombre} constata un hecho: tiene que autorizar por alcance sobre el producto`,
    )
    assert.doesNotMatch(
      codigo,
      LISTA_ROLES,
      `${nombre} constata un hecho y no puede pedir jerarquía: quien está frente al producto lo puede declarar`,
    )
    return
  }

  if (lado === 'autorizacion') {
    assert.match(
      codigo,
      LISTA_ROLES,
      `${nombre} autoriza un cambio: tiene que exigir un rol explícito, no alcanzar con el alcance`,
    )
    return
  }

  throw new Error(`Lado de frontera desconocido para ${nombre}: ${lado}`)
}

for (const [nombre, lado] of FRONTERA) {
  const definicion = cuerpos.get(nombre)
  assert.ok(definicion, `la frontera declara ${nombre} pero ninguna migración la define`)
  revisarFrontera(nombre, lado, definicion.codigo)
}

// --- El registro no puede quedarse atrás -------------------------------------
//
// Una RPC nueva de estas familias que nadie clasifique es exactamente el
// escenario que costó los nueve vencimientos: se agrega el camino, se le copia
// el guard al vecino equivocado y nadie lo nota. Acá falla.

function revisarCobertura(nombres) {
  const sinClasificar = nombres.filter((n) => FAMILIAS.test(n) && !FRONTERA.has(n)).sort()
  assert.deepEqual(
    sinClasificar,
    [],
    `RPC sin lado de frontera declarado: ${sinClasificar.join(', ')}. ` +
      'Cada una constata un hecho o autoriza un cambio; decidilo y agregala al registro.',
  )
}

revisarCobertura([...cuerpos.keys()])

// --- Mutantes, en las dos direcciones ----------------------------------------

const constatador = cuerpos.get('informar_rag_impl').codigo
const autorizador = cuerpos.get('solicitar_cambio_rag_impl').codigo

// Dirección 1 · un constatador al que le agregan jerarquía.
assert.throws(
  () =>
    revisarFrontera(
      'mutante',
      'constatacion',
      constatador.replace(
        /IF NOT noven_private\.puede_ver_producto_sucursal/,
        "IF NOT EXISTS (SELECT 1 FROM public.usuario_accesos ua WHERE ua.rol IN ('gerente_sucursal')) AND NOT noven_private.puede_ver_producto_sucursal",
      ),
    ),
  /no puede pedir jerarquía/,
  'una lista de roles metida en un constatador tiene que hacer fallar el contrato',
)

// Dirección 1b · un constatador al que le sacan el alcance y queda sin guard.
assert.throws(
  () =>
    revisarFrontera(
      'mutante',
      'constatacion',
      constatador.replace(/noven_private\.puede_ver_producto_sucursal\s*\(/g, 'true OR ('),
    ),
  /autorizar por alcance sobre el producto/,
  'un constatador sin guard de alcance tiene que hacer fallar el contrato',
)

// Dirección 2 · un autorizador al que le sacan el rol y se conforma con el
// alcance. Es el error exacto en espejo, y el que nadie estaba buscando.
assert.throws(
  () =>
    revisarFrontera(
      'mutante',
      'autorizacion',
      autorizador.replace(
        /ua\.rol\s*IN\s*\([^)]*\)/g,
        'noven_private.puede_ver_producto_sucursal(v_sucursal_id, v_producto_id)',
      ),
    ),
  /exigir un rol explícito/,
  'un autorizador que se conforma con el alcance tiene que hacer fallar el contrato',
)

// Dirección 3 · el registro incompleto.
assert.throws(
  () => revisarCobertura([...cuerpos.keys(), 'informar_lo_que_sea_impl']),
  /sin lado de frontera declarado/,
  'una RPC nueva de estas familias sin clasificar tiene que hacer fallar el contrato',
)

console.log('frontera constatar/autorizar: OK')
