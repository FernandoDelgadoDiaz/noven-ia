// Contrato: el navegador no escribe sobre tablas de negocio.
//
// La autoridad de permisos es RLS y toda escritura operativa pasa por una RPC
// SECURITY DEFINER o por una funcion Netlify que valida alcance server-side.
// Un `supabase.from('tabla').insert(...)` en src/ reintroduce un escritor
// directo: aunque hoy `authenticated` solo tenga SELECT y la llamada falle,
// el camino queda escrito y vuelve a ser explotable en cuanto alguien
// reotorgue un grant.
//
// Este contrato recorre el AST — no el texto — para que un salto de linea o un
// encadenamiento intermedio no lo evadan.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const SRC = path.join(ROOT, 'src')

const METODOS_ESCRITURA = new Set(['insert', 'update', 'upsert', 'delete'])

// Unica excepcion permitida: la suscripcion push pertenece al propio usuario,
// no es un dato de negocio y su RLS la acota a `usuario_id = auth.uid()`.
// Agregar algo a esta lista es una decision de arquitectura, no un fix de test.
const DESTINOS_PERMITIDOS = new Set(['push_subscriptions'])

function archivosFuente(dir) {
  const salida = []
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name)
    if (entrada.isDirectory()) salida.push(...archivosFuente(completo))
    else if (/\.tsx?$/.test(entrada.name)) salida.push(completo)
  }
  return salida
}

/**
 * Dado el receptor de una llamada de escritura, recorre la cadena hacia
 * adentro buscando el `.from('destino')` que la origina.
 * `supabase.from('x').update(y).eq('id', z)` y
 * `supabase.from('x').select().single()` comparten la misma forma.
 */
function destinoDeLaCadena(nodo) {
  let actual = nodo
  while (actual) {
    if (ts.isCallExpression(actual)) {
      const llamada = actual.expression
      if (
        ts.isPropertyAccessExpression(llamada) &&
        llamada.name.text === 'from' &&
        actual.arguments.length > 0 &&
        ts.isStringLiteralLike(actual.arguments[0])
      ) {
        return actual.arguments[0].text
      }
      actual = llamada
      continue
    }
    if (ts.isPropertyAccessExpression(actual)) {
      actual = actual.expression
      continue
    }
    if (ts.isNonNullExpression(actual) || ts.isParenthesizedExpression(actual)) {
      actual = actual.expression
      continue
    }
    return null
  }
  return null
}

const infracciones = []

for (const archivo of archivosFuente(SRC)) {
  const fuente = ts.createSourceFile(
    archivo,
    fs.readFileSync(archivo, 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
    archivo.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  const visitar = (nodo) => {
    if (
      ts.isCallExpression(nodo) &&
      ts.isPropertyAccessExpression(nodo.expression) &&
      METODOS_ESCRITURA.has(nodo.expression.name.text)
    ) {
      const destino = destinoDeLaCadena(nodo.expression.expression)
      if (destino && !DESTINOS_PERMITIDOS.has(destino)) {
        const { line } = fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente))
        infracciones.push(
          `${path.relative(ROOT, archivo)}:${line + 1} — .${nodo.expression.name.text}() sobre '${destino}'`,
        )
      }
    }
    ts.forEachChild(nodo, visitar)
  }

  visitar(fuente)
}

assert.deepEqual(
  infracciones,
  [],
  'El navegador no debe escribir sobre tablas de negocio. ' +
    'Usá una RPC SECURITY DEFINER o una función Netlify que valide alcance server-side.\n' +
    infracciones.map((i) => `  - ${i}`).join('\n'),
)

// El detector tiene que reconocer la forma que prohibe: si el AST walk se
// rompiera, el assert de arriba pasaria en vacio y el contrato seria inutil.
{
  const muestra = ts.createSourceFile(
    'muestra.ts',
    [
      "await supabase.from('productos').insert({ a: 1 })",
      "await supabase.from('vencimientos').update(p).eq('id', x)",
      "await supabase.from('familias').select('id')",
      "await supabase.from('push_subscriptions').insert({ b: 2 })",
    ].join('\n'),
    ts.ScriptTarget.ES2022,
    true,
  )

  const detectados = []
  const visitar = (nodo) => {
    if (
      ts.isCallExpression(nodo) &&
      ts.isPropertyAccessExpression(nodo.expression) &&
      METODOS_ESCRITURA.has(nodo.expression.name.text)
    ) {
      const destino = destinoDeLaCadena(nodo.expression.expression)
      if (destino) detectados.push(`${nodo.expression.name.text}:${destino}`)
    }
    ts.forEachChild(nodo, visitar)
  }
  visitar(muestra)

  assert.deepEqual(
    detectados.sort(),
    ['insert:productos', 'insert:push_subscriptions', 'update:vencimientos'],
    'el detector debe reconocer escrituras encadenadas y no confundir select con escritura',
  )
}

// Las dos paginas legacy que contenian escritores directos fueron eliminadas.
// No alcanza con que no esten ruteadas: el archivo no debe volver.
for (const eliminado of ['src/pages/Importar.tsx', 'src/pages/ImportarMasivo.tsx']) {
  assert.equal(
    fs.existsSync(path.join(ROOT, eliminado)),
    false,
    `${eliminado} fue eliminado por contener escritores directos desde el browser; ` +
      'la version segura es el archivo *Seguro correspondiente',
  )
}

console.log('✓ el navegador no escribe sobre tablas de negocio')
