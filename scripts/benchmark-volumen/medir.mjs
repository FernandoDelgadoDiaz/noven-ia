// Medición del ítem 3.3 · benchmark de performance con volumen realista.
//
// EL ERROR QUE INVALIDA CASI TODO BENCHMARK DE SUPABASE es medir como
// `postgres`. Con superusuario RLS no se aplica, y la consulta que se mide NO
// es la que corre en producción: le falta todo el predicado de
// `noven_private.tiene_acceso_*`. Por eso este script imprime `current_user` y
// `row_security` en cada corrida y ABORTA si no está midiendo como
// `authenticated` con RLS activa. Un resultado obtenido de otra forma no vale.
//
// NO CORRE CONTRA PRODUCCIÓN. Exige `NOVEN_EPHEMERAL_REPLAY=1` y una URL de
// base local, igual que el replay.
//
// CADA CONSULTA SE MIDE N VECES y se reporta la MEDIANA, no el promedio: una
// sola corrida lenta por un checkpoint no debe mover el veredicto. La primera
// corrida se descarta porque llena caché — sin eso se estaría midiendo el
// estado de la caché y no el plan.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { consultas } from './consultas.mjs'
import { SUCURSAL_MEDIDA, ORG_MEDIDA, USUARIO_MEDIDO } from './dataset.mjs'

const CORRIDAS = Number(process.env.NOVEN_BENCH_CORRIDAS ?? 7)
const DESCARTADAS = 1

function exigirEntornoDescartable(url) {
  if (process.env.NOVEN_EPHEMERAL_REPLAY !== '1') {
    throw new Error(
      'Este benchmark siembra cientos de miles de filas. Sólo corre en un ' +
        'entorno explícitamente descartable: NOVEN_EPHEMERAL_REPLAY=1.',
    )
  }
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url) || url.startsWith('postgresql:///')
  if (!local) {
    throw new Error(`La URL no es local y por lo tanto no es descartable: ${url.replace(/:[^:@]*@/, ':***@')}`)
  }
}

