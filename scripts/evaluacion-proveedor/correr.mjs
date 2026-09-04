// Corre el corpus contra el proveedor de producción y mide adherencia.
//
// Uso:
//   node scripts/evaluacion-proveedor/correr.mjs --preflight
//   node scripts/evaluacion-proveedor/correr.mjs
//   node scripts/evaluacion-proveedor/correr.mjs --repeticiones 3 --salida informe.json
//   node scripts/evaluacion-proveedor/correr.mjs --escenario sin-base-comparable
//
// LA CONFIGURACIÓN NO SE DECLARA ACÁ
//
// Endpoint, modelo, credencial y parámetros salen de
// `netlify/functions/analisis.ts` (ver `proveedor.mjs`). Una evaluación con
// configuración propia mide un sistema que nadie despliega, y falla en
// silencio: da verde mientras producción corre otro modelo.
//
// SOBRE LA VARIANZA
//
// `temperature` es 0.2, no 0: la respuesta no es determinista aunque el corpus
// sí lo sea. Un guardarraíl que falla una vez de tres es un guardarraíl que
// falla, así que para decidir un proveedor hay que correr con `--repeticiones`.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { CORPUS } from './corpus.mjs'
import { evaluarRespuesta, GUARDRAILS } from './guardrails.mjs'
import { configuracionDeProduccion, systemPromptDeProduccion } from './proveedor.mjs'

function parsearArgs(argv) {
  const out = { repeticiones: 1, salida: null, escenario: null, preflight: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--repeticiones') out.repeticiones = Number(argv[++i])
    else if (a === '--salida' || a === '--output') out.salida = argv[++i]
    else if (a === '--escenario') out.escenario = argv[++i]
    else if (a === '--preflight') out.preflight = true
  }
  return out
}

function faltaCredencial(envKey) {
  console.error(`Falta ${envKey} en el entorno.`)
  console.error('')
  console.error('El corpus está completo y sus contratos corren sin red, pero medir')
  console.error('adherencia exige llamar al proveedor. Cargá la credencial como secreto')
  console.error('de GitHub Actions y como variable en Netlify, o exportala para correr local:')
  console.error('')
  console.error(`  ${envKey}=... node scripts/evaluacion-proveedor/correr.mjs`)
}

async function pedirAnalisis(cfg, apiKey, sistema, usuario) {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: cfg.modelo,
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
      ...cfg.extras,
    }),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`)
  }

  const data = await res.json()
  const contenido = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (!contenido) throw new Error('El proveedor devolvió contenido vacío.')
  return { contenido, uso: data.usage ?? null }
}

/**
 * Comprueba que la credencial sirve y que el modelo declarado existe, con una
 * llamada mínima. Sirve para separar "el proveedor no responde" de "el modelo
 * no adhiere", que es la diferencia entre un problema de despliegue y uno de
 * calidad.
 */
async function listarModelos(cfg, apiKey) {
  const base = new URL(cfg.url)
  base.pathname = '/v1/models'
  const res = await fetch(base, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!res.ok) return { ok: false, detalle: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` }
  const data = await res.json()
  const ids = (data.data ?? []).map((m) => m.id).filter(Boolean).sort()
  return { ok: true, ids }
}

