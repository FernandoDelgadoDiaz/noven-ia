// CONTRATO DE LA TABLA DE LA BANDEJA ZONAL.
//
// Esta pantalla se había implementado como tarjetas. El mockup que la definió
// era una tabla, pero vivía fuera de Git: la tarjeta no contradecía nada
// escrito, y por eso nadie lo notó hasta que la administrativa lo dijo mirando
// treinta filas reales. La especificación existe ahora en
// `docs/BANDEJA_RAG_ZONAL_TABLA_V1.md`; este contrato es lo que la hace fallar
// si alguien vuelve a la tarjeta.
//
// LA REGLA DE FONDO, que es la que hay que conservar cuando todo lo demás
// cambie: LA ADMINISTRATIVA NO ANALIZA, TRANSCRIBE. Su trabajo es de lectura
// horizontal, y de ahí salen las tres propiedades de abajo.
//
//   1. Una fila por solicitud. Sin tarjetas, sin párrafos por fila.
//   2. NINGUNA COLUMNA SE OCULTA POR UMBRAL. Es lo más común de hacer y acá es
//      lo peor: una columna que desaparece sin señal se copia incompleta y el
//      error se descubre en el otro sistema. Un scroll se ve y se recupera.
//   3. Con la tabla corrida, lo que identifica la fila y lo que la resuelve
//      siguen a la vista: `Código` y `Producto` fijas a la izquierda, `Acción`
//      fija a la derecha.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../..')
const leer = (ruta) => fs.readFileSync(path.join(RAIZ, ruta), 'utf8')

const page = leer('src/pages/BandejaRagZonal.tsx')
const lib = leer('src/lib/bandeja-rag-zonal.ts')
const spec = leer('docs/BANDEJA_RAG_ZONAL_TABLA_V1.md')

// --- 1. Es una tabla, y una fila por solicitud -------------------------------