function psql(url, sql, { tuplesOnly = true } = {}) {
  const args = ['-v', 'ON_ERROR_STOP=1', '-X', '-q']
  if (tuplesOnly) args.push('-tA')
  return execFileSync('psql', [...args, url], { input: sql, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
}

/** PostgREST manda los valores dentro del texto de la consulta, así que inlinear
 *  literales es MÁS fiel que usar PREPARE, que forzaría un plan genérico. */
function inlinar(sql, params) {
  return sql.replace(/\$(\d+)/g, (_, n) => {
    const v = params[Number(n) - 1]
    if (v === undefined) throw new Error(`Falta el parámetro $${n}`)
    return `'${String(v).replace(/'/g, "''")}'`
  })
}

/** Prólogo que asume la identidad del usuario medido. Sin esto, RLS no aplica. */
const PROLOGO = `
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"${USUARIO_MEDIDO}","role":"authenticated"}', false);
`

function verificarIdentidad(url) {
  const salida = psql(
    url,
    `${PROLOGO}
     SELECT current_user || '|' || current_setting('row_security') || '|' ||
            coalesce((SELECT auth.uid()::text), 'NULL');`,
  )
  const linea = salida.trim().split('\n').filter(Boolean).pop() ?? ''
  const [usuario, rls, uid] = linea.split('|')
  const guardia = { current_user: usuario, row_security: rls, auth_uid: uid }

  if (usuario !== 'authenticated') {
    throw new Error(
      `Se está midiendo como "${usuario}", no como "authenticated". ` +
        'Todo resultado obtenido así se descarta: sin RLS la consulta medida no ' +
        'es la que corre en producción.',
    )
  }
  if (rls !== 'on') {
    throw new Error(`row_security = "${rls}". La medición sólo vale con RLS activa.`)
  }
  if (uid !== USUARIO_MEDIDO) {
    throw new Error(`auth.uid() devolvió "${uid}" y se esperaba "${USUARIO_MEDIDO}".`)
  }
  return guardia
}

const mediana = (xs) => {
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

function medirUna(url, consulta) {
  const sql = inlinar(consulta.sql, consulta.params)
  const corridas = []
  let planMediano = null

  for (let i = 0; i < CORRIDAS; i++) {
    const salida = psql(url, `${PROLOGO}\nEXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)\n${sql};`)
    const json = salida.slice(salida.indexOf('['))
    const plan = JSON.parse(json)[0]
    corridas.push({ ms: plan['Execution Time'], plan })
  }

  const utiles = corridas.slice(DESCARTADAS)
  const tiempos = utiles.map((c) => c.ms)
  const med = mediana(tiempos)
  planMediano = utiles.reduce((a, b) => (Math.abs(b.ms - med) < Math.abs(a.ms - med) ? b : a)).plan

  return {
    id: consulta.id,
    titulo: consulta.titulo,
    porQue: consulta.porQue,
    sql: sql.trim(),
    corridas: CORRIDAS,
    descartadas: DESCARTADAS,
    ms: { mediana: med, min: Math.min(...tiempos), max: Math.max(...tiempos), todas: tiempos },
    plan: planMediano,
  }
}

/** Índices existentes y su uso acumulado. Es la evidencia para proponer retiros. */
function inventarioIndices(url) {
  const sql = `
    RESET ROLE;
    SELECT s.relname || '|' || s.indexrelname || '|' || s.idx_scan || '|' ||
           pg_relation_size(s.indexrelid) || '|' ||
           replace(pg_get_indexdef(s.indexrelid), '|', '/')
    FROM pg_stat_user_indexes s
    JOIN pg_class t ON t.oid = s.relid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY s.relname, s.indexrelname;`
  return psql(url, sql)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [tabla, indice, scans, bytes, definicion] = l.split('|')
      return { tabla, indice, scans: Number(scans), bytes: Number(bytes), definicion }
    })
}

/** Nombres de índice que aparecen en un árbol de plan. */
function indicesDelPlan(nodo, acc = new Set()) {
  if (nodo['Index Name']) acc.add(nodo['Index Name'])
  for (const hijo of nodo.Plans ?? []) indicesDelPlan(hijo, acc)
  return acc
}

/**
 * Cruza el inventario de índices contra los índices que aparecen en los planes
 * medidos. Los tres casos NO significan lo mismo y confundirlos llevaría a
 * retirar un índice que hace falta:
 *
 * - `en_plan`: el planificador lo eligió en algún camino medido. Se queda.
 * - `contador_sin_plan`: tiene accesos pero no aparece en ningún plan. Eso NO
 *   es evidencia contra el índice, es información sobre la medición. Hay dos
 *   causas posibles y hay que distinguirlas antes de concluir nada: o lo usa un
 *   camino que el benchmark no mide, o lo usa el cuerpo de una función
 *   `SECURITY DEFINER` —las políticas RLS llaman a `tiene_acceso_*`— y el plan
 *   interno de esa función NO aparece en el EXPLAIN de la consulta externa.
 * - `sin_uso`: ni contador ni plan. Es el único caso limpio para proponer
 *   retiro, y aun así hay que mostrar el costo de escritura que se recupera.
 */
function correlacionar(indices, resultados) {
  const enPlanes = new Set()
  for (const r of resultados) for (const n of indicesDelPlan(r.plan.Plan)) enPlanes.add(n)

  const porCamino = {}
  for (const r of resultados) porCamino[r.id] = [...indicesDelPlan(r.plan.Plan)].sort()

  return {
    indices_por_camino: porCamino,
    inventario: indices.map((i) => ({
      ...i,
      en_plan: enPlanes.has(i.indice),
      clase: enPlanes.has(i.indice) ? 'en_plan' : i.scans > 0 ? 'contador_sin_plan' : 'sin_uso',
    })),
  }
}

/**
 * Verifica que el usuario medido REALMENTE VE FILAS. Sin esta guardia, un
 * usuario mal sembrado —un rol que viola un check, un acceso inactivo— deja
 * todas las consultas devolviendo cero filas, y el benchmark reporta tiempos
 * excelentes de no hacer nada. Es el modo de fallo más traicionero que tiene
 * esta clase de medición: no da error, da números buenos.
 */
function verificarQueVeDatos(url) {
  const salida = psql(
    url,
    `${PROLOGO}
     SELECT (SELECT count(*) FROM public.vencimientos WHERE sucursal_id = '${SUCURSAL_MEDIDA}')::text
       || '|' || (SELECT count(*) FROM public.producto_sucursal WHERE sucursal_id = '${SUCURSAL_MEDIDA}')::text;`,
  )
  const linea = salida.trim().split('\n').filter(Boolean).pop() ?? ''
  const [venc, ps] = linea.split('|').map(Number)
  if (!(venc > 0) || !(ps > 0)) {
    throw new Error(
      `El usuario medido ve ${venc} vencimientos y ${ps} filas de producto_sucursal ` +
        'en su sucursal. Con cero filas visibles el benchmark mediría el costo de no ' +
        'devolver nada y reportaría tiempos excelentes. Se aborta: revisar la siembra ' +
        'del usuario y de usuario_accesos.',
    )
  }
  return { vencimientos_visibles: venc, producto_sucursal_visibles: ps }
}

export function medir({ url, escala }) {
  exigirEntornoDescartable(url)
  const guardia = verificarIdentidad(url)
  const visibilidad = verificarQueVeDatos(url)

  // Los contadores arrancan de cero para que `idx_scan` cuente sólo lo que
  // hicieron los caminos medidos. Sin esto, un índice parecería usado por la
  // siembra y no por la aplicación.
  psql(url, `RESET ROLE; SELECT pg_stat_reset();`)

  const ctx = { sucursal: SUCURSAL_MEDIDA, organizacion: ORG_MEDIDA }
  const resultados = consultas(ctx).map((c) => medirUna(url, c))

  return {
    version: 1,
    escala,
    generado_at: new Date().toISOString(),
    guardia,
    visibilidad,
    contexto: ctx,
    postgres: psql(url, 'RESET ROLE; SELECT version();').trim(),
    resultados,
    ...correlacionar(inventarioIndices(url), resultados),
  }
}

if (process.argv[1] && process.argv[1].endsWith('medir.mjs')) {
  const url = process.env.NOVEN_REPLAY_DB_URL
  if (!url) throw new Error('Falta NOVEN_REPLAY_DB_URL')
  const argEscala = process.argv.find((a) => a.startsWith('--escala='))
  const argSalida = process.argv.find((a) => a.startsWith('--salida='))
  const escala = argEscala ? Number(argEscala.split('=')[1]) : 1
  const informe = medir({ url, escala })
  const json = `${JSON.stringify(informe, null, 2)}\n`
  if (argSalida) fs.writeFileSync(argSalida.split('=')[1], json, 'utf8')
  else process.stdout.write(json)
  process.stderr.write(
    `escala ${escala}× · ${informe.resultados.length} caminos · ` +
      `identidad ${informe.guardia.current_user} · RLS ${informe.guardia.row_security}\n`,
  )
}
