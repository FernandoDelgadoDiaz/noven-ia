// Cuota por actor contra Postgres real, en el Supabase local descartable.
//
// El contrato de `scripts/tests/cuota-analisis-contract.test.mjs` prueba la capa
// TypeScript con un cliente falso. Lo que NO puede probar es lo que importa acá:
// que el incremento sea realmente atómico. Un contador que lee y después escribe
// pasa cualquier prueba secuencial y se rompe bajo concurrencia, que es
// exactamente la condición que un bucle de abuso produce.
//
// Por eso este archivo corre contra la base real y dispara llamadas en paralelo.

import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { requireDisposableLocalEnvironment } from './gates-1-3.mjs'

const ENDPOINT_PRUEBA = 'prueba_cuota'

async function consumir(environment, { actor, limiteHora, limiteDia }) {
  const res = await fetch(`${environment.apiUrl}/rest/v1/rpc/consumir_cuota_actor_v1`, {
    method: 'POST',
    headers: {
      apikey: environment.serviceRoleKey,
      Authorization: `Bearer ${environment.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_actor_id: actor,
      p_endpoint: ENDPOINT_PRUEBA,
      p_limite_hora: limiteHora,
      p_limite_dia: limiteDia,
    }),
  })

  if (!res.ok) {
    const detalle = await res.text()
    assert.fail(`consumir_cuota_actor_v1 respondió ${res.status}: ${detalle}`)
  }
  const filas = await res.json()
  const fila = Array.isArray(filas) ? filas[0] : filas
  assert.ok(fila, 'la RPC debe devolver una fila')
  return fila
}

function actorNuevo(sufijo) {
  return `00000000-0000-4000-8000-${String(sufijo).padStart(12, '0')}`
}

export async function verificarCuota(env = process.env) {
  const environment = requireDisposableLocalEnvironment(env)

  // 1. Dentro del límite, pasa. Pasado el límite, corta.
  {
    const actor = actorNuevo(1)
    const limite = 5
    const resultados = []
    for (let i = 0; i < limite + 3; i += 1) {
      resultados.push(await consumir(environment, { actor, limiteHora: limite, limiteDia: 1000 }))
    }

    const permitidos = resultados.filter((r) => r.permitido).length
    assert.equal(permitidos, limite,
      `debían pasar exactamente ${limite} solicitudes, pasaron ${permitidos}`)
    assert.equal(resultados[limite].motivo, 'limite_hora',
      'la primera denegada debe declarar el motivo')
    assert.equal(resultados.at(-1).permitido, false,
      'el abuso repetido sigue cortado, no se reabre solo')
  }

  // 2. Atomicidad: 40 llamadas en paralelo contra un límite de 10.
  //    Con SELECT seguido de UPDATE varias verían el mismo valor y pasarían de
  //    largo. Con incremento condicional en una sentencia, pasan exactamente 10.
  {
    const actor = actorNuevo(2)
    const limite = 10
    const concurrentes = 40
    const resultados = await Promise.all(
      Array.from({ length: concurrentes }, () =>
        consumir(environment, { actor, limiteHora: limite, limiteDia: 1000 })),
    )

    const permitidos = resultados.filter((r) => r.permitido).length
    assert.equal(permitidos, limite,
      `bajo ${concurrentes} llamadas concurrentes debían pasar exactamente ${limite}, `
      + `pasaron ${permitidos}. Un contador no atómico deja pasar de más.`)

    const consumos = resultados.map((r) => r.consumo_hora).sort((a, b) => a - b)
    assert.deepEqual(consumos, Array.from({ length: concurrentes }, (_, i) => i + 1),
      'cada llamada concurrente debe recibir un valor distinto y consecutivo: '
      + 'valores repetidos son la firma de una carrera')
  }

  // 3. La cuota es por actor: un abusivo no bloquea al resto.
  {
    const abusivo = actorNuevo(3)
    const legitimo = actorNuevo(4)
    for (let i = 0; i < 6; i += 1) {
      await consumir(environment, { actor: abusivo, limiteHora: 3, limiteDia: 1000 })
    }
    const bloqueado = await consumir(environment, { actor: abusivo, limiteHora: 3, limiteDia: 1000 })
    assert.equal(bloqueado.permitido, false, 'el actor abusivo queda bloqueado')

    const otro = await consumir(environment, { actor: legitimo, limiteHora: 3, limiteDia: 1000 })
    assert.equal(otro.permitido, true,
      'otro usuario de la misma sucursal no se ve afectado: la cuota es por actor, no por IP')
  }

  // 4. El límite diario corta aunque el horario tenga margen.
  {
    const actor = actorNuevo(5)
    const resultados = []
    for (let i = 0; i < 4; i += 1) {
      resultados.push(await consumir(environment, { actor, limiteHora: 1000, limiteDia: 3 }))
    }
    assert.equal(resultados.filter((r) => r.permitido).length, 3)
    assert.equal(resultados.at(-1).motivo, 'limite_dia')
  }

  console.log('✓ Cuota por actor: límite exacto bajo concurrencia, aislada por actor, ventana diaria activa')
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isCli) {
  verificarCuota().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
