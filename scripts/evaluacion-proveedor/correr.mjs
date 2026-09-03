// Corre el corpus contra un proveedor y mide adherencia a los guardarraíles.
//
// Uso:
//   node scripts/evaluacion-proveedor/correr.mjs --proveedor openai
//   node scripts/evaluacion-proveedor/correr.mjs --proveedor deepseek --repeticiones 3
//   node scripts/evaluacion-proveedor/correr.mjs --proveedor openai --salida informe.json
//
// Los parámetros de inferencia son los MISMOS que usa producción
// (`temperature: 0.2`, `max_tokens: 1500`). Evaluar con otros mediría un
// sistema que nadie va a desplegar.
//
// `temperature` no es 0, así que la respuesta no es determinista aunque el
// corpus sí lo sea. Para eso está `--repeticiones`: un guardarraíl que falla
// una vez de tres es un guardarraíl que falla.

import fs from 'node:fs'
import process from 'node:process'

import { CORPUS } from './corpus.mjs'
import { evaluarRespuesta, GUARDRAILS } from './guardrails.mjs'

const PROVEEDORES = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    envKey: 'OPENAI_API_KEY',
    modelo: process.env.OPENAI_MODEL || 'gpt-4o',
    jurisdiccion: 'Estados Unidos',
  },
  deepseek: {
    url: 'https://api.deepseek.com/chat/completions',
    envKey: 'DEEPSEEK_API_KEY',
    modelo: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    jurisdiccion: 'República Popular China',
  },
}

function parsearArgs(argv) {
  const out = { proveedor: 'openai', repeticiones: 1, salida: null, escenario: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--proveedor') out.proveedor = argv[++i]
    else if (a === '--repeticiones') out.repeticiones = Number(argv[++i])
    else if (a === '--salida') out.salida = argv[++i]
    else if (a === '--escenario') out.escenario = argv[++i]
  }
  return out
}

/**
 * Llama al proveedor con los parámetros de producción. Algunos modelos nuevos
 * rechazan `max_tokens` o cualquier `temperature` distinta de 1; en ese caso se
 * reintenta adaptando y se DEJA CONSTANCIA, porque una corrida con parámetros
 * distintos a los de producción no es comparable en silencio.
 */
async function pedirAnalisis(prov, apiKey, sistema, usuario) {
  const base = {
    model: prov.modelo,
    messages: [
      { role: 'system', content: sistema },
      { role: 'user', content: usuario },
    ],
  }

  const intentos = [
    { cuerpo: { ...base, max_tokens: 1500, temperature: 0.2 }, ajuste: null },
    { cuerpo: { ...base, max_completion_tokens: 1500, temperature: 0.2 }, ajuste: 'max_completion_tokens' },
    { cuerpo: { ...base, max_completion_tokens: 1500 }, ajuste: 'max_completion_tokens + temperature por defecto' },
  ]

  let ultimoError = null
  for (const { cuerpo, ajuste } of intentos) {
    const res = await fetch(prov.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(cuerpo),
    })

    if (res.ok) {
      const data = await res.json()
      const contenido = data.choices?.[0]?.message?.content?.trim() ?? ''
      if (!contenido) throw new Error('El proveedor devolvió contenido vacío.')
      return { contenido, ajuste, uso: data.usage ?? null }
    }

    ultimoError = `HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`
    if (res.status !== 400) break
  }

  throw new Error(`No se pudo obtener respuesta. ${ultimoError}`)
}

