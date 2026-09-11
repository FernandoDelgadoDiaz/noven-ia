// Contrato del bloque 3B: jornada zonal, corte de visibilidad y exportación.
//
// Lo que este bloque agrega no se ve mirando la pantalla en un momento
// cualquiera: una solicitud diferida se parece mucho a una que no existe, y una
// que espera a que abra la ventana se parece mucho a una que se perdió. Por eso
// cada regla se afirma sobre el texto de la migración —donde vive— y cada pieza
// que sí corre en el browser se ejecuta de verdad.
//
// El archivo exportado se vuelve a abrir acá con un lector de ZIP propio: si el
// escritor tuviera un error de offsets o de CRC, una comparación de cadenas no
// lo notaría y Excel sí.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

function dataUrl(js) {
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
}

function transpilar(relativePath) {
  return ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
}

/**
 * Una data URL no resuelve especificadores relativos, así que la dependencia se
 * reemplaza por su propia data URL. El código que corre es el del repositorio,
 * no una copia escrita para la prueba.
 */
async function importarTs(relativePath, dependencias = {}) {
  let js = transpilar(relativePath)
  for (const [especificador, rutaDependencia] of Object.entries(dependencias)) {
    js = js.replaceAll(`'${especificador}'`, `'${dataUrl(transpilar(rutaDependencia))}'`)
  }
  return import(dataUrl(js))
}

const migration = read('supabase/migrations/20260910183632_rag_centralizado_jornada_zonal_v1.sql')
const page = read('src/pages/BandejaRagZonal.tsx')
const accessPage = read('src/pages/AdminAccesos.tsx')
const accessApi = read('netlify/functions/admin-accesos.ts')
const liveGates = read('scripts/live-isolation/gates-1-3.mjs')
const e2e = read('e2e/critical-flows.spec.mjs')

/** El cuerpo sin comentarios: una regla citada en un comentario no es la regla. */
function sinComentarios(sql) {
  return sql.replace(/^\s*--.*$/gm, '')
}

function definicion(patron, mensaje) {
  const encontrada = migration.match(patron)?.[0]
  assert.ok(encontrada, mensaje)
  return encontrada
}

// --- 1. La ventana es configuración de la zona ------------------------------

const alterZonas = definicion(
  /ALTER TABLE public\.zonas\n {2}ADD COLUMN rag_jornada_inicio[\s\S]*?;/,
  'falta la ventana de recepción en zonas',
)
assert.match(alterZonas, /rag_jornada_inicio time NOT NULL DEFAULT '08:00'/)
assert.match(alterZonas, /rag_jornada_corte {2}time NOT NULL DEFAULT '12:00'/)
assert.match(
  alterZonas,
  /CHECK \(rag_jornada_inicio < rag_jornada_corte\)/,
  'sin el orden garantizado, una zona podría cerrar antes de abrir',
)

// --- 2. Una sola fuente decide a qué jornada pertenece un momento ------------

