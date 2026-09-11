// CONTRATO: el nombre del sistema de origen no se le muestra al usuario.
//
// NoVen lee reportes de un sistema de la cadena. Ese nombre —y el de sus
// reportes— es de La Anónima, no del producto. Mientras esté escrito en la
// pantalla, cada cadena nueva obliga a buscarlo string por string.
//
// LO QUE ESTE CONTRATO SEPARA, y es la parte que importa:
//
//   · Identificadores, nombres de archivo y comentarios PUEDEN nombrarlo. Son
//     el formato real que se parsea, y borrarlos perdería información cierta:
//     `importar-glaciar.ts` parsea reportes de ese sistema y decirlo es correcto.
//   · El TEXTO QUE VE EL USUARIO no. Ahí va «sistema», «reposición», «reporte
//     de ventas».
//   · Los NOMBRES DE COLUMNA se conservan aunque suenen propios: «Cod.Art.»,
//     «Stk NNN», «Cód.Familia» son lo que la persona tiene que encontrar en su
//     archivo. Genéricos serían inútiles, y ése es el punto de un mensaje de
//     error.
//
// Cómo distingue: revisa cadenas de texto y contenido JSX en los archivos que
// producen pantalla, y descarta comentarios, imports e identificadores. No es
// un analizador de sintaxis; es suficientemente estricto para el caso y falla
// del lado de avisar de más, que en un contrato es el lado correcto.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../..')

/** Nombres propios de la cadena que no pueden llegar a la pantalla. */
const NOMBRES_DE_LA_CADENA = [
  { patron: /Glaciar/i, nombre: 'Glaciar' },
  { patron: /Reposici[óo]n\s+Asistida/i, nombre: 'Reposición Asistida' },
  { patron: /\b0258\b/, nombre: '0258' },
]

/**
 * Archivos que producen texto de pantalla. `importar-glaciar.ts` entra aunque
 * viva en `lib`: sus `erroresBloqueantes` viajan a `throw new Error` en las dos
 * pantallas de importación. El primer relevamiento de este cambio miró sólo
 * `pages` y `components` y se le escaparon tres mensajes por exactamente eso.
 */
const RUTAS_CON_PANTALLA = [
  'src/pages',
  'src/components',
  'src/hooks',
  'src/lib/riesgo.ts',
  'src/lib/importar-glaciar.ts',
]

function archivos(destino) {
  const abs = path.join(RAIZ, destino)
  if (!fs.existsSync(abs)) return []
  if (fs.statSync(abs).isFile()) return [abs]
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? archivos(path.join(destino, e.name))
      : /\.(?:ts|tsx)$/.test(e.name)
        ? [path.join(abs, e.name)]
        : [],
  )
}

/** Deja fuera comentarios e imports: ahí el nombre real es información, no UI. */
function lineasDePantalla(fuente) {
  let enBloque = false
  return fuente.split('\n').filter((linea) => {
    const limpia = linea.trim()
    if (enBloque) {
      if (limpia.includes('*/')) enBloque = false
      return false
    }
    if (limpia.startsWith('/*')) {
      enBloque = !limpia.includes('*/')
      return false
    }
    if (limpia.startsWith('//') || limpia.startsWith('*')) return false
    if (limpia.startsWith('import ') || limpia.startsWith('} from ')) return false
    return true
  })
}

/**
 * Un identificador que contenga el nombre —`analizarReporteGlaciar`,
 * `MetadataGlaciar`, `'@/lib/importar-glaciar'`— es código, no pantalla.
 *
 * EXIGE UN CARÁCTER PEGADO, antes o después. Sin eso el filtro borraba también
 * la palabra suelta y el contrato no podía ver «Stock total Glaciar»: se volvía
 * verde sin verificar nada. Lo cazó el mutante de abajo, que es para lo que
 * está.
 */
function sinIdentificadores(linea) {
  return linea
    .replace(/[A-Za-z0-9_$]+[Gg]laciar[A-Za-z0-9_$]*/g, '')
    .replace(/[A-Za-z0-9_$]*[Gg]laciar[A-Za-z0-9_$]+/g, '')
    .replace(/'(?:@\/|\.\.?\/)[^']*'/g, '')   // rutas de import
    .replace(/parsear0258|parece0258|parserDesde0258|importar-0258/g, '')
    .replace(/'0258'/g, '')          // el discriminante de la unión de tipos
}

export function revisarPantalla(ruta, fuente) {
  for (const linea of lineasDePantalla(fuente)) {
    const candidata = sinIdentificadores(linea)
    for (const { patron, nombre } of NOMBRES_DE_LA_CADENA) {
      assert.doesNotMatch(
        candidata,
        patron,
        `${ruta}: «${nombre}» es el nombre del sistema de la cadena y no puede ` +
          `estar en texto de pantalla. En un comentario o un identificador sí.\n` +
          `    ${linea.trim()}`,
      )
    }
  }
}

let revisados = 0
for (const destino of RUTAS_CON_PANTALLA) {
  for (const abs of archivos(destino)) {
    revisarPantalla(path.relative(RAIZ, abs), fs.readFileSync(abs, 'utf8'))
    revisados += 1
  }
}
assert.ok(revisados > 20, `se esperaban muchos archivos de pantalla, hubo ${revisados}`)

// --- Los nombres de columna se conservan ------------------------------------
//
// Es la otra mitad de la regla, y sin ella este contrato empujaría a vaciar los
// mensajes de error hasta volverlos inservibles.

const compuerta = fs.readFileSync(path.join(RAIZ, 'src/lib/importar-glaciar.ts'), 'utf8')
for (const columna of ['Cod.Art.', 'Stk NNN', 'Cód.Familia']) {
  assert.ok(
    compuerta.includes(columna),
    `el error tiene que seguir nombrando la columna «${columna}»: es lo que la ` +
      'persona busca en su archivo',
  )
}

// --- Mutantes ---------------------------------------------------------------

assert.throws(
  () => revisarPantalla('mutante.tsx', '<p>Stock total Glaciar</p>'),
  /Glaciar/,
  'un texto de pantalla con el nombre de la cadena tiene que hacer fallar el contrato',
)
assert.throws(
  () => revisarPantalla('mutante.tsx', "throw new Error('Subí la Reposición Asistida completa')"),
  /Reposición Asistida/,
  'el nombre del reporte tampoco puede llegar a la pantalla',
)
assert.throws(
  () => revisarPantalla('mutante.tsx', '<span title="costos 0258">histórico</span>'),
  /0258/,
  'el número de reporte de la cadena tampoco',
)
// Y en la otra dirección: lo que SÍ puede quedar no debe hacerlo fallar.
for (const permitida of [
  "import { analizarReporteGlaciar } from '@/lib/importar-glaciar'",
  '// El reporte de Reposición Asistida trae datos fuera de la grilla',
  'const analisis = analizarReporteGlaciar(texto, { modo: 0 })',
  "const fuente: Fuente = parece0258(texto) ? '0258' : 'reposicion_asistida'",
]) {
  revisarPantalla('permitida.ts', permitida)
}

console.log(`nomenclatura del sistema de origen: OK (${revisados} archivos de pantalla)`)
