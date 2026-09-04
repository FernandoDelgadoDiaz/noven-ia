// Configuración de inferencia leída de producción, no declarada acá.
//
// EL PROBLEMA QUE RESUELVE
//
// Una evaluación que usa su propio endpoint, su propio modelo o sus propios
// parámetros mide un sistema que nadie despliega. Y el modo de falla es
// silencioso: el corpus da verde, alguien cambia el modelo en `analisis.ts`, y
// la evaluación sigue midiendo el modelo viejo sin que nada avise.
//
// Por eso esto no declara nada: extrae de `netlify/functions/analisis.ts` la
// URL, el modelo y los parámetros que realmente se envían. Si producción cambia
// de modelo, la evaluación cambia con ella en la misma corrida.
//
// Es el mismo criterio que `formato.mjs` aplica al prompt.

import fs from 'node:fs'
import path from 'node:path'

const FUNCION = 'netlify/functions/analisis.ts'
const POLITICA = 'netlify/functions/_analisis_policy.ts'

function leer(relativo) {
  return fs.readFileSync(path.join(process.cwd(), relativo), 'utf8')
}

function exigir(valor, que) {
  if (valor == null) {
    throw new Error(
      `No se pudo extraer ${que} de ${FUNCION}.\n`
      + 'La evaluación lee la configuración de producción en vez de declararla, así que\n'
      + 'si cambió la forma de la llamada hay que actualizar scripts/evaluacion-proveedor/proveedor.mjs.\n'
      + 'Fallar acá es correcto: evaluar con una configuración inventada mide un sistema\n'
      + 'que nadie despliega.',
    )
  }
  return valor
}

/**
 * Lee la llamada al proveedor tal como está escrita en la Function.
 */
export function configuracionDeProduccion() {
  const src = leer(FUNCION)

  const url = exigir(/fetch\('(https:\/\/[^']+)'/.exec(src)?.[1], 'la URL del proveedor')
  const modelo = exigir(/model:\s*'([^']+)'/.exec(src)?.[1], 'el modelo')
  const envKey = exigir(/process\.env\.(OPENAI_API_KEY|DEEPSEEK_API_KEY)/.exec(src)?.[1], 'la variable de credencial')

  // Los parámetros de inferencia se copian tal cual: evaluar con otros mide
  // otra cosa. `temperature` sobre todo — con 0.2 la respuesta no es
  // determinista, y esa varianza es parte de lo que hay que medir.
  const extras = {}
  const temperature = /temperature:\s*([\d.]+)/.exec(src)?.[1]
  if (temperature != null) extras.temperature = Number(temperature)

  const maxCompletion = /max_completion_tokens:\s*(\d+)/.exec(src)?.[1]
  if (maxCompletion != null) extras.max_completion_tokens = Number(maxCompletion)

  const maxTokens = /max_tokens:\s*(\d+)/.exec(src)?.[1]
  if (maxTokens != null) extras.max_tokens = Number(maxTokens)

  const reasoning = /reasoning_effort:\s*'([^']+)'/.exec(src)?.[1]
  if (reasoning != null) extras.reasoning_effort = reasoning

  // `store: false` desactiva el almacenamiento voluntario de la respuesta. No
  // equivale a Zero Data Retention, pero es lo que la Function pide y la
  // evaluación tiene que pedir lo mismo.
  if (/store:\s*false/.test(src)) extras.store = false

  return { url, modelo, envKey, extras }
}

/**
 * Reconstruye `SYSTEM_ADMIN` resolviendo las interpolaciones del template.
 * Se lee del archivo en vez de importarlo porque es TypeScript de producción y
 * un script de evaluación no debería arrastrar el bundler.
 */
export function systemPromptDeProduccion() {
  const src = leer(POLITICA)

  const admin = exigir(/export const SYSTEM_ADMIN = `([\s\S]*?)`\s*$/m.exec(src)?.[1], 'SYSTEM_ADMIN')
  const reglas = /const REGLAS_OPERATIVAS = `([\s\S]*?)`\n/m.exec(src)?.[1] ?? ''
  const identidad = /export const IDENTIDAD_REGLA = '([\s\S]*?)'\n/m.exec(src)?.[1] ?? ''

  const resuelto = admin
    .replace('${REGLAS_OPERATIVAS}', reglas)
    .replace('${IDENTIDAD_REGLA}', identidad)

  if (resuelto.includes('${')) {
    throw new Error('SYSTEM_ADMIN quedó con interpolaciones sin resolver; actualizá proveedor.mjs')
  }
  return resuelto
}
