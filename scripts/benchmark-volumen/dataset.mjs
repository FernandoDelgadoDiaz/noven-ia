// Dataset sintético determinista para el benchmark del ítem 3.3.
//
// NO ES UNA MIGRACIÓN Y NO DEBE SERLO. Una migración de datos sintéticos se
// replicaría a toda organización futura, que es exactamente el problema que el
// ítem 3.2 existe para resolver. Esto genera SQL que se aplica sobre una base
// descartable y muere con ella.
//
// DETERMINISMO. No se usa `random()`: no es reproducible entre corridas, y sin
// reproducibilidad la comparación "antes / después" de un índice no significa
// nada, porque la diferencia podría venir del dataset y no del índice. Todo
// valor pseudoaleatorio se deriva por hash del índice de la serie más una
// semilla fija: la misma escala produce siempre exactamente las mismas filas.
//
// FORMA ANTES QUE TAMAÑO. Hoy hay una organización con datos en una sucursal:
// todo funciona por coincidencia, no por diseño. El dataset rompe eso con ocho
// organizaciones de tamaños muy distintos y con los vencimientos concentrados
// en pocas sucursales, que es como se ven los datos reales.
//
// UNICIDAD POR CONSTRUCCIÓN. `producto_sucursal` tiene único (producto,
// sucursal) y `vencimientos` tiene único (producto, sucursal) WHERE activo.
// En vez de insertar y esperar que no choque, los pares se generan por
// aritmética modular —biyectiva mientras k < S*P— y los vencimientos salen de
// un subconjunto de esos pares. Así no puede haber colisión, y de paso el
// dataset es semánticamente correcto: sólo se registra vencimiento de un
// producto que está en esa sucursal.

import crypto from 'node:crypto'

const SEMILLA = 'noven-benchmark-3-3-v1'

/** UUID derivado por hash. Mismo nombre lógico ⇒ mismo UUID siempre. */
export function uuid(nombre) {
  const h = crypto.createHash('md5').update(`${SEMILLA}:${nombre}`).digest('hex')
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20, 32)].join('-')
}

const lit = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)

/** Entero pseudoaleatorio determinista en SQL, derivado de una expresión texto. */
const hashInt = (expr) => `(('x' || substr(md5(${expr}), 1, 8))::bit(32)::bigint & 2147483647)`

// El catálogo de una cadena no crece con el volumen transaccional: un
// supermercado tiene decenas de miles de SKU y punto. Escalarlo linealmente
// daría un dataset irreal y dominaría el tiempo de siembra sin enseñar nada.
const TOPE_CATALOGO = 20

const ORGS = [
  { i: 1, nombre: 'GRANDE', zonas: 17, sucursales: 200, peso: 0.72 },
  { i: 2, nombre: 'MEDIANA_A', zonas: 4, sucursales: 40, peso: 0.1 },
  { i: 3, nombre: 'MEDIANA_B', zonas: 4, sucursales: 40, peso: 0.08 },
  { i: 4, nombre: 'MEDIANA_C', zonas: 4, sucursales: 40, peso: 0.06 },
  { i: 5, nombre: 'CHICA_A', zonas: 1, sucursales: 2, peso: 0.01 },
  { i: 6, nombre: 'CHICA_B', zonas: 1, sucursales: 2, peso: 0.01 },
  { i: 7, nombre: 'CHICA_C', zonas: 1, sucursales: 2, peso: 0.01 },
  { i: 8, nombre: 'CHICA_D', zonas: 1, sucursales: 2, peso: 0.01 },
]

const DIAS_DONACION = [10, 15, 20, 5, 30, 12]

/** La sucursal donde mide el usuario del benchmark: la más cargada de la org grande. */
export const SUCURSAL_MEDIDA = uuid('suc:1:1')
export const ORG_MEDIDA = uuid('org:1')
export const USUARIO_MEDIDO = uuid('usuario:gerente')

