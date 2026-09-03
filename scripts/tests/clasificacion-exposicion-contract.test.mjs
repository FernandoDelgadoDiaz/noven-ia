// Contrato de la clasificación de tablas por exposición.
//
// El verificador real corre en CI contra el Supabase descartable, con el
// catálogo reconstruido por el replay. Este contrato corre sin red y cubre lo
// que aquél no puede: que el verificador efectivamente detecte cada forma de
// exposición indebida.
//
// Es la misma lección que el resto de la suite: un verificador que sólo se
// ejerce contra la base real se prueba únicamente cuando ya es tarde, y si
// tiene un agujero nadie se entera hasta que ese agujero importa.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { exclusionesDeLaBaseline, verificar } from '../live-isolation/clasificacion-exposicion.mjs'
import {
  ACOTAMIENTOS, CLASES, CLASES_VISTA,
  CLASIFICACION, CLASIFICACION_VISTAS, VISTAS_EXIGEN_SECURITY_INVOKER,
} from '../live-isolation/clasificacion-tablas.mjs'

const root = process.cwd()

// --- La clasificación es internamente coherente ----------------------------

for (const [tabla, clase] of Object.entries(CLASIFICACION)) {
  assert.ok(CLASES[clase], `"${tabla}" declara la clase inexistente "${clase}"`)
}

for (const [nombre, def] of Object.entries(CLASES)) {
  assert.ok(Array.isArray(def.grantsAuthenticated),
    `la clase ${nombre} debe declarar exactamente qué grants permite`)
  if (def.politicaDebeAcotar) {
    assert.ok(ACOTAMIENTOS[def.politicaDebeAcotar],
      `la clase ${nombre} exige un acotamiento "${def.politicaDebeAcotar}" que no está definido`)
  }
  if (def.grantsAuthenticated.length > 0) {
    assert.equal(def.exigePolitica, true,
      `la clase ${nombre} da grants a authenticated sin exigir política: eso expone la tabla entera`)
  }
}

// Sólo una clase puede escribir desde el browser, y sólo una tabla la usa.
const escritores = Object.entries(CLASIFICACION).filter(([, c]) => c === 'escritura_propia')
assert.deepEqual(escritores.map(([t]) => t), ['push_subscriptions'],
  'push_subscriptions es el único escritor legítimo desde el browser; sumar otro es una decisión, no un detalle')

// La clase server-only no puede tener grants ni políticas: es negación total.
assert.deepEqual(CLASES.solo_servidor.grantsAuthenticated, [],
  'solo_servidor significa cero grants para authenticated')
assert.deepEqual(CLASES.respaldo_historico.grantsAuthenticated, [],
  'un respaldo histórico no se expone a authenticated')

for (const [vista, clase] of Object.entries(CLASIFICACION_VISTAS)) {
  assert.ok(CLASES_VISTA[clase], `la vista "${vista}" declara la clase inexistente "${clase}"`)
}

// `security_invoker` no es negociable: sin él una vista evalúa RLS como su
// dueño y el aislamiento multitenant deja de existir para quien la consulte.
assert.equal(VISTAS_EXIGEN_SECURITY_INVOKER, true,
  'exigir security_invoker es la condición para exponer una vista a authenticated')