const jornadaFn = definicion(
  /CREATE OR REPLACE FUNCTION noven_private\.jornada_rag_zonal_v1\([\s\S]*?\n\$\$;/,
  'falta la función de jornada zonal',
)
const jornadaCuerpo = sinComentarios(jornadaFn)
assert.match(jornadaCuerpo, /AT TIME ZONE 'America\/Argentina\/Buenos_Aires'/)
assert.match(
  jornadaCuerpo,
  />=\s*z\.rag_jornada_corte[\s\S]*?::date \+ 1/,
  'desde el corte, la solicitud pertenece a la jornada siguiente',
)
assert.doesNotMatch(
  jornadaCuerpo,
  /rag_jornada_inicio/,
  'el inicio decide cuándo se ve, no a qué jornada pertenece: una carga previa es del mismo día',
)

// --- 3. La jornada asignada es parte del snapshot inmutable -----------------

assert.match(
  migration,
  /ALTER TABLE public\.solicitudes_cambio_rag\n {2}ADD COLUMN jornada_zonal date;/,
)
assert.match(
  migration,
  /ALTER COLUMN jornada_zonal SET NOT NULL/,
  'una jornada nula volvería a fundir «sin asignar» con «asignada a hoy»',
)
const relleno = definicion(
  /DISABLE TRIGGER solicitudes_cambio_rag_inmutables[\s\S]*?ENABLE TRIGGER solicitudes_cambio_rag_inmutables;/,
  'el relleno tiene que suspender y restablecer el bloqueo de inmutabilidad',
)
assert.match(
  relleno,
  /SET jornada_zonal = noven_private\.jornada_rag_zonal_v1\(s\.zona_id, s\.creada_at\)/,
  'la reconstrucción usa la misma regla sobre un hecho ya registrado, no un valor inventado',
)

// --- 4. La vista conserva su ACL y vuelve a fijar security_invoker ----------

const vista = definicion(
  /CREATE OR REPLACE VIEW public\.v_solicitudes_cambio_rag_actual[\s\S]*?ultimo ON true;/,
  'falta la proyección de estado con la jornada',
)
assert.doesNotMatch(
  vista,
  /SELECT\s+s\.\*/,
  'con s.* la columna nueva cae en el medio y CREATE OR REPLACE deja de ser posible',
)
assert.match(vista, /s\.jornada_zonal\nFROM public\.solicitudes_cambio_rag s/)
assert.match(
  migration,
  /ALTER VIEW public\.v_solicitudes_cambio_rag_actual\n {2}SET \(security_invoker = true\);/,
  'CREATE OR REPLACE conserva la ACL pero pierde las reloptions: sin esto la vista deja de aislar',
)
assert.match(migration, /GRANT SELECT ON TABLE public\.v_solicitudes_cambio_rag_actual TO authenticated;/)
assert.match(
  migration,
  /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER\n {2}ON TABLE public\.v_solicitudes_cambio_rag_actual FROM authenticated;/,
  'los privilegios por defecto del proyecto dan más de lo necesario sobre una relación nueva',
)

// --- 5. El corte de visibilidad tiene sus dos mitades -----------------------

const bandeja = definicion(
  /CREATE OR REPLACE FUNCTION noven_private\.listar_bandeja_rag_zonal_impl\(\)[\s\S]*?\n\$\$;/,
  'falta la bandeja zonal con jornada',
)
const bandejaCuerpo = sinComentarios(bandeja)
assert.match(
  bandejaCuerpo,
  /s\.jornada_zonal < j\.hoy\s*\n\s*OR \(s\.jornada_zonal = j\.hoy AND j\.jornada_visible IS NOT NULL\)/,
  'faltan las dos mitades: el pendiente viejo se ve siempre y el de hoy espera al inicio',
)
assert.match(
  bandejaCuerpo,
  /WHEN v_local::time >= za\.rag_jornada_inicio THEN v_local::date\s*\n\s*ELSE NULL\s*\n\s*END AS jornada_visible/,
)
assert.match(
  bandejaCuerpo,
  /WHEN v_local::time >= za\.rag_jornada_corte THEN v_local::date \+ 1/,
)
assert.match(
  bandejaCuerpo,
  /v_local::time >= za\.rag_jornada_inicio\s*\n\s*AND v_local::time < za\.rag_jornada_corte\s*\n\s*\) AS ventana_abierta/,
)
assert.match(
  bandejaCuerpo,
  /ORDER BY\s*\n\s*v\.sucursal_codigo,\s*\n\s*v\.sector_nombre,\s*\n\s*v\.familia_nombre,\s*\n\s*v\.fin_accion,\s*\n\s*v\.creada_at/,
  'una solicitud nueva se inserta dentro del bloque de su sucursal, no al final',
)

// --- 6. No se ejecuta lo que todavía no corresponde ver ---------------------

