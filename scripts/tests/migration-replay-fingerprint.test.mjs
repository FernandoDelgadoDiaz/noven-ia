import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  sha256,
  structuralDiff,
} from '../migration-replay/verify-structural-fingerprint.mjs'

const root = process.cwd()
const baselineDir = path.join(root, 'scripts/migration-replay/baseline-v1')
const expectedRaw = fs
  .readFileSync(path.join(baselineDir, 'expected-fingerprint.json'), 'utf8')
  .trim()
const expected = JSON.parse(expectedRaw)
const metadata = JSON.parse(
  fs.readFileSync(path.join(baselineDir, 'fingerprint-metadata.json'), 'utf8'),
)
const exclusions = JSON.parse(
  fs.readFileSync(path.join(baselineDir, 'exclusions-manifest.json'), 'utf8'),
)
const fingerprintSql = fs.readFileSync(path.join(baselineDir, 'fingerprint.sql'), 'utf8')

assert.equal(sha256(expectedRaw), metadata.canonical_fingerprint_sha256)
assert.equal(
  metadata.legacy_production_fingerprint_sha256,
  '2cdba36ae58117100c8d0c8f9ddf235beeb8eaa372c90d9c777c43a991ad2020',
)
assert.equal(metadata.summary.tables, 31)
assert.equal(metadata.summary.columns, 384)
assert.equal(metadata.summary.constraints, 226)
assert.equal(metadata.summary.indexes, 128)
assert.equal(metadata.summary.functions, 112)
assert.equal(metadata.summary.views, 12)
assert.equal(metadata.summary.triggers, 29)
assert.equal(metadata.summary.rls, 31)
assert.equal(metadata.summary.policies, 17)
assert.equal(metadata.summary.identity_sequences, 6)

assert.equal(expected.tables.length, 31)
assert.equal(expected.columns.length, 384)
assert.equal(expected.constraints.length, 226)
assert.equal(expected.indexes.length, 128)
assert.equal(expected.functions.length, 112)
assert.equal(expected.views.length, 12)
assert.equal(expected.triggers.length, 29)
assert.equal(expected.rls.length, 31)
assert.equal(expected.policies.length, 17)
assert.equal(expected.identity_sequences.length, 6)

assert.equal(exclusions.allowed_unexplained_structural_differences, 0)
assert.ok(
  exclusions.excluded_from_core_fingerprint.some(
    (entry) => entry.kind === 'schema' && entry.objects.includes('desafio5s_archive'),
  ),
)
assert.deepEqual(exclusions.external_infrastructure_evidence.vault_secret_names, [
  'noven_push_webhook_secret',
])
assert.doesNotMatch(
  JSON.stringify(exclusions),
  /"(?:decrypted_secret|secret_value|secret|value|plaintext)"\s*:/i,
)
assert.doesNotMatch(fingerprintSql, /vault\.secrets|storage\.objects|auth\.users/)
assert.match(fingerprintSql, /extensions\.digest/)

const changed = structuredClone(expected)
changed.tables[0].name = 'unexpected_table'
const differences = structuralDiff(expected, changed)
assert.ok(differences.some((entry) => entry.path === '/tables/0/name'))
assert.deepEqual(structuralDiff(expected, structuredClone(expected)), [])

console.log('migration replay fingerprint: OK')