export function perfil(escala) {
  const productosTotales = 713 * Math.min(escala, TOPE_CATALOGO)
  const psTotales = 713 * escala
  const vencTotales = 145 * escala
  const orgs = ORGS.map((o) => {
    const productos = Math.max(50, Math.round(productosTotales * o.peso))
    const ps = Math.max(o.sucursales, Math.round(psTotales * o.peso))
    return {
      ...o,
      productos,
      // Los pares (producto, sucursal) son únicos sólo mientras no se agote el
      // producto cartesiano. Si se agota, el tope es el cartesiano.
      ps: Math.min(ps, productos * o.sucursales),
      vencimientos: Math.round(vencTotales * o.peso),
    }
  })
  // Reparto Zipf de la presencia entre sucursales: peso ∝ 1/rango. Da una
  // sucursal dominante y una cola larga, que es la forma real de una cadena, y
  // hace que la sucursal medida se parezca a la 091 de hoy en vez de a un
  // promedio que no existe en ninguna parte.
  for (const o of orgs) {
    const pesos = Array.from({ length: o.sucursales }, (_, i) => 1 / (i + 1))
    const suma = pesos.reduce((a, b) => a + b, 0)
    o.presenciaPorSucursal = pesos.map((w) =>
      Math.min(o.productos, Math.max(1, Math.round((o.ps * w) / suma))),
    )
    o.ps = o.presenciaPorSucursal.reduce((a, b) => a + b, 0)
    o.vencimientos = Math.min(o.vencimientos, o.ps)
  }
  return {
    escala,
    orgs,
    sucursalesTotales: orgs.reduce((a, o) => a + o.sucursales, 0),
    productos: orgs.reduce((a, o) => a + o.productos, 0),
    productoSucursal: orgs.reduce((a, o) => a + o.ps, 0),
    vencimientos: orgs.reduce((a, o) => a + o.vencimientos, 0),
  }
}

