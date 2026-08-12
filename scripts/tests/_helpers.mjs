// Helper compartido de la suite de tests del importador.
//
// El proyecto no tiene runner de tests configurado. En vez de sumar una
// dependencia, se compilan los módulos TypeScript con el esbuild que ya trae
// Vite y se importan como ESM.
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
export const RAIZ = path.resolve(AQUI, '..', '..')

const require = createRequire(path.join(RAIZ, 'package.json'))
const { build } = require('esbuild')

const CACHE = path.join(RAIZ, 'node_modules', '.cache', 'tests-importador')
fs.mkdirSync(CACHE, { recursive: true })

/** Compila un módulo de src/lib y lo devuelve importado. */
export async function cargar(rutaRelativa) {
  const entrada = path.join(RAIZ, rutaRelativa)
  const salida = path.join(CACHE, path.basename(rutaRelativa).replace(/\.ts$/, '.mjs'))
  await build({ entryPoints: [entrada], outfile: salida, format: 'esm', bundle: true, platform: 'neutral' })
  return import(pathToFileURL(salida).href + `?t=${Date.now()}`)
}

// ─── Aserciones ───────────────────────────────────────────────────────────────

let fallos = 0
let total = 0

export function eq(nombre, actual, esperado) {
  total++
  const ok = JSON.stringify(actual) === JSON.stringify(esperado)
  if (!ok) fallos++
  const detalle = ok ? '' : ` (esperado ${JSON.stringify(esperado)})`
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${nombre}  =>  ${JSON.stringify(actual)}${detalle}`)
}

export function seccion(titulo) {
  console.log(`\n─── ${titulo} ───`)
}

export function resumen() {
  console.log(`\n${fallos === 0 ? `TODOS LOS TESTS PASAN (${total})` : `${fallos} de ${total} FALLARON`}`)
  return fallos
}

/** Codifica un string a Windows-1252 para probar la detección de encoding. */
export function aCp1252(texto) {
  const TABLA = {
    'á': 0xe1, 'é': 0xe9, 'í': 0xed, 'ó': 0xf3, 'ú': 0xfa, 'ñ': 0xf1, 'ü': 0xfc,
    'Á': 0xc1, 'É': 0xc9, 'Í': 0xcd, 'Ó': 0xd3, 'Ú': 0xda, 'Ñ': 0xd1,
    '°': 0xb0, 'º': 0xba, 'ª': 0xaa,
  }
  const bytes = []
  for (const ch of texto) {
    if (TABLA[ch] !== undefined) bytes.push(TABLA[ch])
    else if (ch.charCodeAt(0) < 256) bytes.push(ch.charCodeAt(0))
    else bytes.push(0x3f)
  }
  return Uint8Array.from(bytes)
}
