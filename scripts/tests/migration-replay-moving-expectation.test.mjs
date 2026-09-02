// Contrato de la expectativa móvil del replay.
//
// El gate de 1.4C comparaba el resultado del replay contra una foto estática de
// producción. Con cero migraciones posteriores al cutoff coincidían, pero la
// primera migración nueva —cualquiera— lo rompía: el replay aplica baseline +
// posteriores, y la foto sólo contenía el baseline.
//
// La expectativa móvil arregla eso sin regenerar el ancla de producción, que es
// la trampa obvia: regenerarla desde una base replicada la convierte en "lo que
// produjo el replay" y el gate queda verde sin detectar nada.
//
// Lo que este contrato protege es la atadura. La expectativa móvil sólo vale si
// viaja pegada al conjunto exacto de migraciones posteriores; si se puede
// regenerar sin que nadie lo note, es un archivo para poner CI en verde.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  ANCHOR_FINGERPRINT,
  REPLAY_EXPECTATION,
  REPLAY_FINGERPRINT,
  anchorAgeDays,
  forwardMigrationsDigest,
  sha256,
} from '../migration-replay/replay-expectation.mjs'

const root = process.cwd()
const expectation = JSON.parse(fs.readFileSync(REPLAY_EXPECTATION, 'utf8'))
const anchorRaw = fs.readFileSync(ANCHOR_FINGERPRINT, 'utf8').trim()
const replayRaw = fs.readFileSync(REPLAY_FINGERPRINT, 'utf8').trim()
const metadata = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/migration-replay/baseline-v1/fingerprint-metadata.json'), 'utf8'),
)

// El ancla sigue siendo la que se materializó desde el catálogo productivo.
assert.equal(sha256(anchorRaw), metadata.canonical_fingerprint_sha256,
  'expected-fingerprint.json debe seguir siendo el ancla de producción registrada')
assert.equal(expectation.anchor_fingerprint_sha256, metadata.canonical_fingerprint_sha256,
  'la expectativa móvil debe declarar contra qué ancla se generó')

// La expectativa móvil corresponde al conjunto actual de migraciones posteriores.
const digest = forwardMigrationsDigest()
assert.deepEqual(expectation.forward_migrations, digest.filenames,
  'la expectativa del replay quedó desactualizada respecto de supabase/migrations')
assert.equal(expectation.forward_migrations_sha256, digest.sha256,
  'cambió el contenido de alguna migración posterior sin regenerar la expectativa')
assert.equal(expectation.replay_fingerprint_sha256, sha256(replayRaw),
  'expected-replay-fingerprint.json no coincide con su SHA-256 registrado')

// Sin migraciones posteriores, la expectativa NO puede diferir del ancla: es el
// único momento en que el gate sigue respondiendo si el repo reconstruye
// producción. Si esto se relaja, se pierde el ancla sin que nadie lo note.
if (digest.filenames.length === 0) {
  assert.equal(replayRaw, anchorRaw,
    'sin migraciones posteriores el replay debe reconstruir exactamente el ancla de producción')
}

// El ancla envejece. La re-materialización es explícita y periódica; este
// tripwire existe para que no dependa de que alguien se acuerde.
const dias = anchorAgeDays(expectation)
assert.ok(
  dias <= expectation.anchor_revalidacion_maxima_dias,
  [
    `El ancla de producción tiene ${dias} días; el máximo declarado es ${expectation.anchor_revalidacion_maxima_dias}.`,
    '',
    'QUÉ HACER — re-materializar el ancla (docs/MIGRATION_REPLAY_BASELINE_V1.md §14.4):',
    '  1. extraer los 39 fragmentos SQL desde el catálogo productivo hacia baseline-v1/;',
    '  2. actualizar artifact-manifest.json con el git blob SHA de cada fragmento;',
    '  3. correr el replay en descartable y tomar la huella:',
    '     NOVEN_EPHEMERAL_REPLAY=1 ./scripts/migration-replay/run-baseline-replay.sh',
    '  4. escribir esa huella en expected-fingerprint.json y su SHA-256 en',
    '     fingerprint-metadata.json, y mover BASELINE_VERSION al cutoff nuevo;',
    '  5. regenerar la expectativa móvil: run-baseline-replay.sh --regenerate;',
    '  6. actualizar anchor_materialized_at en replay-expectation.json.',
    '',
    'CUÁNTO LLEVA — los pasos 3 a 6 están scriptados y son minutos. El paso 1 NO está',
    'scriptado y es el grueso del trabajo: la extracción se hizo a mano en el PR #129.',
    '',
    'NO MUEVAS anchor_materialized_at sin hacer los pasos 1 a 5. Deja el gate verde y sin',
    'ancla, que es exactamente el modo de falla que este tripwire existe para evitar.',
  ].join('\n'),
)

// El regenerador nunca debe poder tocar el ancla.
const verifier = fs.readFileSync(
  path.join(root, 'scripts/migration-replay/verify-structural-fingerprint.mjs'), 'utf8',
)
const regenerador = verifier.slice(verifier.indexOf('export function regenerateReplayExpectation'))
assert.doesNotMatch(regenerador, /ANCHOR_FINGERPRINT/,
  'la regeneración jamás debe escribir sobre el ancla de producción')
assert.match(regenerador, /NOVEN_EPHEMERAL_REPLAY !== '1'/,
  'la regeneración exige entorno descartable')

// El verificador compara contra la expectativa móvil, no contra el ancla.
assert.match(verifier, /const expectedRaw = fs\.readFileSync\(REPLAY_FINGERPRINT/,
  'el diff estructural debe evaluarse contra la expectativa móvil')
assert.match(verifier, /digest\.sha256 !== expectation\.forward_migrations_sha256/,
  'el gate debe fallar si las migraciones posteriores cambiaron sin regenerar')

console.log('✓ Expectativa móvil atada a las migraciones posteriores, con el ancla de producción intacta')