assert.match(page, /<table\b/, 'la bandeja se lee en horizontal: tiene que ser una tabla')
assert.match(
  page,
  /grupo\.solicitudes\.map\(\(solicitud\) => \(\s*\n\s*<tr\b/,
  'cada solicitud es UNA fila: si vuelve a ser un <article>, vuelve la tarjeta',
)
assert.doesNotMatch(
  page,
  /<article\b/,
  'la tarjeta es lo que este cambio saca: con treinta solicitudes obliga a scrollear un trabajo que es de lectura horizontal',
)
// El párrafo por fila era dos renglones de prosa para decir una fecha.
assert.doesNotMatch(
  page,
  /La sucursal podrá verificarla en góndola desde/,
  'ese hecho cabe en la columna de estado; no merece un párrafo por fila',
)
assert.match(
  page,
  /Verifica desde \{fechaCorta\(solicitud\.habilitada_desde\)\}/,
  'pero el hecho no se pierde: la fecha de habilitación sigue estando',
)

// --- 2. Las once columnas, y ninguna se oculta -------------------------------

const COLUMNAS = [
  'Sector / familia', 'Código', 'Producto', 'RAG actual', 'Nueva RAG',
  'Vto. producto', 'Fin de acción', 'Stock compr.', 'Validado por',
  'Fecha de validación', 'Estado', 'Acción',
]
for (const columna of COLUMNAS) {
  assert.ok(
    page.includes(`titulo: '${columna}'`),
    `falta la columna «${columna}»: la administrativa transcribe la fila entera`,
  )
}

// --- 2b. El cambio de RAG va en DOS columnas, como en el archivo ------------
//
// Dos números con una flecha en el medio son más fáciles de copiar mal que uno
// solo en su columna, y el trabajo es copiar.

assert.doesNotMatch(
  page,
  /porcentaje\(solicitud\.porcentaje_rag_vigente\)\} → \{porcentaje/,
  'el cambio de RAG no puede volver a compartir celda: `30% → 50%` es el formato que este cambio saca',
)

// `Nueva RAG` es el único dato que se copia al sistema de precios: va
// destacado. `RAG actual` es contexto y va atenuado.
assert.match(
  page,
  /columna="ragNueva"[^>]*font-bold text-brand/,
  'Nueva RAG es EL dato de la pantalla y tiene que destacarse',
)
assert.match(
  page,
  /columna="ragActual"[^>]*className="[^"]*"/,
  'RAG actual existe como columna propia',
)
// En una tabla operativa el rojo se lee como alerta. El dato principal no es
// una alerta: es lo que hay que copiar bien.
const celdaNueva = page.slice(page.indexOf('columna="ragNueva"'), page.indexOf('columna="ragNueva"') + 200)
assert.doesNotMatch(
  celdaNueva,
  /text-red|bg-red/,
  'Nueva RAG no puede ir en rojo: en esta pantalla el rojo se lee como error y es lo contrario',
)

/**
 * Una clase como `hidden lg:table-cell` es exactamente la regresión que este
 * contrato existe para impedir. Es función y no assertion suelta para que el
 * mutante de abajo ejercite el mismo camino.
 */
export function revisarOcultamiento(fuente) {
  const oculta = fuente.match(/className="[^"]*\bhidden\b[^"]*"/g) ?? []
  assert.deepEqual(
    oculta,
    [],
    'ninguna columna puede ocultarse por umbral: si desaparece sin señal, la fila se copia incompleta y el error aparece recién en el otro sistema. El scroll horizontal es la salida elegida.',
  )
}

revisarOcultamiento(page)

// --- 2c. La alineación se declara UNA vez y la leen encabezado y celda ------
//
// Si cada uno llevara su clase, derivarían: es lo que pasaba antes, con títulos
// que no alineaban con su dato. El reparto sale del archivo exportado —el
// escritor xlsx emite `t="n"` sólo para números finitos— y no de una
// preferencia.

assert.match(page, /const COLUMNAS = \[/, 'las columnas se declaran en un solo lugar')
assert.match(
  page,
  /CLASE_COLUMNA\[columna\]/g,
  'encabezado y celda toman la clase de la declaración',
)
for (const [clave, alineacion] of [
  ['ragActual', 'text-right'], ['ragNueva', 'text-right'], ['stock', 'text-right'],
  ['codigo', 'text-left'], ['vencimiento', 'text-left'], ['finAccion', 'text-left'],
]) {
  assert.match(
    page,
    new RegExp(`clave: '${clave}',[^}]*clase: '${alineacion}`),
    `«${clave}» tiene que alinearse como en el archivo: ${alineacion}`,
  )
}

// El encabezado necesita contraste propio: gris sobre gris no se lee.
assert.match(
  page,
  /CLASE_ENCABEZADO = 'bg-slate-100 text-foreground'/,
  'el encabezado se distingue del cuerpo',
)

// --- 3. Lo que identifica y lo que resuelve no se van de pantalla ------------

assert.match(
  page,
  /sector: 'md:sticky md:left-0[\s\S]{0,200}?codigo: 'md:sticky md:left-\[150px\][\s\S]{0,200}?producto: 'md:sticky md:left-\[260px\]/,
  'las tres primeras columnas se anclan en cascada: sus offsets tienen que encadenarse con los anchos declarados',
)
assert.match(
  page,
  /md:sticky md:right-0/,
  'con la tabla corrida, el botón que resuelve la fila no puede quedar fuera de vista',
)
// El anclaje es `md:` y no `sticky` a secas: en un teléfono de 390px, 330px de
// columnas fijas dejarían 60px de ventana para scrollear.
assert.doesNotMatch(
  page,
  /className="(?:(?!md:)[^"])*\bsticky left-/,
  'el anclaje arranca en `md`: en teléfono estorba más de lo que ayuda',
)

// --- 4. El scroll vive en la tabla, no en la página --------------------------