for (const [nombre, def] of Object.entries(CLASES_VISTA)) {
  assert.ok(!def.grantsAuthenticated.some((p) => ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'].includes(p)),
    `ninguna clase de vista puede permitir escritura desde el browser (${nombre})`)
}

// --- Un catálogo válido no produce errores ---------------------------------

const catalogoValido = {
  tablas: [
    { tabla: 'productos', rls: true },
    { tabla: 'producto_sucursal', rls: true },
    { tabla: 'usuarios', rls: true },
    { tabla: 'push_subscriptions', rls: true },
    { tabla: 'rate_limit_consumo', rls: true },
  ],
  grants: [
    { tabla: 'productos', grantee: 'authenticated', privilegio: 'SELECT' },
    { tabla: 'usuarios', grantee: 'authenticated', privilegio: 'SELECT' },
    ...['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
      .map((privilegio) => ({ tabla: 'push_subscriptions', grantee: 'authenticated', privilegio })),
    { tabla: 'v_productos_catalogo', grantee: 'authenticated', privilegio: 'SELECT' },
    { tabla: 'producto_sucursal', grantee: 'authenticated', privilegio: 'SELECT' },
  ],
  vistas: [
    { vista: 'v_productos_catalogo', duenio: 'postgres', security_invoker: true },
    { vista: 'vw_usuarios_completos', duenio: 'postgres', security_invoker: true },
  ],
  politicas: [
    { tabla: 'productos', politica: 'productos_select_scope_v1', cmd: 'SELECT', usando: 'noven_private.tiene_acceso_organizacion(organizacion_id)', chequeo: '' },
    { tabla: 'usuarios', politica: 'usuarios_select_own', cmd: 'SELECT', usando: '(( SELECT auth.uid() AS uid) = id)', chequeo: '' },
    { tabla: 'push_subscriptions', politica: 'push_propias', cmd: 'ALL', usando: '(auth.uid() = usuario_id)', chequeo: '(auth.uid() = usuario_id)' },
    // Declarada TO public, que incluye a authenticated. Producción tiene cinco
    // así, acotadas por producto+sucursal.
    { tabla: 'producto_sucursal', politica: 'producto_sucursal_select_scope', cmd: 'SELECT', roles: '{public}', usando: 'noven_private.puede_leer_producto_sucursal(sucursal_id, producto_id)', chequeo: '' },
  ],
}

// El catálogo de prueba no contiene todas las tablas clasificadas, así que se
// esperan avisos de "ya no existe": se filtran para probar el resto.
const soloReales = (errores) => errores.filter(
  (e) => !e.includes('no existe en public ni figura entre las') && !e.includes('ya no existe en public'),
)

assert.deepEqual(soloReales(verificar(catalogoValido)), [],
  `un catálogo correcto no debe producir errores. Produjo:\n${soloReales(verificar(catalogoValido)).join('\n')}`)

// --- Cada forma de exposición indebida se detecta --------------------------

function conCambio(mutar) {
  const copia = JSON.parse(JSON.stringify(catalogoValido))
  mutar(copia)
  return soloReales(verificar(copia))
}

const REGRESIONES = [
  {
    nombre: 'tabla nueva sin clasificar',
    mutar: (c) => c.tablas.push({ tabla: 'tabla_nueva_sin_clase', rls: true }),
    esperado: /NO está clasificada/,
  },
  {
    nombre: 'política USING(true) sobre una tabla de lectura tenant',
    mutar: (c) => { c.politicas.find((p) => p.tabla === 'productos').usando = 'true' },
    esperado: /no acota por tenant/,
  },
  {
    nombre: 'política sin expresión (permisiva)',
    mutar: (c) => { c.politicas.find((p) => p.tabla === 'productos').usando = '' },
    esperado: /no acota por tenant/,
  },
  {
    nombre: 'política que compara contra un literal en vez de acotar',
    mutar: (c) => { c.politicas.find((p) => p.tabla === 'productos').usando = "(estado = 'activo')" },
    esperado: /no acota por tenant/,
  },
  {
    nombre: 'grant de escritura sobre una tabla de sólo lectura',
    mutar: (c) => c.grants.push({ tabla: 'productos', grantee: 'authenticated', privilegio: 'INSERT' }),
    esperado: /grants de más para authenticated: INSERT/,
  },
  {
    nombre: 'grant a una tabla server-only',
    mutar: (c) => c.grants.push({ tabla: 'rate_limit_consumo', grantee: 'authenticated', privilegio: 'SELECT' }),
    esperado: /grants de más para authenticated: SELECT/,
  },
  {
    nombre: 'un grant cualquiera para anon',
    mutar: (c) => c.grants.push({ tabla: 'productos', grantee: 'anon', privilegio: 'SELECT' }),
    esperado: /anon no puede tener grants/,
  },
  {
    nombre: 'RLS deshabilitada',
    mutar: (c) => { c.tablas.find((t) => t.tabla === 'productos').rls = false },
    esperado: /no tiene RLS habilitada/,
  },
  {
    nombre: 'tabla con grants y sin ninguna política',
    mutar: (c) => { c.politicas = c.politicas.filter((p) => p.tabla !== 'productos') },
    esperado: /NINGUNA política/,
  },
  {
    // Con cero grants una política no se puede ejercer, así que lo que importa
    // no es la política sino el grant: si aparece uno, la tabla deja de estar
    // negada y la política pasa a decidir. Ese es el caso que se prueba.
    nombre: 'tabla server-only con grant Y política permisiva',
    mutar: (c) => {
      c.grants.push({ tabla: 'rate_limit_consumo', grantee: 'authenticated', privilegio: 'SELECT' })
      c.politicas.push({ tabla: 'rate_limit_consumo', politica: 'x', cmd: 'SELECT', roles: '{public}', usando: 'true', chequeo: '' })
    },
    esperado: /grants de más para authenticated: SELECT/,
  },
  {
    // El caso que mi primera versión no veía: filtraba las políticas por
    // 'authenticated' = ANY(roles), y una declarada TO public quedaba fuera
    // del análisis pese a aplicarle igual. Era el agujero justo en la forma
    // más peligrosa de política.
    nombre: 'política USING(true) declarada TO public (aplica a authenticated)',
    mutar: (c) => { c.politicas.find((p) => p.tabla === 'producto_sucursal').usando = 'true' },
    esperado: /no acota por tenant/,
  },
  {
    nombre: 'vista SIN security_invoker (evalúa RLS como su dueño)',
    mutar: (c) => { c.vistas.find((v) => v.vista === 'v_productos_catalogo').security_invoker = false },
    esperado: /NO tiene security_invoker=true/,
  },
  {
    nombre: 'vista nueva sin clasificar',
    mutar: (c) => c.vistas.push({ vista: 'v_nueva_sin_clase', duenio: 'postgres', security_invoker: true }),
    esperado: /La vista "v_nueva_sin_clase" existe en public y NO está clasificada/,
  },
  {
    nombre: 'vista con grant de escritura para authenticated',
    mutar: (c) => c.grants.push({ tabla: 'v_productos_catalogo', grantee: 'authenticated', privilegio: 'INSERT' }),
    esperado: /La vista "v_productos_catalogo" .* tiene grants de más para authenticated: INSERT/,
  },
  {
    nombre: 'vista server-only expuesta a authenticated',
    mutar: (c) => c.grants.push({ tabla: 'vw_usuarios_completos', grantee: 'authenticated', privilegio: 'SELECT' }),
    esperado: /La vista "vw_usuarios_completos" .* grants de más/,
  },
  {
    nombre: 'tabla de usuario acotada por tenant en vez de por auth.uid()',
    mutar: (c) => { c.politicas.find((p) => p.tabla === 'usuarios').usando = 'noven_private.tiene_acceso_organizacion(organizacion_id)' },
    esperado: /no acota por usuario/,
  },
]

for (const { nombre, mutar, esperado } of REGRESIONES) {
  const errores = conCambio(mutar)
  assert.ok(
    errores.some((e) => esperado.test(e)),
    `NO detectó: ${nombre}.\n  esperaba algo que matchee ${esperado}\n  obtuvo:\n${errores.map((e) => `    - ${e.split('\n')[0]}`).join('\n') || '    (ningún error)'}`,
  )
}

// --- Las exclusiones de la baseline se leen del manifiesto ------------------
//
// La clasificación describe producción; el verificador corre contra el replay,
// que excluye deliberadamente los respaldos históricos. Sin esto, cada
// exclusión declarada aparecería como "tabla que ya no existe" y el ítem
// quedaría rojo por un desacuerdo esperado.

const excluidas = exclusionesDeLaBaseline()
assert.ok(excluidas.size > 0,
  'deben leerse las exclusiones de relations del manifiesto de la baseline')
for (const respaldo of Object.entries(CLASIFICACION).filter(([, c]) => c === 'respaldo_historico').map(([t]) => t)) {
  assert.ok(excluidas.has(respaldo),
    `"${respaldo}" está clasificado como respaldo histórico pero no figura excluido de la baseline`)
}

// Una tabla clasificada que no existe Y no está excluida sigue siendo un error.
assert.ok(
  verificar({ ...catalogoValido, excluidas }).some((e) => e.includes('rate_limit_consumo')) === false,
  'las tablas presentes no deben reportarse como ausentes',
)
const sinExcluir = verificar({ ...catalogoValido, excluidas: new Set() })
assert.ok(sinExcluir.some((e) => e.includes('dedup_turrocklets_backup')),
  'sin el manifiesto, una exclusión declarada debe reportarse: el filtro no puede ser incondicional')

// --- El paso corre en CI ---------------------------------------------------

const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')
assert.match(ci, /node scripts\/live-isolation\/clasificacion-exposicion\.mjs/,
  'la verificación tiene que correr en CI: acá se prueba la lógica, allá el catálogo real')
assert.match(ci, /NOVEN_REPLAY_DB_URL=\$\{DB_URL\}/,
  'el verificador necesita la URL de la base descartable exportada desde supabase-local.env')

// --- El verificador se niega a mirar una base que no sea local -------------

const fuente = fs.readFileSync(path.join(root, 'scripts/live-isolation/clasificacion-exposicion.mjs'), 'utf8')
assert.match(fuente, /127\.0\.0\.1|localhost/,
  'debe negarse a inspeccionar una base que no sea local')
assert.match(fuente, /NOVEN_EPHEMERAL_REPLAY/,
  'debe exigir el entorno descartable')

console.log(`✓ ${Object.keys(CLASIFICACION).length} tablas y ${Object.keys(CLASIFICACION_VISTAS).length} vistas clasificadas`)
console.log(`✓ El verificador detecta las ${REGRESIONES.length} formas de exposición indebida, incluida USING(true)`)
