// Contrato del patrón wrapper / impl: una RPC concedida que no se puede ejecutar.
//
// EL BUG QUE ESTE CONTRATO EXISTE PARA IMPEDIR
//
// El repositorio expone cada RPC como un wrapper `public.*` SECURITY INVOKER
// que delega en una implementación `noven_private.*_impl` SECURITY DEFINER.
//
// Un wrapper SECURITY INVOKER corre con los privilegios de QUIEN LLAMA. Así que
// `authenticated` necesita EXECUTE sobre la implementación. Si la migración le
// revoca ese permiso —cosa que parece más segura y se escribe sola— la RPC
// queda concedida y a la vez inutilizable: el `GRANT` sobre el wrapper está,
// pero cada llamada muere con `permission denied for function ..._impl`.
//
// No lo detecta ningún contrato de texto, porque el SQL "se ve bien": tiene su
// REVOKE, su GRANT y su SECURITY DEFINER. Sólo aparece ejecutándolo.
//
// EL AISLAMIENTO NO LO DA ESTE GRANT
//
// Lo da que `noven_private` no esté entre los esquemas expuestos por PostgREST:
// nadie puede llamar a la implementación por HTTP aunque tenga EXECUTE. Revocar
// además el permiso no agrega seguridad y sí rompe la función.
//
// CÓMO SE ENCONTRÓ
//
// Escribiendo la RPC de salidas no-venta se copió el patrón de
// `instrumentar_sugerencia_rag`, y la prueba de punta a punta falló con
// `permission denied`. Al revisar, la función copiada tenía el mismo defecto y
// está aplicada en producción desde el 2026-09-04: 17 intervenciones, 0 con
// `cobertura_al_sugerir`, `escalones_sugeridos` u `origen_sugerencia`. La
// instrumentación nunca registró nada, y el frontend traga el error en un
// `console.error`.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(process.cwd(), 'supabase', 'migrations')
const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()

/** `REVOKE ... ON FUNCTION noven_private.X_impl(...) FROM ... authenticated` */
const REVOCA_AUTHENTICATED =
  /REVOKE\s+ALL\s+ON\s+FUNCTION\s+noven_private\.([a-z0-9_]+_impl)\s*\([^)]*\)\s*FROM\s+([^;]*);/gi

// Los permisos son ACUMULATIVOS: una migración posterior puede devolver un
// EXECUTE que otra revocó. Por eso no alcanza con mirar cada archivo por
// separado —así se leyó mal la primera versión de este contrato— y hay que
// recorrerlos en orden reconstruyendo el estado final de cada implementación.
const estado = new Map() // impl -> { ejecutable, wrapperConcedido, invocador, archivo }

const anotar = (impl, campos) =>
  estado.set(impl, { ...(estado.get(impl) ?? {}), ...campos })

for (const archivo of archivos) {
  const sql = fs.readFileSync(path.join(DIR, archivo), 'utf8')

  for (const m of sql.matchAll(REVOCA_AUTHENTICATED)) {
    const [, impl, destinatarios] = m
    if (!/\bauthenticated\b/i.test(destinatarios)) continue
    anotar(impl, { ejecutable: false, archivo })
  }

  for (const m of sql.matchAll(
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+noven_private\.([a-z0-9_]+_impl)\s*\([^)]*\)\s*TO([^;]*);/gi,
  )) {
    const [, impl, destinatarios] = m
    if (/\bauthenticated\b/i.test(destinatarios)) anotar(impl, { ejecutable: true })
  }

  // Un RPC RETIRADO no es un RPC roto. Cuando una migración revoca también el
  // wrapper público, la intención es sacar la función de circulación —
  // `product_image_v2_final_hardening` jubiló la v1 en favor de la v2, y
  // `revoke_orphan_radar_summary_rpc_v1` sacó una que ya no llamaba nadie—.
  // Sin esta distinción el contrato marcaría como defecto cada deprecación
  // bien hecha, y a la tercera falsa alarma nadie volvería a leerlo.
  for (const m of sql.matchAll(
    /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\([^)]*\)\s*FROM([^;]*);/gi,
  )) {
    const [, wrapper, destinatarios] = m
    // Sólo cuenta revocarle a AUTHENTICATED. `REVOKE ... FROM PUBLIC, anon` es
    // higiene normal y aparece en TODAS las migraciones sanas justo antes del
    // GRANT: tomarlo por retiro dejaba pasar el defecto que este contrato
    // existe para cazar. Fue el primer error de esta verificación.
    if (/\bauthenticated\b/i.test(destinatarios)) {
      anotar(`${wrapper}_impl`, { wrapperConcedido: false, retiradoEn: archivo })
    }
  }

  for (const m of sql.matchAll(
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\([^)]*\)\s*TO([^;]*);/gi,
  )) {
    const [, wrapper, destinatarios] = m
    if (/\bauthenticated\b/i.test(destinatarios)) anotar(`${wrapper}_impl`, { wrapperConcedido: true })
  }

  for (const m of sql.matchAll(
    /CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)[\s\S]{0,600}?SECURITY INVOKER/gi,
  )) {
    anotar(`${m[1]}_impl`, { invocador: true })
  }
}

const revisadas = [...estado.keys()]
const rotas = []
for (const [impl, v] of estado) {
  if (v.ejecutable === false && v.wrapperConcedido && v.invocador) {
    rotas.push(
      `public.${impl.replace(/_impl$/, '')} está concedida a authenticated y es SECURITY INVOKER,\n` +
        `    pero noven_private.${impl} le revoca EXECUTE y nada se lo devuelve.\n` +
        `    Cada llamada va a fallar con "permission denied for function ${impl}".\n` +
        `    Revocado en: ${v.archivo}`,
    )
  }
}

assert.ok(
  revisadas.length > 0,
  'el contrato no encontró ningún REVOKE sobre una implementación: si el patrón cambió, este archivo hay que reescribirlo en vez de dejarlo pasando en vacío',
)

assert.deepEqual(
  rotas,
  [],
  `Hay RPC concedidas que no se pueden ejecutar:\n\n  ${rotas.join('\n\n  ')}\n\n` +
    'El wrapper SECURITY INVOKER corre con los privilegios del que llama, así que\n' +
    'authenticated necesita EXECUTE sobre la implementación. El aislamiento lo da\n' +
    'que noven_private no esté expuesto por PostgREST, no este REVOKE.',
)

console.log(`✓ Las ${revisadas.length} implementaciones revocadas conservan un camino ejecutable`)
