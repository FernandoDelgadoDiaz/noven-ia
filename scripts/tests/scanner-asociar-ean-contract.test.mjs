// CONTRATO: un EAN desconocido se asocia al producto existente por su código
// interno, sin pasar por el alta.
//
// EL CAMINO DIARIO. El 88% del catálogo en producción (737 de 834) entró por el
// 0258 con código interno y SIN EAN. Así que escanear un EAN que la base no
// conoce casi nunca es un producto nuevo: es uno que ya existe y todavía no
// tiene su código de barras.
//
// LO QUE PASABA. El Scanner saltaba al formulario de alta completo. El operador
// escribía la descripción, la marca, la categoría, y recién al enviar
// `buscar_conflicto_codigos_scanner` le decía que el código interno ya estaba
// tomado. No había duplicados —la restricción única de (organizacion, cod_art)
// lo impide—, había trabajo tirado y un callejón sin salida.
//
// Y LA CAPACIDAD YA EXISTÍA: `buscar_producto_scanner` busca por código interno
// cuando no encuentra el EAN, y `vincular_ean_producto_scanner` vincula. La
// pantalla no las usaba en ese momento.
//
// LA REGLA QUE ESTE CONTRATO CUIDA ES EL ORDEN. Primero SÓLO el código interno;
// el formulario completo recién si no lo encuentra. Si el formulario mostrara
// todos los campos juntos, el operador los llenaría de arriba hacia abajo y la
// búsqueda llegaría con la descripción ya escrita: el mismo trabajo tirado de
// antes, sólo que un poco antes.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../..')
const scanner = fs.readFileSync(path.join(RAIZ, 'src/pages/Scanner.tsx'), 'utf8')
const e2e = fs.readFileSync(path.join(RAIZ, 'e2e/critical-flows.spec.mjs'), 'utf8')

/** El bloque donde se decide qué hacer con un código que no se encontró. */
function ramaEanDesconocido(fuente) {
  const inicio = fuente.indexOf("if (clase === 'ean') {")
  assert.ok(inicio > 0, 'falta la rama del EAN desconocido')
  return fuente.slice(inicio, fuente.indexOf("} else if (clase === 'cod_art')", inicio))
}

// --- 1. El EAN desconocido va a pedir el código interno, no al alta ---------

export function revisarOrden(fuente) {
  const rama = ramaEanDesconocido(fuente)
  assert.match(
    rama,
    /setPaso\('asociar_ean'\)\s*\n\s*return/,
    'un EAN desconocido tiene que pedir PRIMERO el código interno: el 88% del catálogo ya existe sin EAN',
  )
  assert.doesNotMatch(
    rama,
    /setPaso\('nuevo_producto'\)|setErrorBusqueda\('no_encontrado'\)/,
    'el EAN desconocido no puede caer al alta completa: el operador escribiría la descripción antes de que la búsqueda llegue',
  )
}

revisarOrden(scanner)

// --- 2. El paso nuevo pide un solo dato -------------------------------------

const paso = scanner.slice(
  scanner.indexOf("if (paso === 'asociar_ean') {"),
  scanner.indexOf("if (paso === 'completar_cod_art'"),
)
assert.ok(paso.length > 0, 'falta la pantalla del paso asociar_ean')
assert.equal(
  (paso.match(/<input\b/g) ?? []).length,
  1,
  'el paso de asociar pide UN dato, el código interno: cualquier campo más es el trabajo que este cambio saca',
)
assert.match(paso, /Es este, vincular el código de barras/)

// --- 3. Vincula con el EAN que ya se escaneó --------------------------------

assert.match(
  scanner,
  /vincularEanScanner\(sucursalId, productoAsociar\.id, nuevoProductoEan\)/,
  'se vincula el EAN ya escaneado: pedirlo de nuevo sería un paso de más',
)
// Si no lo encuentra, recién ahí es un producto nuevo, y el alta abre con los
// dos códigos ya cargados.
assert.match(
  scanner,
  /if \(!encontrado\) \{[\s\S]{0,400}?setNuevoProductoCodArt\(codigo\)\s*\n\s*setPaso\('nuevo_producto'\)/,
  'sin producto por código interno, el alta abre con el código ya puesto',
)
// La familia se verifica igual que en la búsqueda normal.
assert.match(
  scanner,
  /if \(!verificarFamiliaProducto\(encontrado\)\) \{[\s\S]{0,120}?setPaso\('familia_bloqueada'\)/,
  'asociar no puede saltarse el alcance por familia',
)

// --- 4. El vencimiento se pasa explícito ------------------------------------
//
// Un `setState` no está disponible en el mismo tick. El camino de asociar carga
// el vencimiento y decide en la misma función: si `continuarDesdeProducto`
// leyera el estado, decidiría con el valor anterior y mandaría a «Cargar» un
// producto que ya tiene un vencimiento activo.

assert.match(
  scanner,
  /function continuarDesdeProducto\(\s*\n\s*p: Producto,\s*\n\s*venc: VencimientoExistente \| null = vencimientoExistente,/,
  'continuarDesdeProducto tiene que aceptar el vencimiento explícito',
)
assert.match(
  scanner,
  /continuarDesdeProducto\(actualizado, venc\.venc\)/,
  'el camino de asociar decide con el vencimiento recién cargado, no con el estado',
)

// --- 5. El recorrido E2E existe y afirma las dos mitades --------------------

assert.match(e2e, /un EAN desconocido se vincula al producto existente sólo con su código interno/)
assert.match(
  e2e,
  /filter\(\(call\) => call\.name === 'crear_producto_scanner'\)\)\.toHaveLength\(0\)/,
  'el recorrido tiene que afirmar que el alta NUNCA se llamó; si no, volver al formulario lo dejaría verde',
)

// --- Mutantes ---------------------------------------------------------------

// El comportamiento anterior: el EAN desconocido cae al «no encontrado».
assert.throws(
  () =>
    revisarOrden(
      scanner.replace(
        /resetAsociar\(\)\s*\n\s*setPaso\('asociar_ean'\)\s*\n\s*return/,
        "setErrorBusqueda('no_encontrado')",
      ),
    ),
  /pedir PRIMERO el código interno|no puede caer al alta completa/,
  'volver al alta completa tiene que hacer fallar el contrato',
)

// Y el atajo que parece razonable: mostrar el formulario directo.
assert.throws(
  () =>
    revisarOrden(
      scanner.replace(/setPaso\('asociar_ean'\)/, "setPaso('nuevo_producto')"),
    ),
  /pedir PRIMERO el código interno|no puede caer al alta completa/,
  'abrir el formulario completo en vez de pedir el código tiene que hacer fallar el contrato',
)

console.log('scanner · asociar EAN por código interno: OK')
