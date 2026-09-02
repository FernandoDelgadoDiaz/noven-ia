import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ANCHOR_FINGERPRINT,
  REPLAY_EXPECTATION,
  REPLAY_FINGERPRINT,
  forwardMigrationsDigest,
  readReplayExpectation,
} from './replay-expectation.mjs'

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const BASELINE_DIR = path.join(MODULE_DIR, 'baseline-v1')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function comparable(value) {
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, comparable(child)]),
    )
  }
  return value
}

export function structuralDiff(expected, actual, { limit = 50 } = {}) {
  const differences = []

  function visit(left, right, pointer) {
    if (differences.length >= limit || Object.is(left, right)) return

    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        differences.push({
          path: pointer,
          expected_length: left.length,
          actual_length: right.length,
        })
      }
      for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        visit(left[index], right[index], `${pointer}/${index}`)
      }
      return
    }

    const leftObject = left && typeof left === 'object'
    const rightObject = right && typeof right === 'object'
    if (leftObject && rightObject) {
      const keys = new Set([...Object.keys(left), ...Object.keys(right)])
      for (const key of [...keys].sort()) {
        visit(left[key], right[key], `${pointer}/${key}`)
      }
      return
    }

    differences.push({ path: pointer || '/', expected: left, actual: right })
  }

  visit(expected, actual, '')
  return differences
}

