import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import {
  ARCHIVOS_EXPECTATIVA,
  emitirExpectativaParaLog,
  escribirExpectativaExtraida,
  extraerExpectativaDesdeLog,
} from '../migration-replay/extraer-expectativa-del-log.mjs'

const root = process.cwd()
const baseline = path.join(root, 'scripts/migration-replay/baseline-v1')
const esperado = new Map(ARCHIVOS_EXPECTATIVA.map(({ nombre }) => [
  nombre,
  fs.readFileSync(path.join(baseline, nombre)),
]))

// Round-trip real, incluyendo el prefijo temporal de los logs descargados de
// GitHub Actions. Los bytes extraídos deben ser exactamente los del repositorio.
const emitido = emitirExpectativaParaLog(baseline)
const logConPrefijos = emitido
  .split('\n')
  .map((linea) => linea ? `2026-09-03T02:00:00.0000000Z ${linea}` : linea)
  .join('\n')
const extraidos = extraerExpectativaDesdeLog(logConPrefijos)

for (const { nombre } of ARCHIVOS_EXPECTATIVA) {
  assert.deepEqual(extraidos.get(nombre)?.bytes, esperado.get(nombre), `${nombre}: round-trip exacto`)
  assert.equal(
    extraidos.get(nombre)?.sha256,
    crypto.createHash('sha256').update(esperado.get(nombre)).digest('hex'),
    `${nombre}: checksum del archivo original`,
  )
}

const salida = fs.mkdtempSync(path.join(os.tmpdir(), 'noven-replay-log-'))
try {
  escribirExpectativaExtraida(extraidos, salida)
  assert.deepEqual(
    fs.readdirSync(salida).sort(),
    ARCHIVOS_EXPECTATIVA.map(({ nombre }) => nombre).sort(),
    'sólo se escriben los dos nombres permitidos',
  )
  for (const { nombre } of ARCHIVOS_EXPECTATIVA) {
    assert.deepEqual(fs.readFileSync(path.join(salida, nombre)), esperado.get(nombre))
  }
} finally {
  fs.rmSync(salida, { recursive: true, force: true })
}

// Corrupción silenciosa: gzip válido y JSON válido, pero no corresponde al
// SHA publicado. Tiene que fallar por checksum, no aceptar "algo parecido".
{
  const spec = ARCHIVOS_EXPECTATIVA[0]
  const alterado = Buffer.from('{"alterado":true}\n')
  const payloadAlterado = zlib.gzipSync(alterado, { level: 9, mtime: 0 }).toString('base64')
  const corrupto = emitido.replace(
    new RegExp(`(NOVEN_PAYLOAD=)[^\\n]+(?=\\n${spec.fin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`),
    `$1${payloadAlterado}`,
  )
  assert.throws(
    () => extraerExpectativaDesdeLog(corrupto),
    /checksum SHA-256 no coincide/,
    'un payload gzip válido pero alterado no puede pasar',
  )
}

// Delimitadores únicos: un bloque repetido o faltante es ambiguo y se rechaza.
{
  const spec = ARCHIVOS_EXPECTATIVA[0]
  assert.throws(
    () => extraerExpectativaDesdeLog(`${emitido}\n${spec.inicio}\n${spec.fin}\n`),
    /se esperaba exactamente un bloque/,
  )
}
{
  const spec = ARCHIVOS_EXPECTATIVA[1]
  const inicio = emitido.indexOf(spec.inicio)
  const fin = emitido.indexOf(spec.fin) + spec.fin.length
  const incompleto = emitido.slice(0, inicio) + emitido.slice(fin)
  assert.throws(() => extraerExpectativaDesdeLog(incompleto), /se esperaba exactamente un bloque/)
}

console.log('✓ Extractor de logs: delimitadores únicos, gzip+base64 y SHA-256 byte a byte')
