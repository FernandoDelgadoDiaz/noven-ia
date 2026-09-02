// Expectativa móvil del replay.
//
// El ancla de producción (`expected-fingerprint.json`) se materializó desde el
// catálogo productivo y NO se regenera desde una base replicada: hacerlo la
// convertiría en "lo que produjo el replay" y el gate quedaría verde sin valor.
//
// Pero el replay aplica baseline + migraciones posteriores al cutoff, así que la
// huella real deja de coincidir con el ancla en cuanto existe una migración
// nueva. La expectativa móvil resuelve eso: es la huella esperada del conjunto
// que el replay va a aplicar hoy, y viaja atada a ese conjunto exacto.
//
// La atadura es lo que evita que se degrade en un archivo que alguien regenera
// para poner CI en verde: si cambian las migraciones posteriores sin regenerar
// la expectativa, el gate falla y dice qué hacer. Y si se regenera, el diff del
// PR muestra exactamente qué cambio estructural introduce la migración, que es
// justamente lo que hay que revisar.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { forwardMigrations } from './baseline-workspace.mjs'

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(MODULE_DIR, '..', '..')

export const BASELINE_DIR = path.join(MODULE_DIR, 'baseline-v1')
export const ANCHOR_FINGERPRINT = path.join(BASELINE_DIR, 'expected-fingerprint.json')
export const REPLAY_FINGERPRINT = path.join(BASELINE_DIR, 'expected-replay-fingerprint.json')
export const REPLAY_EXPECTATION = path.join(BASELINE_DIR, 'replay-expectation.json')

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/**
 * Identidad del conjunto de migraciones posteriores al cutoff: nombres y
 * contenido. Cubre el alta de una migración y también la edición de una que ya
 * estaba, que de otro modo pasaría inadvertida.
 */
export function forwardMigrationsDigest({ repositoryRoot = REPOSITORY_ROOT } = {}) {
  const forwards = forwardMigrations({ repositoryRoot })
  const filenames = forwards.map(({ filename }) => filename)
  const contenido = filenames
    .map((filename) => {
      const sql = fs.readFileSync(
        path.join(repositoryRoot, 'supabase', 'migrations', filename),
        'utf8',
      )
      return `${filename}\n${sha256(sql)}`
    })
    .join('\n')

  return { filenames, sha256: sha256(contenido) }
}

export function readReplayExpectation() {
  return JSON.parse(fs.readFileSync(REPLAY_EXPECTATION, 'utf8'))
}

/**
 * Antigüedad del ancla de producción en días. La re-materialización es
 * explícita y periódica: nunca se dispara sola dentro de una corrida de CI,
 * porque un ancla que se refresca sola no ancla nada.
 */
export function anchorAgeDays(expectation = readReplayExpectation(), now = new Date()) {
  const materializado = Date.parse(expectation.anchor_materialized_at)
  if (Number.isNaN(materializado)) throw new Error('anchor_materialized_at inválido')
  return Math.floor((now.getTime() - materializado) / 86_400_000)
}
