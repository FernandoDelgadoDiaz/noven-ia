// Contrato de la cuota por actor y el caché del análisis.
//
// `analisis.ts` es el único endpoint donde un usuario autenticado puede generar
// costo ilimitado en un proveedor externo y enviarle datos operativos. Este
// contrato prueba las tres cosas que tienen que ser ciertas: el abuso repetido
// se corta, el uso normal no se afecta, y un contador caído CIERRA.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

async function importarTs(relativePath) {
  const js = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
}

const { CUOTA_ANALISIS, consumirCuota, mensajeCuota } = await importarTs('netlify/functions/_lib/cuota.ts')

// --- Política ---------------------------------------------------------------
assert.equal(CUOTA_ANALISIS.endpoint, 'analisis')
assert.equal(CUOTA_ANALISIS.limiteHora, 10)
assert.equal(CUOTA_ANALISIS.limiteDia, 20)
assert.equal(CUOTA_ANALISIS.anteFalla, 'cerrado',
  'analisis debe fallar cerrado: fallar abierto es costo ilimitado en un tercero')

function clienteFalso(respuesta) {
  const llamadas = []
  return {
    llamadas,
    rpc(nombre, params) {
      llamadas.push({ nombre, params })
      return Promise.resolve(respuesta)
    },
  }
}

// --- Uso normal no se afecta ------------------------------------------------
{
  const cliente = clienteFalso({ data: [{ permitido: true, motivo: 'ok', consumo_hora: 3, consumo_dia: 7 }], error: null })
  const r = await consumirCuota(cliente, CUOTA_ANALISIS, 'actor-1')
  assert.equal(r.permitido, true, 'dentro de la cuota la solicitud pasa')
  assert.equal(r.consumoHora, 3)
  assert.equal(r.consumoDia, 7)

  const [llamada] = cliente.llamadas
  assert.equal(llamada.nombre, 'consumir_cuota_actor_v1')
  assert.deepEqual(llamada.params, {
    p_actor_id: 'actor-1',
    p_endpoint: 'analisis',
    p_limite_hora: 10,
    p_limite_dia: 20,
  }, 'el actor es el uid, no la IP')
}

// --- El abuso repetido se corta ---------------------------------------------
for (const motivo of ['limite_hora', 'limite_dia']) {
  const cliente = clienteFalso({ data: [{ permitido: false, motivo, consumo_hora: 11, consumo_dia: 21 }], error: null })
  const r = await consumirCuota(cliente, CUOTA_ANALISIS, 'actor-1')
  assert.equal(r.permitido, false, `${motivo}: pasado el límite se deniega`)
  assert.equal(r.motivo, motivo)
  assert.match(mensajeCuota(r), /máximo de análisis por (hora|día)/)
}

// --- El contador caído CIERRA -----------------------------------------------
for (const respuesta of [
  { data: null, error: { message: 'connection refused' } },
  { data: null, error: null },
  { data: [], error: null },
]) {
  const r = await consumirCuota(clienteFalso(respuesta), CUOTA_ANALISIS, 'actor-1')
  assert.equal(r.permitido, false,
    'con el contador no disponible la llamada al proveedor NO sale')
  assert.equal(r.motivo, 'contador_no_disponible')
  assert.match(mensajeCuota(r), /No se pudo verificar el límite/)
}

// Un endpoint operativo declara el criterio inverso y el mecanismo lo respeta.
{
  const operativo = { endpoint: 'scanner', limiteHora: 600, limiteDia: 5000, anteFalla: 'abierto' }
  const r = await consumirCuota(clienteFalso({ data: null, error: { message: 'caido' } }), operativo, 'actor-1')
  assert.equal(r.permitido, true,
    'un endpoint operativo no debe romper la sucursal por un contador caído')
}

// --- Orden de las operaciones en analisis.ts --------------------------------
const server = read('netlify/functions/analisis.ts')
const posCuota = server.indexOf('await consumirCuota(')
const posConsultas = server.indexOf("from('usuarios')")
const posProveedor = server.indexOf('api.deepseek.com')
const posCacheLookup = server.indexOf("from('analisis_cache')")