assert.match(
  page,
  /overflow-x-auto[\s\S]{0,200}?<table/,
  'el contenedor que scrollea envuelve sólo a la tabla',
)
// Si el encabezado del grupo entrara al contenedor, se perdería de vista de qué
// sucursal es el bloque justo cuando la tabla está corrida.
const seccion = page.slice(page.indexOf('grupos.map((grupo)'))
assert.ok(
  seccion.indexOf('Exportar sucursal') < seccion.indexOf('overflow-x-auto'),
  'el título de la sucursal y su botón de exportar van FUERA del bloque que scrollea',
)

// --- 5. La mesa de trabajo es más ancha que una página de lectura -----------
//
// Con `max-w-6xl` la tabla no entraba ni en pantalla ancha: 1088px útiles
// contra 1376px de columnas. El scroll habría sido el caso normal y no la
// excepción.

assert.doesNotMatch(page, /max-w-6xl/, 'esta pantalla no usa el ancho de lectura del resto')
assert.match(page, /min-w-\[1456px\]/, 'el ancho mínimo de la tabla es la suma del presupuesto')
assert.match(
  page,
  /max-w-\[1600px\] mx-auto px-4 md:px-8/,
  'la bandeja es una mesa de trabajo: el contenedor tiene que dar lugar a las once columnas',
)

// --- 6. La divergencia con el archivo está escrita, no descubierta ----------

assert.ok(
  !page.includes("titulo: 'Sucursal'"),
  'dentro de un grupo la columna Sucursal repetiría el mismo valor en todas las filas',
)
assert.ok(
  lib.includes("'Sucursal',"),
  'el archivo sí la conserva: se va de esta pantalla y pierde el contexto del agrupamiento',
)
assert.match(
  lib,
  /DIVERGENCIA DELIBERADA CON LA PANTALLA/,
  'sin la razón escrita, el próximo que compare pantalla contra archivo la lee como un defecto',
)
// La segunda diferencia: el archivo separa sector y familia porque en una
// planilla son dos criterios de filtrado; en la tabla comparten celda.
assert.ok(
  lib.includes("'Sector',") && lib.includes("'Familia',"),
  'el archivo mantiene sector y familia separadas',
)
assert.ok(
  page.includes("titulo: 'Sector / familia'"),
  'la pantalla las junta: son una sola pista de ubicación',
)
assert.match(
  lib,
  /el archivo separa «Sector» y «Familia»/,
  'las DOS divergencias tienen que estar escritas, no sólo la de Sucursal',
)

// --- 7. Lo que estaba bien resuelto sigue en pie -----------------------------

for (const [fragmento, porque] of [
  ['agruparPorSucursal', 'el agrupamiento por sucursal'],
  ['Exportar toda la zona', 'la exportación de la zona'],
  ['Exportar sucursal', 'la exportación por sucursal'],
  ['Pendientes de ejecución', 'el contador del encabezado'],
  ['Ventana de recepción', 'la ventana de la zona'],
  ['Jornada del', 'la línea de jornada'],
  ['Marcar Activo', 'la acción, nombrada como la ve la administrativa'],
]) {
  assert.ok(page.includes(fragmento), `${porque} no se toca en este cambio`)
}

// --- 8. La especificación existe y dice lo que el código hace ---------------

for (const afirmacion of ['1456', 'max-w-[1600px]', 'no analiza', 'Fuera de alcance']) {
  assert.ok(
    spec.includes(afirmacion),
    `la especificación tiene que sostener «${afirmacion}»: se escribió para que la próxima vez exista`,
  )
}

// --- Mutantes ----------------------------------------------------------------

assert.throws(
  () => revisarOcultamiento('<td className="hidden lg:table-cell">{stock}</td>'),
  /ninguna columna puede ocultarse por umbral/,
  'esconder una columna en pantalla angosta tiene que hacer fallar el contrato',
)
// Y en la otra dirección: el resto del archivo usa `hidden` para cosas que no
// son columnas, así que el mutante no debe dispararse sobre cualquier clase.
revisarOcultamiento('<div className="flex items-center gap-2">ok</div>')

console.log(`bandeja zonal · tabla: OK (${COLUMNAS.length} columnas)`)
