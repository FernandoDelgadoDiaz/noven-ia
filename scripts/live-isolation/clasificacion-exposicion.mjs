// Verifica la clasificación por exposición contra el catálogo real.
//
// Corre en CI sobre el Supabase descartable que el replay reconstruye, así que
// evalúa el resultado ACUMULADO de todas las migraciones, no el texto de
// ninguna. Un grant es un hecho del catálogo: leerlo del SQL es adivinar.
//
// Falla si:
//   - aparece una tabla en `public` que no está clasificada  ← el caso que
//     motivó el ítem: una tabla nueva entra sin que nadie decida su exposición;
//   - la clasificación nombra una tabla que ya no existe;
//   - los grants reales de `authenticated` no son EXACTAMENTE los de su clase;
//   - una política de `authenticated` no acota como su clase exige — esto
//     incluye `USING(true)`, que es el ítem 2.4 subsumido acá;
//   - `anon` tiene un solo grant en `public`.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import {
  ACOTAMIENTOS, ANON_SIN_GRANTS, CLASES, CLASES_VISTA,
  CLASIFICACION, CLASIFICACION_VISTAS, VISTAS_EXIGEN_SECURITY_INVOKER,
} from './clasificacion-tablas.mjs'

function consultar(databaseUrl, sql) {
  const res = spawnSync('psql', [databaseUrl, '--no-psqlrc', '-At', '-c', sql], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (res.status !== 0) {
    throw new Error(`psql falló (${res.status}): ${res.stderr?.slice(0, 800)}`)
  }
  return res.stdout.trim() ? JSON.parse(res.stdout.trim()) : []
}

function requerirEntornoDescartable(env = process.env) {
  assert.equal(env.NOVEN_EPHEMERAL_REPLAY, '1',
    'esta verificación corre sólo contra el Supabase descartable del replay')

  const url = env.NOVEN_REPLAY_DB_URL
  assert.ok(url, 'falta NOVEN_REPLAY_DB_URL: se exporta desde supabase-local.env en CI')
  assert.ok(/@(127\.0\.0\.1|localhost)[:/]/.test(url),
    `me niego a inspeccionar una base que no es local: ${url.replace(/:[^:@]*@/, ':***@')}`)
  return url
}

function fallar(mensajes) {
  console.error('')
  console.error('─'.repeat(72))
  for (const m of mensajes) console.error(`  ✗ ${m}`)
  console.error('─'.repeat(72))
  process.exitCode = 1
}

/**
 * Compara el catálogo leído contra la clasificación declarada.
 *
 * Es una función pura sobre datos ya consultados, y eso es deliberado: permite
 * probarla con catálogos armados a mano —una tabla sin clasificar, una política
 * permisiva, un grant de más— sin levantar Postgres. Un verificador que sólo se
 * ejerce contra la base real se prueba únicamente cuando ya es tarde.
 */
export function verificar({ tablas, grants, politicas, vistas = [] }) {
  const errores = []
  const nombres = tablas.map((t) => t.tabla)

  // --- Toda tabla tiene clase, y toda clase tiene tabla --------------------

  for (const tabla of nombres) {
    if (!CLASIFICACION[tabla]) {
      errores.push(
        `La tabla "${tabla}" existe en public y NO está clasificada.\n`
        + `      Agregala a scripts/live-isolation/clasificacion-tablas.mjs con la clase que le\n`
        + `      corresponda. Elegir la clase es decidir cuánto se expone: no hay default.`,
      )
    }
  }
  for (const tabla of Object.keys(CLASIFICACION)) {
    if (!nombres.includes(tabla)) {
      errores.push(`La clasificación nombra "${tabla}", que ya no existe en public. Sacala.`)
    }
  }

  // --- RLS habilitada en todas --------------------------------------------

  for (const t of tablas) {
    if (!t.rls) errores.push(`"${t.tabla}" no tiene RLS habilitada.`)
  }

  // --- anon sin un solo grant ---------------------------------------------

  if (ANON_SIN_GRANTS) {
    const deAnon = grants.filter((g) => g.grantee === 'anon')
    for (const g of deAnon) {
      errores.push(`anon tiene ${g.privilegio} sobre "${g.tabla}". anon no puede tener grants en public.`)
    }
  }

  // --- Los grants coinciden exactamente con la clase ----------------------

  for (const tabla of nombres) {
    const clase = CLASIFICACION[tabla]
    if (!clase) continue
    const def = CLASES[clase]
    assert.ok(def, `clase desconocida "${clase}" para ${tabla}`)

    const reales = new Set(
      grants.filter((g) => g.grantee === 'authenticated' && g.tabla === tabla).map((g) => g.privilegio),
    )
    const permitidos = new Set(def.grantsAuthenticated)

    const sobran = [...reales].filter((p) => !permitidos.has(p)).sort()
    const faltan = [...permitidos].filter((p) => !reales.has(p)).sort()

    if (sobran.length) {
      errores.push(
        `"${tabla}" (${clase}) tiene grants de más para authenticated: ${sobran.join(', ')}.\n`
        + `      O sobra el grant, o la tabla cambió de clase y no se declaró.`,
      )
    }
    if (faltan.length) {
      errores.push(
        `"${tabla}" (${clase}) NO tiene grants que su clase exige: ${faltan.join(', ')}.\n`
        + `      La aplicación va a fallar al leerla, o la clase está mal elegida.`,
      )
    }
  }

  // --- Las políticas acotan como la clase exige ---------------------------
  //
  // Acá vive la aserción anti-USING(true): una política sin acotamiento no
  // acota nada, y sobre una tabla de lectura tenant eso expone el catálogo
  // entero a cualquier usuario autenticado de cualquier organización.

  for (const tabla of nombres) {
    const clase = CLASIFICACION[tabla]
    if (!clase) continue
    const def = CLASES[clase]
    const suyas = politicas.filter((p) => p.tabla === tabla)

    if (def.exigePolitica && suyas.length === 0) {
      errores.push(
        `"${tabla}" (${clase}) tiene grants para authenticated y NINGUNA política.\n`
        + `      Con RLS habilitada eso niega todo, así que la app se rompe; sin RLS expondría la tabla entera.`,
      )
      continue
    }

    if (!def.politicaDebeAcotar) {
      if (suyas.length > 0) {
        errores.push(
          `"${tabla}" (${clase}) no debería tener políticas para authenticated y tiene ${suyas.length}.`,
        )
      }
      continue
    }

    const patrones = ACOTAMIENTOS[def.politicaDebeAcotar]
    for (const p of suyas) {
      const expresion = `${p.usando} ${p.chequeo}`.trim()
      const acota = patrones.some((re) => re.test(expresion))
      if (!acota) {
        errores.push(
          `La política "${p.politica}" sobre "${tabla}" (${clase}, ${p.cmd}) no acota por ${def.politicaDebeAcotar}.\n`
          + `      Expresión: ${expresion || '(vacía = permisiva)'}\n`
          + `      Una política que no acota expone la tabla entera a cualquier usuario autenticado.`,
        )
      }
    }
  }

  // --- Las vistas son la puerta trasera de RLS ---------------------------
  //
  // Por defecto una vista se evalúa con los permisos de su DUEÑO. Sin
  // `security_invoker`, una vista de `postgres` sobre tablas con RLS deja de
  // aplicar esas políticas y expone el catálogo entero de todas las
  // organizaciones a cualquier usuario autenticado.
  //
  // Al escribir esto las doce vistas de producción lo tenían en `true`, pero
  // nada lo estaba verificando: una vista nueva sin la opción rompía el
  // aislamiento en silencio.

  const nombresVista = vistas.map((v) => v.vista)

  for (const vista of nombresVista) {
    if (!CLASIFICACION_VISTAS[vista]) {
      errores.push(
        `La vista "${vista}" existe en public y NO está clasificada.\n`
        + `      Las vistas exponen datos igual que las tablas, y por defecto lo hacen SIN aplicar\n`
        + `      las políticas de las tablas base. Clasificala en clasificacion-tablas.mjs.`,
      )
    }
  }
  for (const vista of Object.keys(CLASIFICACION_VISTAS)) {
    if (!nombresVista.includes(vista)) {
      errores.push(`La clasificación nombra la vista "${vista}", que ya no existe en public. Sacala.`)
    }
  }

  for (const v of vistas) {
    const clase = CLASIFICACION_VISTAS[v.vista]
    if (!clase) continue
    const def = CLASES_VISTA[clase]

    if (VISTAS_EXIGEN_SECURITY_INVOKER && v.security_invoker !== true) {
      errores.push(
        `La vista "${v.vista}" NO tiene security_invoker=true (dueño: ${v.duenio}).\n`
        + `      Sin eso evalúa RLS como su dueño, no como quien consulta: cualquier usuario\n`
        + `      autenticado vería las filas de TODAS las organizaciones a través de ella.\n`
        + `      Se arregla con: ALTER VIEW public.${v.vista} SET (security_invoker = true);`,
      )
    }

    const reales = new Set(
      grants.filter((g) => g.grantee === 'authenticated' && g.tabla === v.vista).map((g) => g.privilegio),
    )
    const permitidos = new Set(def.grantsAuthenticated)
    const sobran = [...reales].filter((p) => !permitidos.has(p)).sort()
    const faltan = [...permitidos].filter((p) => !reales.has(p)).sort()

    if (sobran.length) {
      errores.push(
        `La vista "${v.vista}" (${clase}) tiene grants de más para authenticated: ${sobran.join(', ')}.`,
      )
    }
    if (faltan.length) {
      errores.push(
        `La vista "${v.vista}" (${clase}) NO tiene grants que su clase exige: ${faltan.join(', ')}.`,
      )
    }
  }

  return errores
}

function main() {
  const db = requerirEntornoDescartable()

  const tablas = consultar(db, `
    SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
      SELECT c.relname AS tabla, c.relrowsecurity AS rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    ) t;`)

  const grants = consultar(db, `
    SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
      SELECT table_name AS tabla, grantee, privilege_type AS privilegio
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee IN ('authenticated', 'anon')
    ) t;`)

  const politicas = consultar(db, `
    SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
      SELECT tablename AS tabla, policyname AS politica, cmd,
             coalesce(qual, '') AS usando, coalesce(with_check, '') AS chequeo
      FROM pg_policies
      WHERE schemaname = 'public' AND 'authenticated' = ANY(roles)
    ) t;`)

  const vistas = consultar(db, `
    SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
      SELECT c.relname AS vista,
             pg_get_userbyid(c.relowner) AS duenio,
             COALESCE((SELECT option_value = 'true' FROM pg_options_to_table(c.reloptions)
                       WHERE option_name = 'security_invoker'), false) AS security_invoker
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
      ORDER BY c.relname
    ) t;`)

  const errores = verificar({ tablas, grants, politicas, vistas })
  const nombres = tablas.map((t) => t.tabla)

  if (errores.length) {
    fallar(errores)
    return
  }

  const porClase = {}
  for (const [tabla, clase] of Object.entries(CLASIFICACION)) {
    porClase[clase] = (porClase[clase] ?? 0) + 1
  }

  console.log(`✓ ${nombres.length} tablas en public, todas clasificadas y con RLS`)
  for (const [clase, n] of Object.entries(porClase).sort()) {
    console.log(`    ${clase.padEnd(20)} ${n}`)
  }
  console.log(`✓ ${vistas.length} vistas clasificadas, todas con security_invoker=true`)
  console.log('✓ anon sin grants; grants de authenticated exactos por clase')
  console.log('✓ toda política de authenticated acota por tenant o por auth.uid()')
}

// Sólo corre como CLI: el contrato importa `verificar` para probarla con
// catálogos armados a mano, y no debería levantar Postgres para eso.
const esCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (esCli) main()