const ejecutar = definicion(
  /CREATE OR REPLACE FUNCTION noven_private\.ejecutar_solicitud_cambio_rag_impl\([\s\S]*?\n\$\$;/,
  'falta la ejecución individual',
)
const ejecutarCuerpo = sinComentarios(ejecutar)
assert.match(
  ejecutarCuerpo,
  /jornada zonal que todavía no está abierta/,
  'sin este rechazo el corte sería sólo una decisión de pantalla',
)
const posicionIdempotencia = ejecutarCuerpo.indexOf("IF v_ultimo.tipo = 'ejecutada' THEN")
const posicionGuarda = ejecutarCuerpo.indexOf('jornada zonal que todavía no está abierta')
assert.ok(posicionIdempotencia > 0 && posicionGuarda > 0)
assert.ok(
  posicionIdempotencia < posicionGuarda,
  'el reintento de algo ya ejecutado tiene que responder antes del corte, o un retry tardío fallaría',
)

// --- 7. Un solo instante gobierna la fila y su jornada ----------------------

const solicitar = definicion(
  /CREATE OR REPLACE FUNCTION noven_private\.solicitar_cambio_rag_impl\([\s\S]*?\n\$\$;/,
  'falta la creación de la solicitud',
)
const solicitarCuerpo = sinComentarios(solicitar)
assert.match(solicitarCuerpo, /v_creada_at := clock_timestamp\(\);/)
assert.match(
  solicitarCuerpo,
  /v_jornada_zonal := noven_private\.jornada_rag_zonal_v1\(v_zona_id, v_creada_at\);/,
  'si la fila y su jornada tomaran dos instantes distintos podrían caer a lados distintos del corte',
)
assert.match(solicitarCuerpo, /creada_at,\n {4}jornada_zonal\n {2}\) VALUES/)
assert.doesNotMatch(
  solicitarCuerpo,
  /p_jornada|p_inicio|p_corte/,
  'la jornada no llega desde el cliente',
)

// --- 8. ACL de lo agregado --------------------------------------------------

assert.match(
  migration,
  /REVOKE ALL ON FUNCTION noven_private\.jornada_rag_zonal_v1\(uuid, timestamptz\)\n {2}FROM PUBLIC, anon, authenticated, service_role;/,
)
assert.doesNotMatch(
  migration,
  /GRANT EXECUTE ON FUNCTION noven_private\.jornada_rag_zonal_v1/,
  'la regla de jornada no es superficie de nadie: se alcanza por las RPC que la usan',
)
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.configurar_jornada_rag_zonal_v1\(uuid, uuid, time, time\)\n {2}TO service_role;/,
)
assert.doesNotMatch(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.configurar_jornada_rag_zonal_v1\(uuid, uuid, time, time\)\n {2}TO authenticated/,
  'configurar la ventana pasa por la Function administrativa, no por el browser',
)
const configurar = definicion(
  /CREATE OR REPLACE FUNCTION public\.configurar_jornada_rag_zonal_v1\([\s\S]*?\n\$\$;/,
  'falta la RPC de configuración de jornada',
)
assert.match(configurar, /es_administrador_jerarquia_v1\(p_actor_id, v_org\)/)
assert.match(configurar, /IF p_inicio >= p_corte THEN/)

// --- 9. La superficie de cliente ------------------------------------------

assert.match(accessApi, /accion === 'jornada'/)
assert.match(accessApi, /configurar_jornada_rag_zonal_v1/)
assert.match(accessPage, /accion: 'jornada'/)
assert.doesNotMatch(
  page,
  /configurar_jornada_rag_zonal|rag_jornada_inicio/,
  'la administrativa lee su ventana, no la edita desde la bandeja',
)
assert.match(page, /Exportar toda la zona/)
assert.match(page, /Exportar sucursal/)
assert.match(page, /Marcar Activo/)
assert.match(e2e, /waitForEvent\('download'\)/)
assert.match(liveGates, /Gate 5: la jornada zonal esconde lo diferido/)
// Un fixture puede sembrar un estado que el circuito no sabe producir, y ahi la
// prueba deja de probar el sistema. Dos invariantes del esquema que el fixture
// tiene que respetar, y que sólo se descubrían corriendo el gate contra una base
// real —es decir, gastando un ciclo de CI entero por cada uno—.
//
// La primera: el CHECK no admite una jornada anterior a la fecha de creacion,
// asi que la solicitud de una jornada anterior tiene que traer tambien su
// `creada_at` de ese dia.
assert.match(
  liveGates,
  /creada_at: `\$\{fechaArgentina\(-1\)\}T\d{2}:\d{2}:\d{2}Z`,\n\s*jornada_zonal: fechaArgentina\(-1\)/,
  'una solicitud sembrada en una jornada anterior tiene que haberse creado ese dia',
)
assert.match(liveGates, /deferred request was executed/)
assert.match(liveGates, /request of an unopened journey was executed/)

// La segunda: `solicitudes_cambio_rag_porcentaje_escala_fk` exige que todo
// porcentaje pertenezca a la escala de la organizacion. Sembrar uno que no esta
// en la escala que el propio fixture carga es un error que no se ve leyendo el
// archivo.
const escalaSembrada = new Set(
  [...liveGates.matchAll(/escalon: \d+, porcentaje: (\d+)/g)].map((m) => m[1]),
)
assert.ok(escalaSembrada.size > 0, 'el gate vivo tiene que sembrar una escala RAG')
for (const [, porcentaje] of liveGates.matchAll(
  /porcentaje_(?:solicitado|rag_vigente): (\d+)/g,
)) {
  assert.ok(
    escalaSembrada.has(porcentaje),
    `el gate vivo siembra ${porcentaje}% fuera de la escala que él mismo carga: ` +
      'la FK contra rag_escala_descuento lo rechaza',
  )
}

// --- 10. Orden y agrupación, ejecutados de verdad ---------------------------

const {
  agruparPorSucursal,
  construirHojaExportacion,
  ENCABEZADOS_EXPORTACION,
  exportarBandejaXlsx,
  nombreArchivoExportacion,
  ordenarSolicitudes,
} = await importarTs('src/lib/bandeja-rag-zonal.ts', { './xlsx': 'src/lib/xlsx.ts' })

function solicitud(parcial) {
  return {
    id: parcial.id,
    zona_id: 'zona-1',
    zona_nombre: 'Santa Cruz Sur',
    sucursal_id: parcial.sucursal_id,
    sucursal_codigo: parcial.sucursal_codigo,
    sucursal_nombre: `Sucursal ${parcial.sucursal_codigo}`,
    producto_codigo: parcial.producto_codigo ?? '1000001',
    producto_descripcion: parcial.producto_descripcion ?? 'PRODUCTO',
    sector_nombre: parcial.sector_nombre ?? 'ALMACEN',
    familia_nombre: parcial.familia_nombre ?? 'CONSERVAS',
    porcentaje_rag_vigente: parcial.porcentaje_rag_vigente ?? 20,
    porcentaje_solicitado: parcial.porcentaje_solicitado ?? 30,
    fecha_vencimiento: '2026-09-20',
    fin_accion: parcial.fin_accion ?? '2026-09-10',
    cantidad_comprometida: parcial.cantidad_comprometida ?? 12,
    creada_at: parcial.creada_at ?? '2026-09-10T11:00:00Z',
    jornada_zonal: '2026-09-10',
    ultimo_evento: 'solicitada',
    ultimo_evento_at: '2026-09-10T11:00:00Z',
    habilitada_desde: null,
    estado_actual: 'solicitada',
    validada_por_nombre: 'Gerencia',
    requiere_ejecucion: true,
  }
}

// La llegada tardía es de la sucursal que va primero: si el orden fuera por
// llegada, quedaría al final y la administrativa tendría que volver atrás.
const tardiaEn043 = solicitud({
  id: 'tardia',
  sucursal_id: 's043',
  sucursal_codigo: '043',
  creada_at: '2026-09-10T11:59:00Z',
  fin_accion: '2026-09-12',
})
const temprana091 = solicitud({
  id: 'temprana',
  sucursal_id: 's091',
  sucursal_codigo: '091',
  creada_at: '2026-09-10T08:05:00Z',
})
const media043 = solicitud({
  id: 'media',
  sucursal_id: 's043',
  sucursal_codigo: '043',
  creada_at: '2026-09-10T09:00:00Z',
  fin_accion: '2026-09-11',
})

const ordenadas = ordenarSolicitudes([temprana091, tardiaEn043, media043])
assert.deepEqual(
  ordenadas.map((item) => item.id),
  ['media', 'tardia', 'temprana'],
  'el orden es sucursal, sector, familia y fin de acción; la llegada desempata al final',
)

const grupos = agruparPorSucursal([temprana091, tardiaEn043, media043])
assert.deepEqual(grupos.map((grupo) => grupo.sucursal_codigo), ['043', '091'])
assert.deepEqual(grupos[0].solicitudes.map((item) => item.id), ['media', 'tardia'])

// --- 11. El archivo se vuelve a abrir y coincide con la pantalla ------------

function leerZip(bytes) {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let fin = bytes.length - 22
  while (fin >= 0 && vista.getUint32(fin, true) !== 0x06054b50) fin -= 1
  assert.ok(fin >= 0, 'el archivo no termina en un End Of Central Directory')

  const cantidad = vista.getUint16(fin + 10, true)
  let cursor = vista.getUint32(fin + 16, true)
  const entradas = new Map()

  for (let i = 0; i < cantidad; i += 1) {
    assert.equal(vista.getUint32(cursor, true), 0x02014b50, 'cabecera central inválida')
    const metodo = vista.getUint16(cursor + 10, true)
    assert.equal(metodo, 0, 'el contenedor usa el método store')
    const crcEsperado = vista.getUint32(cursor + 16, true)
    const tamano = vista.getUint32(cursor + 24, true)
    const largoNombre = vista.getUint16(cursor + 28, true)
    const largoExtra = vista.getUint16(cursor + 30, true)
    const largoComentario = vista.getUint16(cursor + 32, true)
    const offsetLocal = vista.getUint32(cursor + 42, true)
    const nombre = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + largoNombre))

    assert.equal(vista.getUint32(offsetLocal, true), 0x04034b50, `cabecera local inválida en ${nombre}`)
    const largoNombreLocal = vista.getUint16(offsetLocal + 26, true)
    const largoExtraLocal = vista.getUint16(offsetLocal + 28, true)
    const inicio = offsetLocal + 30 + largoNombreLocal + largoExtraLocal
    const datos = bytes.subarray(inicio, inicio + tamano)

    // CRC32 independiente del escritor: si los offsets estuvieran corridos,
    // acá se leerían otros bytes y la suma no daría.
    let c = 0xffffffff
    for (let j = 0; j < datos.length; j += 1) {
      c ^= datos[j]
      for (let bit = 0; bit < 8; bit += 1) {
        c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
      }
    }
    assert.equal((c ^ 0xffffffff) >>> 0, crcEsperado, `CRC32 no coincide en ${nombre}`)

    entradas.set(nombre, new TextDecoder().decode(datos))
    cursor += 46 + largoNombre + largoExtra + largoComentario
  }
  return entradas
}