function runFingerprint(databaseUrl, fingerprintSql) {
  const query = spawnSync(
    'psql',
    [
      databaseUrl,
      '--no-psqlrc',
      '--tuples-only',
      '--no-align',
      '--quiet',
      '--set',
      'ON_ERROR_STOP=1',
      '--file',
      fingerprintSql,
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  )

  if (query.status !== 0) {
    throw new Error(`Fingerprint query failed:\n${query.stderr || query.stdout}`)
  }

  return query.stdout.trim()
}

export function verifyFingerprint({
  databaseUrl,
  baselineDir = BASELINE_DIR,
  diffOutput,
} = {}) {
  if (!databaseUrl) throw new Error('A local disposable databaseUrl is required')

  const fingerprintSql = path.join(baselineDir, 'fingerprint.sql')
  const metadata = readJson(path.join(baselineDir, 'fingerprint-metadata.json'))
  const exclusions = readJson(path.join(baselineDir, 'exclusions-manifest.json'))

  // 1. Integridad del ancla de producción. No se compara contra ella cuando hay
  //    migraciones posteriores, pero el archivo tiene que seguir siendo el que
  //    se materializó desde el catálogo productivo.
  const anchorRaw = fs.readFileSync(ANCHOR_FINGERPRINT, 'utf8').trim()
  if (sha256(anchorRaw) !== metadata.canonical_fingerprint_sha256) {
    throw new Error('Expected production fingerprint no longer matches its recorded SHA-256')
  }
  if (exclusions.allowed_unexplained_structural_differences !== 0) {
    throw new Error('Baseline V1 must not allow unexplained structural differences')
  }

  // 2. La expectativa móvil tiene que corresponder al conjunto exacto de
  //    migraciones posteriores que este replay va a aplicar.
  const expectation = readReplayExpectation()
  const digest = forwardMigrationsDigest()
  if (digest.sha256 !== expectation.forward_migrations_sha256) {
    throw new Error(
      'Las migraciones posteriores al cutoff cambiaron y la expectativa del replay no fue regenerada.\n'
      + `  esperadas: ${expectation.forward_migrations.join(', ') || '(ninguna)'}\n`
      + `  actuales:  ${digest.filenames.join(', ') || '(ninguna)'}\n`
      + '  Regenerá con: NOVEN_EPHEMERAL_REPLAY=1 ./scripts/migration-replay/run-baseline-replay.sh --regenerate\n'
      + '  y revisá el diff: muestra exactamente qué cambio estructural introduce la migración.',
    )
  }

  const expectedRaw = fs.readFileSync(REPLAY_FINGERPRINT, 'utf8').trim()
  if (sha256(expectedRaw) !== expectation.replay_fingerprint_sha256) {
    throw new Error('expected-replay-fingerprint.json no coincide con su SHA-256 registrado')
  }

  // 3. Sin migraciones posteriores, el replay reconstruye el ancla y punto: la
  //    expectativa móvil no puede diferir de producción. Es el único momento en
  //    que el gate sigue respondiendo "¿el repo reconstruye producción?".
  if (digest.filenames.length === 0 && expectedRaw !== anchorRaw) {
    throw new Error(
      'Sin migraciones posteriores al cutoff la expectativa del replay debe ser idéntica al ancla de producción',
    )
  }

  const actualRaw = runFingerprint(databaseUrl, fingerprintSql)
  const expected = comparable(JSON.parse(expectedRaw))
  const actual = comparable(JSON.parse(actualRaw))
  const differences = structuralDiff(expected, actual)

  if (differences.length > 0) {
    if (diffOutput) {
      fs.mkdirSync(path.dirname(diffOutput), { recursive: true })
      fs.writeFileSync(
        diffOutput,
        `${JSON.stringify(
          {
            expected_sha256: metadata.canonical_fingerprint_sha256,
            actual_sha256: sha256(actualRaw),
            differences,
          },
          null,
          2,
        )}\n`,
        'utf8',
      )
    }
    throw new Error(
      `Unexplained structural drift detected (${differences.length} difference(s) shown)`,
    )
  }

  const actualSha256 = sha256(actualRaw)
  if (actualSha256 !== expectation.replay_fingerprint_sha256) {
    throw new Error(
      `Semantic fingerprint matched but canonical SHA differed: ${actualSha256}`,
    )
  }

  return {
    sha256: actualSha256,
    anchorSha256: metadata.canonical_fingerprint_sha256,
    anchorMaterializedAt: expectation.anchor_materialized_at,
    legacyProductionSha256: metadata.legacy_production_fingerprint_sha256,
    forwardMigrations: digest.filenames,
    reconstruyeProduccion: digest.filenames.length === 0,
    differences: 0,
    summary: metadata.summary,
  }
}

/**
 * Regenera la expectativa móvil desde la base descartable ya replicada.
 *
 * Nunca toca `expected-fingerprint.json`: el ancla de producción sólo se
 * re-materializa desde el catálogo productivo, de forma explícita y periódica.
 */
export function regenerateReplayExpectation({ databaseUrl, baselineDir = BASELINE_DIR } = {}) {
  if (process.env.NOVEN_EPHEMERAL_REPLAY !== '1') {
    throw new Error('La regeneración exige un entorno descartable: NOVEN_EPHEMERAL_REPLAY=1')
  }
  if (!databaseUrl) throw new Error('A local disposable databaseUrl is required')

  const actualRaw = runFingerprint(databaseUrl, path.join(baselineDir, 'fingerprint.sql'))
  const digest = forwardMigrationsDigest()
  const previa = readReplayExpectation()

  fs.writeFileSync(REPLAY_FINGERPRINT, `${actualRaw}\n`, 'utf8')
  fs.writeFileSync(
    REPLAY_EXPECTATION,
    `${JSON.stringify(
      {
        ...previa,
        forward_migrations: digest.filenames,
        forward_migrations_sha256: digest.sha256,
        replay_fingerprint_sha256: sha256(actualRaw),
        regenerado_at: new Date().toISOString().slice(0, 10),
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  return { sha256: sha256(actualRaw), forwardMigrations: digest.filenames }
}

function argument(argv, name) {
  const index = argv.indexOf(name)
  return index === -1 ? undefined : argv[index + 1]
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isCli) {
  try {
    const args = process.argv.slice(2)
    const result = args.includes('--regenerate')
      ? regenerateReplayExpectation({ databaseUrl: process.env.NOVEN_REPLAY_DB_URL })
      : verifyFingerprint({
        databaseUrl: process.env.NOVEN_REPLAY_DB_URL,
        diffOutput: argument(args, '--diff-output'),
      })
    console.log(JSON.stringify(result))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
