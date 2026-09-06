// Contrato del comparador de fingerprints.
//
// Este script es ahora EL INSTRUMENTO con el que se decide si una migración
// cambió algo que no debía. Un instrumento que no detecta lo que dice detectar
// es peor que no tenerlo: da una confirmación falsa.
//
// El caso real que motiva cada aserción: al reemplazar `v_seguimiento_rag_actual`
// con `CREATE OR REPLACE VIEW`, la vista PERDIÓ `security_invoker` y pasó a
// evaluar RLS como su dueño. El fingerprint lo registró —`options` cambió de
// `["security_invoker=true"]` a `null`— y la comparación de entonces, que miraba
// sólo `definition_sha256`, no lo vio.

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noven-fp-'))
const escribir = (nombre, obj) => {
  const p = path.join(dir, nombre)
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8')
  return p
}

const correr = (a, b) =>
  execFileSync('node', ['scripts/migration-replay/comparar-fingerprint.mjs', a, b],
    { encoding: 'utf8', cwd: process.cwd() })

const vista = (extra = {}) => ({
  schema: 'public', name: 'v_x', definition_sha256: 'aaa',
  options: ['security_invoker=true'], ...extra,
})

// --- 1. El caso que se escapó: un campo distinto de la definición -----------

const salida = correr(
  escribir('a.json', { views: [vista()] }),
  escribir('b.json', { views: [vista({ options: null })] }),
)
assert.match(salida, /CAMBIA/, 'perder security_invoker es un cambio y tiene que reportarse')
assert.match(
  salida,
  /options: \["security_invoker=true"\] -> null/,
  'el campo que cambió tiene que aparecer con su valor antes y después: es la ' +
    'línea que habría evitado una rotura de aislamiento multitenant',
)
// La definición NO cambió en este caso: si el comparador sólo mirara ese campo
// —como hacía la comparación ad-hoc— este diff saldría vacío.
assert.ok(!/definition_sha256/.test(salida),
  'la definición no cambió acá; el hallazgo viene de otro campo')

// --- 2. Altas y bajas -------------------------------------------------------

assert.match(
  correr(escribir('c.json', { views: [] }), escribir('d.json', { views: [vista()] })),
  /AGREGA\s+\[views\]/, 'una vista nueva se reporta como alta')
assert.match(
  correr(escribir('e.json', { views: [vista()] }), escribir('f.json', { views: [] })),
  /SACA\s+\[views\]/, 'una vista borrada se reporta como baja')

// --- 3. Sin cambios, no inventa ninguno -------------------------------------

assert.match(
  correr(escribir('g.json', { views: [vista()] }), escribir('h.json', { views: [vista()] })),
  /Sin diferencias estructurales/,
  'un comparador que reporta ruido deja de leerse, y entonces no protege nada')

// --- 4. Una clave ambigua ABORTA en vez de fundir dos entradas --------------
//
// Si los campos identificadores no alcanzan para distinguir dos entradas,
// callarlo las convertiría en una sola y el diff mentiría por omisión.
// Dos entradas que COMPARTEN los campos identificadores y difieren en otro:
// ahí la clave no alcanza. (Sin ningún campo identificador no hay ambigüedad:
// la entrada es su propio contenido y sólo puede aparecer o desaparecer — eso
// lo verifiqué escribiendo mal este caso la primera vez.)
assert.throws(
  () => correr(
    escribir('i.json', { raro: [{ name: 'x', v: 1 }, { name: 'x', v: 2 }] }),
    escribir('j.json', { raro: [{ name: 'x', v: 1 }, { name: 'x', v: 2 }] }),
  ),
  /clave ambigua|Command failed/,
  'con claves ambiguas hay que ampliar los campos identificadores, no seguir',
)

console.log('✓ El comparador detecta cambios de campo, altas, bajas, y aborta ante claves ambiguas')
