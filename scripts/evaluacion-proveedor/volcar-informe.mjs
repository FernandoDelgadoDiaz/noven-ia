#!/usr/bin/env node
// Vuelca el informe de evaluación al log del workflow.
//
// El artefacto de Actions vive en un blob storage que la política de egress de
// algunos entornos bloquea, así que decidir sobre las discrepancias exigiría
// mirar sólo el resumen. Y el resumen dice "declaró 4 unidades donde hay 162"
// sin la frase que lo rodea, que es justo lo que hace falta para saber si el
// modelo se equivocó o si el detector leyó mal.
//
// Mismo formato que la expectativa del replay: gzip+base64 entre marcadores,
// con SHA-256 para verificar la extracción.

import crypto from 'node:crypto'
import fs from 'node:fs'
import zlib from 'node:zlib'

const INICIO = '<<<NOVEN_EVAL_INFORME_GZIP_BASE64_V1_BEGIN>>>'
const FIN = '<<<NOVEN_EVAL_INFORME_GZIP_BASE64_V1_END>>>'

const ruta = process.argv[2]
if (!ruta) {
  console.error('Uso: node scripts/evaluacion-proveedor/volcar-informe.mjs <informe.json>')
  process.exit(1)
}

if (!fs.existsSync(ruta)) {
  console.error(`No existe ${ruta}; no hay informe que volcar.`)
  process.exit(0)
}

const bytes = fs.readFileSync(ruta)
JSON.parse(bytes.toString('utf8'))

process.stdout.write([
  INICIO,
  `NOVEN_FILENAME=${ruta}`,
  'NOVEN_ENCODING=gzip+base64',
  `NOVEN_SHA256=${crypto.createHash('sha256').update(bytes).digest('hex')}`,
  `NOVEN_PAYLOAD=${zlib.gzipSync(bytes, { level: 9, mtime: 0 }).toString('base64')}`,
  FIN,
  '',
].join('\n'))