const zona = {
  id: 'zona-1',
  codigo: 'SCS',
  nombre: 'Santa Cruz Sur',
  organizacion_id: 'org-1',
  jornada_inicio: '08:00',
  jornada_corte: '12:00',
  jornada_visible: '2026-09-10',
  jornada_en_curso: '2026-09-10',
  ventana_abierta: true,
}

const exportacionZona = {
  zona,
  sucursal: null,
  solicitudes: [temprana091, tardiaEn043, media043],
}

const hoja = construirHojaExportacion(exportacionZona)
assert.deepEqual(hoja.encabezados, [...ENCABEZADOS_EXPORTACION])
assert.equal(hoja.encabezados.length, 13)
assert.ok(
  hoja.encabezados.includes('Vto producto') && hoja.encabezados.includes('Fin acción'),
  'las dos fechas van con nombres distintos; confundirlas es el error que la columna evita',
)
assert.deepEqual(
  hoja.filas.map((fila) => fila[0]),
  ['043 · Sucursal 043', '043 · Sucursal 043', '091 · Sucursal 091'],
  'exportar la zona conserva bloques consecutivos por sucursal',
)

const bytes = exportarBandejaXlsx(exportacionZona)
const partes = leerZip(bytes)
assert.deepEqual(
  [...partes.keys()],
  [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/worksheets/sheet1.xml',
  ],
  'faltan partes obligatorias del paquete OOXML',
)

