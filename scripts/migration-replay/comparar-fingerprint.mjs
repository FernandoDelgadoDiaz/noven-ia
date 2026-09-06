#!/usr/bin/env node
// Compara dos fingerprints estructurales POR CLAVE y OBJETO COMPLETO.
//
// POR QUÉ EXISTE ESTE SCRIPT
//
// Las dos veces que una comparación ad-hoc dejó pasar algo, el dato estaba en
// el fingerprint y la comparación no lo miraba:
//
//   · El diff aplanado por CONTEO decía "182 cambios" donde había uno, y otra
//     vez sugería que una columna había quedado nullable cuando no. El aplanado
//     cuenta valores sin asociarlos a su objeto.
//   · La comparación por CLAVE que lo reemplazó miraba sólo `definition_sha256`
//     de cada vista — y asi no vio que `security_invoker` se habia perdido al
//     hacer `CREATE OR REPLACE VIEW`. La vista pasaba a evaluar RLS como su
//     dueño: cualquier autenticado habría visto las filas de todas las
//     organizaciones. Lo cazó el verificador contra la base, no el diff.
//
// La leccion no es "mirar tambien las options": es que elegir a mano QUÉ campos
// comparar reintroduce el mismo error con otro campo. Este script indexa por
// clave natural y compara el OBJETO ENTERO, campo por campo.
//
// Uso:
//   node scripts/migration-replay/comparar-fingerprint.mjs <antes.json> <despues.json>
//   node scripts/migration-replay/comparar-fingerprint.mjs --ref origin/master

import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const RUTA = 'scripts/migration-replay/baseline-v1/expected-replay-fingerprint.json'

/** Campos que identifican una entrada. Los que existan, en este orden. */
const CAMPOS_CLAVE = [
  'schema', 'table', 'relation', 'name', 'indexname', 'indexrelname',
  'identity_arguments', 'grantee', 'privilege', 'kind',
]

const claveDe = (o) => {
  const partes = CAMPOS_CLAVE.filter((c) => o[c] !== undefined).map((c) => `${c}=${o[c]}`)
  // Sin ningún campo identificador, la entrada es su propio contenido: sólo
  // puede aparecer o desaparecer, nunca "cambiar".
  return partes.length ? partes.join('·') : JSON.stringify(o)
}

function indexar(lista) {
  const m = new Map()
  for (const o of lista) {
    const k = claveDe(o)
    // Una clave repetida significa que CAMPOS_CLAVE no alcanza para esta
    // sección. Callarlo convertiría entradas distintas en una sola.
    if (m.has(k)) throw new Error(`clave ambigua "${k}": hay que ampliar CAMPOS_CLAVE`)
    m.set(k, o)
  }
  return m
}

function diferencias(antes, despues) {
  const salida = []
  const secciones = new Set([...Object.keys(antes), ...Object.keys(despues)])

  for (const sec of [...secciones].sort()) {
    const a = antes[sec], b = despues[sec]
    if (!Array.isArray(a) || !Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        salida.push({ seccion: sec, tipo: 'valor', antes: a, despues: b })
      }
      continue
    }
    const ma = indexar(a), mb = indexar(b)
    for (const k of mb.keys()) if (!ma.has(k)) salida.push({ seccion: sec, tipo: 'AGREGA', clave: k })
    for (const k of ma.keys()) if (!mb.has(k)) salida.push({ seccion: sec, tipo: 'SACA', clave: k })
    for (const [k, oa] of ma) {
      const ob = mb.get(k)
      if (!ob) continue
      const campos = new Set([...Object.keys(oa), ...Object.keys(ob)])
      const cambios = []
      for (const c of [...campos].sort()) {
        if (JSON.stringify(oa[c]) !== JSON.stringify(ob[c])) {
          cambios.push({ campo: c, antes: oa[c], despues: ob[c] })
        }
      }
      if (cambios.length) salida.push({ seccion: sec, tipo: 'CAMBIA', clave: k, cambios })
    }
  }
  return salida
}

const args = process.argv.slice(2)
let antes, despues
if (args[0] === '--ref') {
  const ref = args[1] ?? 'origin/master'
  antes = JSON.parse(execFileSync('git', ['show', `${ref}:${RUTA}`], { encoding: 'utf8', maxBuffer: 1 << 28 }))
  despues = JSON.parse(fs.readFileSync(RUTA, 'utf8'))
} else {
  if (args.length !== 2) throw new Error('Uso: comparar-fingerprint.mjs <antes.json> <despues.json> | --ref <git-ref>')
  antes = JSON.parse(fs.readFileSync(args[0], 'utf8'))
  despues = JSON.parse(fs.readFileSync(args[1], 'utf8'))
}

const d = diferencias(antes, despues)
if (!d.length) {
  console.log('Sin diferencias estructurales.')
} else {
  const n = { AGREGA: 0, SACA: 0, CAMBIA: 0, valor: 0 }
  for (const x of d) n[x.tipo]++
  console.log(`AGREGA ${n.AGREGA} · SACA ${n.SACA} · CAMBIA ${n.CAMBIA}\n`)
  for (const x of d) {
    if (x.tipo === 'CAMBIA') {
      console.log(`  CAMBIA  [${x.seccion}] ${x.clave}`)
      for (const c of x.cambios) {
        console.log(`            ${c.campo}: ${JSON.stringify(c.antes)} -> ${JSON.stringify(c.despues)}`)
      }
    } else if (x.tipo === 'valor') {
      console.log(`  ${x.tipo.padEnd(7)} [${x.seccion}] ${JSON.stringify(x.antes)} -> ${JSON.stringify(x.despues)}`)
    } else {
      console.log(`  ${x.tipo.padEnd(7)} [${x.seccion}] ${x.clave}`)
    }
  }
}