async function main() {
  const args = parsearArgs(process.argv.slice(2))
  const prov = PROVEEDORES[args.proveedor]

  if (!prov) {
    console.error(`Proveedor desconocido: ${args.proveedor}. Opciones: ${Object.keys(PROVEEDORES).join(', ')}`)
    process.exitCode = 1
    return
  }

  const apiKey = process.env[prov.envKey]
  if (!apiKey) {
    console.error(`Falta ${prov.envKey} en el entorno.`)
    console.error('')
    console.error('El corpus está completo y corre sin red (los contratos lo verifican),')
    console.error('pero medir adherencia exige llamar al proveedor. Cargá la credencial')
    console.error(`como variable de entorno y volvé a correr:`)
    console.error(``)
    console.error(`  ${prov.envKey}=... node scripts/evaluacion-proveedor/correr.mjs --proveedor ${args.proveedor}`)
    process.exitCode = 2
    return
  }

  // Se importa acá y no arriba porque el archivo es TypeScript de producción:
  // se lee como texto y se extrae la constante, para no arrastrar el bundler.
  const politica = fs.readFileSync('netlify/functions/_analisis_policy.ts', 'utf8')
  const m = /export const SYSTEM_ADMIN = `([\s\S]*?)`\s*$/m.exec(politica)
  if (!m) throw new Error('No se pudo extraer SYSTEM_ADMIN de _analisis_policy.ts')
  const reglas = /const REGLAS_OPERATIVAS = `([\s\S]*?)`\n/m.exec(politica)
  const identidad = /export const IDENTIDAD_REGLA = '([\s\S]*?)'\n/m.exec(politica)
  const sistema = m[1]
    .replace('${REGLAS_OPERATIVAS}', reglas ? reglas[1] : '')
    .replace('${IDENTIDAD_REGLA}', identidad ? identidad[1] : '')

  const casos = args.escenario ? CORPUS.filter((c) => c.id === args.escenario) : CORPUS
  if (casos.length === 0) {
    console.error(`No hay escenario con id "${args.escenario}".`)
    process.exitCode = 1
    return
  }

  console.log(`Proveedor: ${args.proveedor} · modelo ${prov.modelo} · jurisdicción ${prov.jurisdiccion}`)
  console.log(`Escenarios: ${casos.length} · repeticiones: ${args.repeticiones}`)
  console.log('')

  const corridas = []
  for (const caso of casos) {
    for (let rep = 1; rep <= args.repeticiones; rep += 1) {
      const etiqueta = args.repeticiones > 1 ? `${caso.id} (${rep}/${args.repeticiones})` : caso.id
      try {
        const { contenido, ajuste, uso } = await pedirAnalisis(prov, apiKey, sistema, caso.datos)
        const evaluacion = evaluarRespuesta(contenido, caso.verdad)
        corridas.push({ escenario: caso.id, repeticion: rep, respuesta: contenido, ajuste, uso, ...evaluacion })

        const marca = evaluacion.obligatoriosOk ? '✓' : '✗'
        const detalle = evaluacion.fallas.length
          ? ` — ${evaluacion.fallas.map((f) => f.id).join(', ')}`
          : ''
        console.log(`${marca} ${etiqueta}${detalle}`)
        for (const f of evaluacion.fallas) console.log(`    [${f.nivel}] ${f.detalle}`)
        if (ajuste) console.log(`    (parámetros ajustados: ${ajuste} — NO son los de producción)`)
      } catch (error) {
        corridas.push({ escenario: caso.id, repeticion: rep, error: String(error) })
        console.log(`! ${etiqueta} — ${error instanceof Error ? error.message : error}`)
      }
    }
  }

  const conRespuesta = corridas.filter((c) => !c.error)
  const obligatoriosOk = conRespuesta.filter((c) => c.obligatoriosOk).length
  const porGuardrail = GUARDRAILS.map((g) => {
    const evaluadas = conRespuesta.filter((c) => c.resultados.some((r) => r.id === g.id))
    const fallas = evaluadas.filter((c) => c.resultados.find((r) => r.id === g.id && !r.ok)).length
    return { id: g.id, nivel: g.nivel, corridas: evaluadas.length, fallas }
  })

  console.log('')
  console.log('─'.repeat(70))
  console.log(`Corridas con respuesta: ${conRespuesta.length}/${corridas.length}`)
  console.log(`Obligatorios en verde:  ${obligatoriosOk}/${conRespuesta.length}`)
  console.log('')
  console.log('Por guardarraíl:')
  for (const g of porGuardrail) {
    const estado = g.fallas === 0 ? 'ok' : `${g.fallas} falla(s)`
    console.log(`  [${g.nivel === 'obligatorio' ? 'OBL' : 'com'}] ${g.id.padEnd(34)} ${estado}`)
  }

  const informe = {
    proveedor: args.proveedor,
    modelo: prov.modelo,
    jurisdiccion: prov.jurisdiccion,
    generado_en: new Date().toISOString(),
    repeticiones: args.repeticiones,
    resumen: { corridas: corridas.length, conRespuesta: conRespuesta.length, obligatoriosOk },
    porGuardrail,
    corridas,
  }

  if (args.salida) {
    fs.writeFileSync(args.salida, `${JSON.stringify(informe, null, 2)}\n`)
    console.log('')
    console.log(`Informe completo en ${args.salida}`)
  }

  process.exitCode = obligatoriosOk === conRespuesta.length && conRespuesta.length === corridas.length ? 0 : 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