assert.ok(posCuota > 0, 'analisis.ts debe consumir cuota')
assert.ok(posCuota < posConsultas,
  'la cuota se consume antes de las consultas que arman los datos')
assert.ok(posCuota < posProveedor,
  'la cuota se consume antes de llamar al proveedor')
assert.ok(posCacheLookup > 0 && posCacheLookup < posProveedor,
  'el caché se consulta antes de llamar al proveedor')
assert.match(server, /statusCode: cuota\.motivo === 'contador_no_disponible' \? 503 : 429/,
  'límite alcanzado responde 429; contador caído responde 503')

// La clave del caché es el hash de la entrada autorizada exacta.
assert.match(
  server,
  /createHash\('sha256'\)\.update\(`\$\{SYSTEM_ADMIN\}\\n\$\{datosFormateados\}`\)/,
  'la clave debe cubrir system prompt + datos autorizados, no sólo la sucursal',
)

// --- La RPC es atómica ------------------------------------------------------
const migracion = read('supabase/migrations/20260902170000_cuota_por_actor_y_cache_analisis_v1.sql')
const rpc = migracion.slice(
  migracion.indexOf('CREATE OR REPLACE FUNCTION public.consumir_cuota_actor_v1'),
  migracion.indexOf('REVOKE ALL ON FUNCTION public.consumir_cuota_actor_v1'),
)

assert.equal(
  [...rpc.matchAll(/ON CONFLICT \(actor_id, endpoint, ventana, ventana_inicio\)\s*\n\s*DO UPDATE SET consumo = r\.consumo \+ 1/g)].length,
  2,
  'las dos ventanas se incrementan con INSERT ... ON CONFLICT DO UPDATE, en una sola sentencia cada una',
)
assert.doesNotMatch(rpc, /SELECT[\s\S]*?INTO[\s\S]*?FROM public\.rate_limit_consumo/i,
  'no debe leer el contador para después escribirlo: esa carrera es lo que un bucle explota')

const ordenHora = rpc.indexOf("'hora', v_inicio_hora")
const ordenDia = rpc.indexOf("'dia', v_inicio_dia")
assert.ok(ordenHora > 0 && ordenDia > ordenHora,
  'las dos filas se toman siempre en el mismo orden: invertirlo deadlockea')

assert.match(rpc, /IF v_hora > p_limite_hora THEN/,
  'se decide sobre el valor devuelto por el incremento, no antes de incrementar')

// --- Las tablas son server-only ---------------------------------------------
for (const tabla of ['rate_limit_consumo', 'analisis_cache']) {
  assert.match(migracion, new RegExp(`ALTER TABLE public\\.${tabla} ENABLE ROW LEVEL SECURITY`),
    `${tabla}: RLS activo`)
  assert.match(
    migracion,
    new RegExp(`REVOKE ALL PRIVILEGES ON TABLE public\\.${tabla} FROM PUBLIC, anon, authenticated`),
    `${tabla}: el browser no la ve ni la toca`,
  )
  assert.doesNotMatch(migracion, new RegExp(`CREATE POLICY[^;]+ON public\\.${tabla}`),
    `${tabla}: server-only, sin policies para el browser`)
}
for (const fn of ['consumir_cuota_actor_v1', 'purgar_cuota_y_cache_v1']) {
  assert.match(migracion, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\)\\s*\\n\\s*FROM PUBLIC, anon, authenticated`),
    `${fn}: no ejecutable desde el browser`)
  // El default de Postgres es EXECUTE a PUBLIC: sin el GRANT explícito, revocar
  // deja a service_role sin permiso y la cuota falla cerrada para siempre.
  assert.match(migracion, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\)\\s*\\n\\s*TO service_role`),
    `${fn}: service_role debe conservar EXECUTE explícitamente`)
}

console.log('✓ Cuota por actor: abuso cortado, uso normal intacto, contador caído cierra')
