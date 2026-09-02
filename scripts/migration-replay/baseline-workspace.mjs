import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASELINE_MIGRATION,
  BASELINE_VERSION,
  assembleBaseline,
} from './assemble-baseline.mjs'

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(MODULE_DIR, '..', '..')

function requireEphemeralReplay(env) {
  if (env.NOVEN_EPHEMERAL_REPLAY !== '1') {
    throw new Error(
      'Refusing baseline replay outside an explicitly disposable environment. Set NOVEN_EPHEMERAL_REPLAY=1.',
    )
  }
}

function migrationVersion(filename) {
  const match = /^(\d+)_.*\.sql$/.exec(filename)
  return match?.[1] ?? null
}

export function forwardMigrations({ repositoryRoot = REPOSITORY_ROOT } = {}) {
  const migrationsDir = path.join(repositoryRoot, 'supabase', 'migrations')
  return fs
    .readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .map((filename) => ({ filename, version: migrationVersion(filename) }))
    .filter(({ version }) => version && BigInt(version) > BigInt(BASELINE_VERSION))
    .sort((a, b) => a.filename.localeCompare(b.filename))
}

export function prepareBaselineWorkspace({
  repositoryRoot = REPOSITORY_ROOT,
  workspaceRoot,
  env = process.env,
} = {}) {
  requireEphemeralReplay(env)
  if (!workspaceRoot) throw new Error('prepareBaselineWorkspace requires workspaceRoot')

  const resolvedWorkspace = path.resolve(workspaceRoot)
  const migrationsDir = path.join(resolvedWorkspace, 'supabase', 'migrations')
  fs.mkdirSync(migrationsDir, { recursive: true })

  const existingSql = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'))
  if (existingSql.length > 0) {
    throw new Error(
      `Refusing to overwrite non-empty disposable migrations directory: ${migrationsDir}`,
    )
  }

  const baselinePath = path.join(migrationsDir, BASELINE_MIGRATION)
  const baseline = assembleBaseline({ outputPath: baselinePath })
  const forwards = forwardMigrations({ repositoryRoot })

  for (const migration of forwards) {
    fs.copyFileSync(
      path.join(repositoryRoot, 'supabase', 'migrations', migration.filename),
      path.join(migrationsDir, migration.filename),
      fs.constants.COPYFILE_EXCL,
    )
  }

  const replayManifest = {
    version: 1,
    strategy: 'verified_schema_baseline_then_forward_migrations',
    baseline: BASELINE_MIGRATION,
    cutoff: BASELINE_VERSION,
    forward_migrations: forwards.map(({ filename }) => filename),
    production_ledger_action: 'none',
    historical_migrations_copied: false,
  }
  fs.writeFileSync(
    path.join(resolvedWorkspace, 'baseline-replay-manifest.json'),
    `${JSON.stringify(replayManifest, null, 2)}\n`,
    'utf8',
  )

  return {
    workspaceRoot: resolvedWorkspace,
    migrationsDir,
    baseline,
    forwardMigrations: replayManifest.forward_migrations,
  }
}

function parseWorkspaceArgument(argv) {
  const index = argv.indexOf('--workspace')
  if (index === -1 || !argv[index + 1]) {
    throw new Error('Usage: node baseline-workspace.mjs --workspace <disposable-directory>')
  }
  return path.resolve(argv[index + 1])
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isCli) {
  try {
    const result = prepareBaselineWorkspace({
      workspaceRoot: parseWorkspaceArgument(process.argv.slice(2)),
    })
    console.log(JSON.stringify(result))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
