#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export const ARCHIVOS_EXPECTATIVA = [
  {
    nombre: 'expected-replay-fingerprint.json',
    inicio: '<<<NOVEN_REPLAY_EXPECTED_FINGERPRINT_GZIP_BASE64_V1_BEGIN>>>',
    fin: '<<<NOVEN_REPLAY_EXPECTED_FINGERPRINT_GZIP_BASE64_V1_END>>>',
  },
  {
    nombre: 'replay-expectation.json',
    inicio: '<<<NOVEN_REPLAY_EXPECTATION_GZIP_BASE64_V1_BEGIN>>>',
    fin: '<<<NOVEN_REPLAY_EXPECTATION_GZIP_BASE64_V1_END>>>',
  },
]

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')

function validarJson(nombre, bytes) {
  try {
    JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    throw new Error(`${nombre}: el contenido extraído no es JSON válido (${error.message})`)
  }
}

export function emitirExpectativaParaLog(directorio = path.join(HERE, 'baseline-v1')) {
  const bloques = ARCHIVOS_EXPECTATIVA.map(({ nombre, inicio, fin }) => {
    const bytes = fs.readFileSync(path.join(directorio, nombre))
    validarJson(nombre, bytes)
    const payload = zlib.gzipSync(bytes, { level: 9, mtime: 0 }).toString('base64')

    return [
      inicio,
      `NOVEN_FILENAME=${nombre}`,
      'NOVEN_ENCODING=gzip+base64',
      `NOVEN_SHA256=${sha256(bytes)}`,
      `NOVEN_PAYLOAD=${payload}`,
      fin,
    ].join('\n')
  })

  return `${bloques.join('\n')}\n`
}

function limpiarPrefijoGitHub(linea) {
  return linea
    .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s+/, '')
    .trim()
}

function indicesDe(lineas, valor) {
  const indices = []
  lineas.forEach((linea, indice) => {
    if (linea === valor) indices.push(indice)
  })
  return indices
}

function leerCampos(nombre, lineas) {
  const campos = new Map()
  for (const linea of lineas.filter(Boolean)) {
    const igual = linea.indexOf('=')
    if (igual <= 0) throw new Error(`${nombre}: línea inesperada dentro del bloque`)
    const clave = linea.slice(0, igual)
    const valor = linea.slice(igual + 1)
    if (campos.has(clave)) throw new Error(`${nombre}: campo duplicado ${clave}`)
    campos.set(clave, valor)
  }
  return campos
}

function decodificarBase64(nombre, payload) {
  if (!payload || payload.length % 4 !== 0
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)) {
    throw new Error(`${nombre}: payload base64 inválido`)
  }

  const bytes = Buffer.from(payload, 'base64')
  if (bytes.toString('base64') !== payload) {
    throw new Error(`${nombre}: payload base64 no canónico`)
  }
  return bytes
}

export function extraerExpectativaDesdeLog(log) {
  const lineas = log.split(/\r?\n/).map(limpiarPrefijoGitHub)
  const extraidos = new Map()

  for (const especificacion of ARCHIVOS_EXPECTATIVA) {
    const { nombre, inicio, fin } = especificacion
    const inicios = indicesDe(lineas, inicio)
    const finales = indicesDe(lineas, fin)

    if (inicios.length !== 1 || finales.length !== 1) {
      throw new Error(
        `${nombre}: se esperaba exactamente un bloque; `
        + `inicios=${inicios.length}, finales=${finales.length}`,
      )
    }
    if (finales[0] <= inicios[0]) {
      throw new Error(`${nombre}: delimitadores fuera de orden`)
    }

    const campos = leerCampos(nombre, lineas.slice(inicios[0] + 1, finales[0]))
    const clavesEsperadas = ['NOVEN_FILENAME', 'NOVEN_ENCODING', 'NOVEN_SHA256', 'NOVEN_PAYLOAD']
    if (campos.size !== clavesEsperadas.length || clavesEsperadas.some((clave) => !campos.has(clave))) {
      throw new Error(`${nombre}: bloque incompleto o con campos inesperados`)
    }
    if (campos.get('NOVEN_FILENAME') !== nombre) {
      throw new Error(`${nombre}: el nombre declarado no coincide`)
    }
    if (campos.get('NOVEN_ENCODING') !== 'gzip+base64') {
      throw new Error(`${nombre}: encoding no soportado`)
    }

    const checksumEsperado = campos.get('NOVEN_SHA256')
    if (!/^[0-9a-f]{64}$/.test(checksumEsperado)) {
      throw new Error(`${nombre}: SHA-256 inválido`)
    }

    const comprimido = decodificarBase64(nombre, campos.get('NOVEN_PAYLOAD'))
    let bytes
    try {
      bytes = zlib.gunzipSync(comprimido)
    } catch (error) {
      throw new Error(`${nombre}: gzip inválido (${error.message})`)
    }

    const checksumReal = sha256(bytes)
    if (checksumReal !== checksumEsperado) {
      throw new Error(
        `${nombre}: checksum SHA-256 no coincide; esperado=${checksumEsperado}, real=${checksumReal}`,
      )
    }
    validarJson(nombre, bytes)
    extraidos.set(nombre, { bytes, sha256: checksumReal })
  }

  return extraidos
}

export function escribirExpectativaExtraida(extraidos, directorioSalida) {
  for (const { nombre } of ARCHIVOS_EXPECTATIVA) {
    if (!extraidos.has(nombre)) throw new Error(`falta ${nombre}; no se escribió ningún archivo`)
  }

  fs.mkdirSync(directorioSalida, { recursive: true })
  const temporales = []
  try {
    for (const { nombre } of ARCHIVOS_EXPECTATIVA) {
      const temporal = path.join(directorioSalida, `.${nombre}.${process.pid}.tmp`)
      fs.writeFileSync(temporal, extraidos.get(nombre).bytes, { flag: 'wx' })
      temporales.push({ temporal, destino: path.join(directorioSalida, nombre) })
    }
    for (const { temporal, destino } of temporales) fs.renameSync(temporal, destino)
  } finally {
    for (const { temporal } of temporales) fs.rmSync(temporal, { force: true })
  }
}

function uso() {
  return [
    'Uso:',
    '  node scripts/migration-replay/extraer-expectativa-del-log.mjs --emit [baseline-v1-dir]',
    '  node scripts/migration-replay/extraer-expectativa-del-log.mjs <workflow.log> <directorio-salida>',
  ].join('\n')
}

function main(argumentos) {
  if (argumentos[0] === '--emit') {
    if (argumentos.length > 2) throw new Error(uso())
    process.stdout.write(emitirExpectativaParaLog(argumentos[1]))
    return
  }
  if (argumentos.length !== 2) throw new Error(uso())

  const [archivoLog, directorioSalida] = argumentos
  const extraidos = extraerExpectativaDesdeLog(fs.readFileSync(archivoLog, 'utf8'))
  escribirExpectativaExtraida(extraidos, directorioSalida)
  for (const [nombre, resultado] of extraidos) {
    console.log(`${nombre}: OK sha256=${resultado.sha256} bytes=${resultado.bytes.length}`)
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isCli) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