const sheet = partes.get('xl/worksheets/sheet1.xml')
assert.match(sheet, /<row r="1">[\s\S]*?Sucursal[\s\S]*?Estado[\s\S]*?<\/row>/)
const ordenEnHoja = [...sheet.matchAll(/<t xml:space="preserve">(04|09)3?1? · Sucursal ([0-9]+)<\/t>/g)]
  .map((coincidencia) => coincidencia[2])
assert.deepEqual(ordenEnHoja, ['043', '043', '091'], 'el archivo no respeta el orden de la pantalla')
assert.match(
  sheet,
  /<c r="G2"><v>30<\/v><\/c>/,
  'el porcentaje viaja como número, no como texto: en Excel tiene que poder sumarse',
)
assert.match(partes.get('xl/workbook.xml'), /<sheet name="Zona SCS"/)
assert.equal(nombreArchivoExportacion(exportacionZona), 'rag-zona-scs-2026-09-10.xlsx')

const exportacionSucursal = {
  zona,
  sucursal: grupos[0],
  solicitudes: grupos[0].solicitudes,
}
assert.equal(nombreArchivoExportacion(exportacionSucursal), 'rag-sucursal-043-2026-09-10.xlsx')
const soloSucursal = leerZip(exportarBandejaXlsx(exportacionSucursal)).get('xl/worksheets/sheet1.xml')
assert.doesNotMatch(soloSucursal, /Sucursal 091/, 'exportar una sucursal no arrastra las demás')

console.log('✓ bloque 3B RAG: jornada configurable, corte de visibilidad y exportación .xlsx real')
