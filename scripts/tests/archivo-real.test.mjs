// ─── El archivo REAL de Glaciar, desde la línea 0 ─────────────────────────────
//
// Este fixture existe por una regresión que se escapó TRES veces seguidas. Las
// dos primeras correcciones fallaron porque los fixtures arrancaban cerca de la
// línea 18 y nunca incluían el bloque de parámetros L00-L10 — que es justamente
// donde vive la etiqueta de filtro 'Cod.Art.:', el ancla falsa que hacía que el
// parser jamás llegara al encabezado verdadero de L19.
//
// REGLA: cualquier fixture del importador arranca en L00 con el archivo completo.
// Un test que empieza en el encabezado no prueba la detección del encabezado.

import { cargar, eq, seccion, resumen, aCp1252 } from './_helpers.mjs'

const m = await cargar('src/lib/importar-csv.ts')

const T = '\t'
const L = (...c) => c.join(T)

const LINEAS = [
  /*L00*/ 'Parámetros del Listado de Pedido de Reposición Asistida',
  /*L01*/ '',
  /*L02*/ L('Grupo RA:', '1', 'Nro.Pedido:', '53008944', 'Cod.Suc.Padrón:', '091', 'x'),
  /*L03*/ L('Cód.Familia:', '003'),
  /*L04*/ L('Cód.Departamento:', '01', 'Cód.Sector:', '001', 'Cód.Categoría:', ''),
  /*L05*/ L('Cód.SubCategoría:', 'Cód.Segmento:', 'Nro. Insert:', ''),
  /*L06*/ L('Con Pedido:', 'Stock en Suc:', 'Stock en CDR:'),
  /*L07*/ L('Stock en Proceso:', 'Stock en Tránsito:', 'Venta Media:'),
  /*L08*/ 'Excluye artículos discontinuados',
  /*L09*/ L('Sólo artículos fuera del surtido', '', '', ''),
  /*L10*/ L('Período de Referencia Desde:', '06/08/2026', 'Período de Referencia Hasta:', '06/08/2026', 'Cod.Art.:'),
  /*L11*/ '',
  /*L12*/ '04/08/2026 - 19:24:40',
  /*L13*/ '',
  /*L14*/ 'S.A. IMP. Y EXP. DE LA PATAGONIA - Sucursal: 091',
  /*L15*/ 'Listado de Pedido de Reposición Asistida',
  /*L16*/ '',
  /*L17*/ '',
  /*L18*/ L('', '', '', '', '', '', 'Fec.', 'Mín', 'Stock', 'Stock', 'Stock', 'Stock', '', 'Venta', 'Stk', '', 'Cant.', 'Cant.', 'Cant.'),
  /*L19*/ L('Cod.Art.', 'Descripción', 'Marca', 'Bto', 'Cont', 'U/M', 'Disc.', 'Form', 'Suc.', 'Proc.', 'Trans.', 'CDR', 'Ins', 'Media', 'Mín', 'Rot.', 'Sug.', 'Btos.', 'Unid.'),
  /*L20*/ L('3514328', 'CHOCOLATE AMARGO 60 NARANJA', 'AGUILA', 'Un(100', '70', 'GR', '', '02', '5', '0', '0', '1540', 'N', '0.04', '4', 'C', '0', '0', '0'),
  /*L21*/ L('3197402', 'CHOCOLATE AMARGO 60%CACAO', 'AGUILA', '48', '100', 'GR', '', '02', '12', '0', '0', '800', 'N', '0,50', '4', 'C', '0', '0', '0'),
  /*L22*/ L('3328533', 'TURROCKLETS', 'ARCOR', 'Un(25', '25', 'GR', '', '02', '169', '0', '0', '300', 'N', '3,15', '10', 'A', '0', '0', '0'),
]
const CSV = LINEAS.join('\r\n')

seccion('T1 · ancla en L19, no en la falsa de L10')
const r = m.parsearCsvGlaciar(CSV)
eq('header no ausente', r.headerAusente, false)
eq('header validado por nombre', r.headerValidado, true)
eq('sin columnas faltantes', r.faltantes, [])
// Si hubiera anclado en L10, encabezados[0] sería 'Período de Referencia Desde:'.
eq('encabezado[0]', r.encabezados[0], 'Cod.Art.')
eq('encabezado[8] combinado L18+L19', r.encabezados[8], 'Stock Suc.')
eq('encabezado[13] combinado L18+L19', r.encabezados[13], 'Venta Media')
eq('ancho del header', r.encabezados.length, 19)
eq('índice cod_art', r.columnas.codArt, 0)
eq('índice stock', r.columnas.stock, 8)
eq('índice venta media', r.columnas.ventaMedia, 13)
eq('índice Cont', r.columnas.cont, 4)
eq('índice U/M', r.columnas.um, 5)

seccion('T2 · fila L20')
const f0 = r.filas.find((f) => f.cod_art === '3514328')
eq('descripción', f0?.descripcion, 'CHOCOLATE AMARGO 60 NARANJA')
eq('marca', f0?.marca, 'AGUILA')
eq('stock del índice 8', f0?.stockCsv, 5)
eq('venta media del índice 13', f0?.ventaMediaCsv, 0.04)
eq('gramaje = Cont + U/M', f0?.gramaje, '70 GR')

seccion('T3 · TURROCKLETS')
const t = r.filas.find((f) => f.cod_art === '3328533')
eq('stock', t?.stockCsv, 169)
eq('venta media con coma decimal', t?.ventaMediaCsv, 3.15)
eq('gramaje', t?.gramaje, '25 GR')

seccion('T4 · Cód.Familia desde L03')
eq('familia', r.codigoFamilia, '003')

seccion('T6 · sin descartes espurios')
eq('filas de datos', r.filas.length, 3)
eq('descartadas', r.descartadas.length, 0)

seccion('T5 · el mismo archivo en Windows-1252')
const buf = aCp1252(CSV)
const dec = m.decodificarCsv(buf.buffer)
eq('encoding detectado', dec.encoding, 'windows-1252')
eq('sin carácter de reemplazo', dec.texto.includes('�'), false)
eq('Descripción con tilde', dec.texto.includes('Descripción'), true)
eq('Cód.Familia con tilde', dec.texto.includes('Cód.Familia:'), true)

const r5 = m.parsearCsvGlaciar(dec.texto)
eq('cp1252: sin faltantes', r5.faltantes, [])
eq('cp1252: familia', r5.codigoFamilia, '003')
eq('cp1252: índice stock', r5.columnas.stock, 8)
eq('cp1252: índice venta media', r5.columnas.ventaMedia, 13)
eq('cp1252: descartadas', r5.descartadas.length, 0)
eq('cp1252: resultado idéntico a UTF-8', r5.filas, r.filas)

seccion('Ningún candidato resuelve → se reporta el ÚLTIMO, no el bloque de parámetros')
const sinResolver = m.parsearCsvGlaciar(
  [
    L('Período Desde:', '06/08/2026', 'Cod.Art.:'),
    '',
    L('Cod.Art.', 'Descripción', 'Marca'),
    L('3514328', 'CHOCO', 'AGUILA'),
  ].join('\n'),
)
eq('faltantes reportadas', sinResolver.faltantes, ['Stock Suc.', 'Venta Media'])
eq('encabezados del último candidato', sinResolver.encabezados, ['Cod.Art.', 'Descripción', 'Marca'])

process.exit(resumen() === 0 ? 0 : 1)
