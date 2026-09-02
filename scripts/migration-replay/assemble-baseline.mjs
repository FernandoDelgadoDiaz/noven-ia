import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const BASELINE_VERSION = '20260901103500'
export const BASELINE_NAME = 'noven_core_schema_baseline_v1'
export const BASELINE_MIGRATION = `${BASELINE_VERSION}_${BASELINE_NAME}.sql`

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
export const BASELINE_DIR = path.join(MODULE_DIR, 'baseline-v1')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function gitBlobSha(content) {
  const bytes = Buffer.from(content, 'utf8')
  return crypto
    .createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex')
}

export function executableFragment(relativePath, content) {
  if (!relativePath.startsWith('40_functions/')) return content

  const functionCount = content.match(/^CREATE OR REPLACE FUNCTION /gm)?.length ?? 0
  let terminatorCount = 0
  const executable = content.replace(
    /\$function\$(?=$|\n(?:$|\n(?:CREATE OR REPLACE FUNCTION|SET check_function_bodies = true;)))/g,
    () => {
      terminatorCount += 1
      return '$function$;'
    },
  )

  if (terminatorCount !== functionCount) {
    throw new Error(
      `${relativePath}: expected ${functionCount} function terminators, generated ${terminatorCount}`,
    )
  }

  return executable
}

export function verifiedFragmentPaths({ baselineDir = BASELINE_DIR } = {}) {
  const manifest = readJson(path.join(baselineDir, 'artifact-manifest.json'))
  const entries = Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b))

  if (entries.length === 0) {
    throw new Error('Baseline V1 has no declared SQL fragments')
  }

  const errors = []
  const paths = entries.map(([relativePath, metadata]) => {
    if (
      path.isAbsolute(relativePath) ||
      relativePath.split('/').includes('..') ||
      !relativePath.endsWith('.sql')
    ) {
      throw new Error(`Unsafe baseline fragment path: ${relativePath}`)
    }

    const absolutePath = path.join(baselineDir, relativePath)
    if (!fs.existsSync(absolutePath)) {
      errors.push(`${relativePath}: missing`)
      return absolutePath
    }

    const content = fs.readFileSync(absolutePath, 'utf8')
    const actualSha = gitBlobSha(content)
    if (actualSha !== metadata.git_blob_sha) {
      errors.push(
        `${relativePath}: expected ${metadata.git_blob_sha}, received ${actualSha}`,
      )
    }
    return absolutePath
  })

  if (errors.length > 0) {
    throw new Error(`Baseline fragment verification failed:\n${errors.join('\n')}`)
  }

  return { manifest, entries, paths }
}

export function assembleBaseline({
  baselineDir = BASELINE_DIR,
  outputPath,
} = {}) {
  if (!outputPath) {
    throw new Error('assembleBaseline requires an explicit outputPath')
  }

  const { manifest, entries } = verifiedFragmentPaths({ baselineDir })
  const sections = entries.map(([relativePath]) => {
    const content = executableFragment(
      relativePath,
      fs.readFileSync(path.join(baselineDir, relativePath), 'utf8'),
    )
    return `-- BEGIN VERIFIED FRAGMENT: ${relativePath}\n${content.trimEnd()}\n-- END VERIFIED FRAGMENT: ${relativePath}`
  })

  const sql = `-- NOVEN_CORE_SCHEMA_BASELINE_V1
-- Generated deterministically from verified, structure-only catalog fragments.
-- Source project: ${manifest.source.project_ref}
-- Source master: ${manifest.source.source_master}
-- Cutoff: ${manifest.source.cutoff_version}_${manifest.source.cutoff_name}
-- Never apply this artifact to the production migration ledger.

BEGIN;

${sections.join('\n\n')}

COMMIT;
`

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, sql, 'utf8')

  return {
    outputPath,
    fragmentCount: entries.length,
    byteLength: Buffer.byteLength(sql),
    sha256: crypto.createHash('sha256').update(sql).digest('hex'),
  }
}

function parseOutputArgument(argv) {
  const index = argv.indexOf('--output')
  if (index === -1 || !argv[index + 1]) {
    throw new Error('Usage: node assemble-baseline.mjs --output <migration.sql>')
  }
  return path.resolve(argv[index + 1])
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isCli) {
  try {
    const result = assembleBaseline({ outputPath: parseOutputArgument(process.argv.slice(2)) })
    console.log(JSON.stringify(result))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