export function generarSql(escala) {
  const p = perfil(escala)
  const L = []
  const w = (s) => L.push(s)

  w(`-- Dataset sintético determinista · escala ${escala}× · semilla ${SEMILLA}`)
  w(`-- ${p.orgs.length} organizaciones · ${p.sucursalesTotales} sucursales`)
  w(`-- ${p.productos} productos · ${p.productoSucursal} producto_sucursal · ${p.vencimientos} vencimientos`)
  w(`--`)
  w(`-- Generado por scripts/benchmark-volumen/dataset.mjs. No editar a mano.`)
  w('')
  w('BEGIN;')
  w('')
  w(`-- Reloj fijo. El dataset no puede cambiar de significado según el día en`)
  w(`-- que se corra: las ventanas de riesgo se calculan contra esta fecha.`)
  w(`CREATE TEMPORARY TABLE bench_reloj(hoy date NOT NULL) ON COMMIT DROP;`)
  w(`INSERT INTO bench_reloj VALUES (DATE '2026-09-01');`)
  w('')

  // ---------------------------------------------------------------- estructura
  w('-- ============ estructura ============================================')
  for (const o of p.orgs) {
    const orgId = uuid(`org:${o.i}`)
    w(`-- organización ${o.i} · ${o.nombre} · ${o.sucursales} sucursales`)
    w(
      `INSERT INTO public.organizaciones (id, codigo, nombre, activa)\n` +
        `VALUES (${lit(orgId)}, ${lit(`BENCH${String(o.i).padStart(3, '0')}`)}, ${lit(`Bench ${o.nombre}`)}, true);`,
    )
    for (let r = 1; r <= 2; r++) {
      w(
        `INSERT INTO public.regiones (id, organizacion_id, codigo, nombre)\n` +
          `VALUES (${lit(uuid(`reg:${o.i}:${r}`))}, ${lit(orgId)}, ${lit(`R${r}`)}, ${lit(`Region ${r}`)});`,
      )
    }
    for (let z = 1; z <= o.zonas; z++) {
      w(
        `INSERT INTO public.zonas (id, organizacion_id, codigo, nombre, activa, region_id)\n` +
          `VALUES (${lit(uuid(`zona:${o.i}:${z}`))}, ${lit(orgId)}, ${lit(`Z${String(z).padStart(2, '0')}`)}, ${lit(`Zona ${z}`)}, true, ${lit(uuid(`reg:${o.i}:${(z % 2) + 1}`))});`,
      )
    }
    for (let s = 1; s <= 6; s++) {
      w(
        `INSERT INTO public.sectores (id, codigo, nombre, organizacion_id, dias_donacion)\n` +
          `VALUES (${lit(uuid(`sector:${o.i}:${s}`))}, ${lit(`S${s}`)}, ${lit(`Sector ${s}`)}, ${lit(orgId)}, ${DIAS_DONACION[s - 1]});`,
      )
    }
    // Familias repartidas entre los seis sectores de forma determinista.
    w(
      `INSERT INTO public.familias (id, codigo, nombre, sector_id, organizacion_id)\n` +
        `SELECT md5(${lit(`${SEMILLA}:fam:${o.i}:`)} || i::text)::uuid,\n` +
        `       'F' || lpad(i::text, 3, '0'), 'Familia ' || i,\n` +
        `       md5(${lit(`${SEMILLA}:sector:${o.i}:`)} || (((i - 1) % 6) + 1)::text)::uuid,\n` +
        `       ${lit(orgId)}::uuid\n` +
        `FROM generate_series(1, 26) AS i;`,
    )
    // Sucursales numeradas 1..N. La 1 es la que más carga recibe.
    w(
      `INSERT INTO public.sucursales (id, nombre, activa, codigo, organizacion_id, zona_id)\n` +
        `SELECT md5(${lit(`${SEMILLA}:suc:${o.i}:`)} || i::text)::uuid,\n` +
        `       'Sucursal ' || i, true, lpad(i::text, 3, '0'), ${lit(orgId)}::uuid,\n` +
        `       md5(${lit(`${SEMILLA}:zona:${o.i}:`)} || (((i - 1) % ${o.zonas}) + 1)::text)::uuid\n` +
        `FROM generate_series(1, ${o.sucursales}) AS i;`,
    )
    w('')
  }

  // ------------------------------------------------------------------ catálogo
  w('-- ============ catálogo ==============================================')
  for (const o of p.orgs) {
    const orgId = uuid(`org:${o.i}`)
    w(
      `INSERT INTO public.productos (id, cod_art, codigo_barras, descripcion, marca,\n` +
        `                             venta_media_diaria, stock_actual, activo, familia_id, organizacion_id)\n` +
        `SELECT md5(${lit(`${SEMILLA}:prod:${o.i}:`)} || i::text)::uuid,\n` +
        `       'CA${o.i}' || lpad(i::text, 8, '0'),\n` +
        `       '779${o.i}' || lpad(i::text, 9, '0'),\n` +
        `       'Producto ${o.i}-' || i,\n` +
        `       'Marca ' || ((i % 40) + 1),\n` +
        `       (${hashInt(`'vmd${o.i}' || i::text`)} % 900)::numeric / 100.0,\n` +
        `       (${hashInt(`'stk${o.i}' || i::text`)} % 400)::int,\n` +
        `       true,\n` +
        `       md5(${lit(`${SEMILLA}:fam:${o.i}:`)} || ((${hashInt(`'fam${o.i}' || i::text`)} % 26) + 1)::text)::uuid,\n` +
        `       ${lit(orgId)}::uuid\n` +
        `FROM generate_series(1, ${o.productos}) AS i;`,
    )
  }
  w('')

  // ------------------------------------------------- presencia por sucursal
  w('-- ============ presencia del producto en la sucursal ==================')
  w('-- Pares únicos por construcción: cada sucursal toma los productos 1..cupo,')
  w('-- así que el par (producto, sucursal) no se repite jamás. El cupo sigue un')
  w('-- reparto Zipf —peso 1/rango— en vez de ser uniforme: una sucursal')
  w('-- dominante y una cola larga, que es la forma real y la que hace visible')
  w('-- el peor caso. Un dataset uniforme lo escondería.')
  for (const o of p.orgs) {
    const orgId = uuid(`org:${o.i}`)
    const cupos = o.presenciaPorSucursal.map((n, i) => `(${i + 1},${n})`).join(',')
    w(
      `INSERT INTO public.producto_sucursal (id, organizacion_id, producto_id, sucursal_id,\n` +
        `                                     stock_actual, venta_media_diaria)\n` +
        `SELECT md5(${lit(`${SEMILLA}:ps:${o.i}:`)} || c.suc::text || ':' || j::text)::uuid,\n` +
        `       ${lit(orgId)}::uuid,\n` +
        `       md5(${lit(`${SEMILLA}:prod:${o.i}:`)} || j::text)::uuid,\n` +
        `       md5(${lit(`${SEMILLA}:suc:${o.i}:`)} || c.suc::text)::uuid,\n` +
        `       (${hashInt(`'psstk${o.i}' || c.suc::text || ':' || j::text`)} % 300)::int,\n` +
        `       (${hashInt(`'psvmd${o.i}' || c.suc::text || ':' || j::text`)} % 800)::numeric / 100.0\n` +
        `FROM (VALUES ${cupos}) AS c(suc, cupo)\n` +
        `CROSS JOIN LATERAL generate_series(1, c.cupo) AS j;`,
    )
  }
  w('')

  // ------------------------------------------------------------- usuarios
  w('-- ============ usuarios y accesos ====================================')
  w(`-- El usuario que mide: gerente de la sucursal más cargada de la org grande.`)
  w(
    `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,\n` +
      `                        email_confirmed_at, created_at, updated_at)\n` +
      `VALUES (${lit(USUARIO_MEDIDO)}, '00000000-0000-0000-0000-000000000000', 'authenticated',\n` +
      `        'authenticated', 'bench-gerente@noven.local', '', now(), now(), now())\n` +
      `ON CONFLICT (id) DO NOTHING;`,
  )
  w(
    `INSERT INTO public.usuarios (id, nombre, rol, sucursal_id, activo)\n` +
      `VALUES (${lit(USUARIO_MEDIDO)}, 'Bench Gerente', 'gerente_sucursal', ${lit(SUCURSAL_MEDIDA)}, true);`,
  )
  w(
    `INSERT INTO public.usuario_accesos (id, usuario_id, organizacion_id, rol, zona_id, sucursal_id, activo)\n` +
      `VALUES (${lit(uuid('acceso:gerente'))}, ${lit(USUARIO_MEDIDO)}, ${lit(ORG_MEDIDA)},\n` +
      `        'gerente_sucursal', NULL, ${lit(SUCURSAL_MEDIDA)}, true);`,
  )
  w('')

  // --------------------------------------------------------- vencimientos
  w('-- ============ vencimientos ==========================================')
  w('-- Subconjunto de los pares ya existentes en producto_sucursal, así que el')
  w('-- único parcial (producto, sucursal) WHERE activo no puede violarse.')
  w('--')
  w('-- Concentración: el 80% cae en el 20% de las sucursales. Un dataset')
  w('-- uniforme escondería el peor caso, que es la sucursal con mucho volumen.')
  w('--')
  w('-- Las fechas se reparten sobre las ventanas reales del motor de riesgo')
  w('-- —radar 45, urgente 20, donación según sector, vencido— contra el reloj')
  w('-- fijo, no contra now().')
  for (const o of p.orgs) {
    const calientes = Math.max(1, Math.round(o.sucursales * 0.2))
    w(
      `INSERT INTO public.vencimientos (id, producto_id, sucursal_id, usuario_id, cantidad,\n` +
        `                                 lote, fecha_vencimiento, activo)\n` +
        `SELECT md5(${lit(`${SEMILLA}:venc:${o.i}:`)} || ps.id::text)::uuid,\n` +
        `       ps.producto_id, ps.sucursal_id, ${lit(USUARIO_MEDIDO)}::uuid,\n` +
        `       (${hashInt('\'cant\' || ps.id::text')} % 60) + 1,\n` +
        `       'L' || lpad((${hashInt('\'lote\' || ps.id::text')} % 9999)::text, 4, '0'),\n` +
        `       (SELECT hoy FROM bench_reloj) + ((${hashInt('\'fv\' || ps.id::text')} % 120) - 15)::int,\n` +
        `       true\n` +
        `FROM (\n` +
        `  SELECT ps.id, ps.producto_id, ps.sucursal_id,\n` +
        `         (s.codigo::int <= ${calientes}) AS caliente\n` +
        `  FROM public.producto_sucursal ps\n` +
        `  JOIN public.sucursales s ON s.id = ps.sucursal_id\n` +
        `  WHERE ps.organizacion_id = ${lit(uuid(`org:${o.i}`))}\n` +
        `) ps\n` +
        `ORDER BY ps.caliente DESC, md5('orden' || ps.id::text)\n` +
        `LIMIT ${o.vencimientos};`,
    )
  }
  w('')

  w('-- Estadísticas frescas: sin esto el planificador elige con números viejos')
  w('-- y el plan que se mide no es el que correría.')
  w('COMMIT;')
  w('')
  w('ANALYZE public.organizaciones, public.regiones, public.zonas, public.sucursales,')
  w('        public.sectores, public.familias, public.productos, public.producto_sucursal,')
  w('        public.vencimientos, public.usuarios, public.usuario_accesos;')
  return L.join('\n')
}



/**
 * Limpieza entre escalas. El dataset usa UUID fijos derivados de la semilla, así
 * que sembrar dos escalas seguidas sin vaciar chocaría contra las claves. Se
 * borra sólo lo sembrado: nada de DROP de esquema.
 */
export function limpiezaSql() {
  return [
    'TRUNCATE public.vencimientos, public.producto_sucursal, public.usuario_accesos,',
    '         public.usuarios, public.productos, public.familias, public.sectores,',
    '         public.sucursales, public.zonas, public.regiones, public.organizaciones CASCADE;',
    'DELETE FROM auth.users WHERE email LIKE \'%@noven.local\';',
  ].join('\n')
}

if (process.argv[1] && process.argv[1].endsWith('dataset.mjs')) {
  if (process.argv.includes('--limpieza')) {
    process.stdout.write(`${limpiezaSql()}\n`)
  } else {
    const arg = process.argv.find((a) => a.startsWith('--escala='))
    const escala = arg ? Number(arg.split('=')[1]) : 1
    if (!Number.isInteger(escala) || escala < 1) throw new Error('--escala debe ser un entero ≥ 1')
    process.stdout.write(`${generarSql(escala)}\n`)
  }
}