async function preflight(cfg, apiKey) {
  console.log(`Preflight · ${cfg.url}`)
  console.log(`Modelo: ${cfg.modelo}`)
  console.log(`Parámetros: ${JSON.stringify(cfg.extras)}`)
  console.log('')

  // Se consulta la lista real de modelos de la cuenta ANTES de la llamada
  // mínima. Un modelo inexistente y un modelo que existe pero rechaza los
  // parámetros dan errores parecidos, y confundirlos hace perder una ronda:
  // uno se arregla eligiendo otro nombre, el otro cambiando la llamada.
  //
  // Si la cuenta no permite listar, se sigue igual: la lista es diagnóstico,
  // no un permiso adicional que la evaluación deba exigir.
  const modelos = await listarModelos(cfg, apiKey)
  if (!modelos.ok) {
    console.log(`· No se pudo listar modelos (${modelos.detalle}). Se continúa con la llamada mínima.`)
  } else if (!modelos.ids.includes(cfg.modelo)) {
    console.error(`✗ El modelo "${cfg.modelo}" no está en la lista de la cuenta.`)
    console.error(`  Modelos disponibles (${modelos.ids.length}):`)
    for (const id of modelos.ids) console.error(`    ${id}`)
    return false
  } else {
    console.log(`✓ El modelo "${cfg.modelo}" figura entre los ${modelos.ids.length} de la cuenta.`)
  }

  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: cfg.modelo,
      messages: [{ role: 'user', content: 'Respondé únicamente: ok' }],
      ...cfg.extras,
    }),
  })

  if (!res.ok) {
    const detalle = (await res.text()).slice(0, 600)
    console.error(`✗ El proveedor rechazó la llamada: HTTP ${res.status}`)
    console.error(detalle)
    return false
  }

  const data = await res.json()
  const contenido = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (!contenido) {
    console.error('✗ El proveedor respondió 200 con contenido vacío.')
    return false
  }

  console.log(`✓ Credencial y modelo verificados (respuesta: ${JSON.stringify(contenido.slice(0, 40))})`)
  return true
}

async function main() {
  const args = parsearArgs(process.argv.slice(2))
  const cfg = configuracionDeProduccion()

  const apiKey = process.env[cfg.envKey]
  if (!apiKey) {
    faltaCredencial(cfg.envKey)
    process.exitCode = 2
    return
  }

  if (args.preflight) {
    process.exitCode = (await preflight(cfg, apiKey)) ? 0 : 1
    return
  }

  const sistema = systemPromptDeProduccion()
  const casos = args.escenario ? CORPUS.filter((c) => c.id === args.escenario) : CORPUS
  if (casos.length === 0) {
    console.error(`No hay escenario con id "${args.escenario}".`)
    process.exitCode = 1
    return
  }

  console.log(`Proveedor: ${cfg.url}`)
  console.log(`Modelo: ${cfg.modelo} · parámetros ${JSON.stringify(cfg.extras)}`)
  console.log(`Escenarios: ${casos.length} · repeticiones: ${args.repeticiones}`)
  console.log('')

  const corridas = []
  for (const caso of casos) {
    for (let rep = 1; rep <= args.repeticiones; rep += 1) {
      const etiqueta = args.repeticiones > 1 ? `${caso.id} (${rep}/${args.repeticiones})` : caso.id
      try {
        const { contenido, uso } = await pedirAnalisis(cfg, apiKey, sistema, caso.datos)
        const evaluacion = evaluarRespuesta(contenido, caso.verdad)
        corridas.push({ escenario: caso.id, repeticion: rep, respuesta: contenido, uso, ...evaluacion })

        const marca = evaluacion.obligatoriosOk ? '✓' : '✗'
        const detalle = evaluacion.fallas.length ? ` — ${evaluacion.fallas.map((f) => f.id).join(', ')}` : ''
        console.log(`${marca} ${etiqueta}${detalle}`)
        for (const f of evaluacion.fallas) console.log(`    [${f.nivel}] ${f.detalle}`)
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
    console.log(`  [${g.nivel === 'obligatorio' ? 'OBL' : 'com'}] ${g.id.padEnd(34)} ${g.fallas === 0 ? 'ok' : `${g.fallas} falla(s)`}`)
  }

  const informe = {
    url: cfg.url,
    modelo: cfg.modelo,
    parametros: cfg.extras,
    generado_en: new Date().toISOString(),
    repeticiones: args.repeticiones,
    resumen: { corridas: corridas.length, conRespuesta: conRespuesta.length, obligatoriosOk },
    porGuardrail,
    corridas,
  }

  if (args.salida) {
    fs.mkdirSync(path.dirname(path.resolve(args.salida)), { recursive: true })
    fs.writeFileSync(args.salida, `${JSON.stringify(informe, null, 2)}\n`)
    console.log('')
    console.log(`Informe completo en ${args.salida}`)
  }

  const todoVerde = conRespuesta.length === corridas.length && obligatoriosOk === conRespuesta.length
  process.exitCode = todoVerde ? 0 : 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
