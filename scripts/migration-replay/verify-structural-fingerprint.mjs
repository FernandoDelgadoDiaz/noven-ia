import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

export function verifyFingerprint({
  databaseUrl,
  baselineDir = BASELINE_DIR,
  diffOutput,
} = {}) {
  if (!databaseUrl) throw new Error('A local disposable databaseUrl is required')

  const fingerprintSql = path.join(baselineDir, 'fingerprint.sql')
  const expectedPath = path.join(baselineDir, 'expected-fingerprint.json')
  const metadata = readJson(path.join(baselineDir, 'fingerprint-metadata.json'))
  const exclusions = readJson(path.join(baselineDir, 'exclusions-manifest.json'))
  const expectedRaw = fs.readFileSync(expectedPath, 'utf8').trim()

  if (sha256(expectedRaw) !== metadata.canonical_fingerprint_sha256) {
    throw new Error('Expected production fingerprint no longer matches its recorded SHA-256')
  }
  if (exclusions.allowed_unexplained_structural_differences !== 0) {
    throw new Error('Baseline V1 must not allow unexplained structural differences')
  }

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

  const actualRaw = query.stdout.trim()
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
  if (actualSha256 !== metadata.canonical_fingerprint_sha256) {
    throw new Error(
      `Semantic fingerprint matched but canonical SHA differed: ${actualSha256}`,
    )
  }

  return {
    sha256: actualSha256,
    legacyProductionSha256: metadata.legacy_production_fingerprint_sha256,
    differences: 0,
    summary: metadata.summary,
  }
}

function argument(argv, name) {
  const index = argv.indexOf(name)
  return index === -1 ? undefined : argv[index + 1]
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isCli) {
  try {
    const args = process.argv.slice(2)
    const result = verifyFingerprint({
      databaseUrl: process.env.NOVEN_REPLAY_DB_URL,
      diffOutput: argument(args, '--diff-output'),
    })
    console.log(JSON.stringify(result))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
