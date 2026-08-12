import { cargar, eq, seccion, resumen } from './_helpers.mjs'

const m = await cargar('src/lib/importar-csv.ts')


seccion("parsearNumeroArg (formato es-AR)")
eq('vacio -> null', m.parsearNumeroArg(''), null)
eq('solo espacios -> null', m.parsearNumeroArg('   '), null)
eq('entero simple', m.parsearNumeroArg('169'), 169)
eq('decimal con coma', m.parsearNumeroArg('3,15'), 3.15)
eq('miles con punto (el bug de parseInt)', m.parsearNumeroArg('1.234'), 1234)
eq('miles + decimal (el bug de parseFloat)', m.parsearNumeroArg('1.234,56'), 1234.56)
eq('millones', m.parsearNumeroArg('12.345.678'), 12345678)
eq('decimal ingles', m.parsearNumeroArg('37.10'), 37.1)
eq('negativo', m.parsearNumeroArg('-5'), -5)
eq('no numerico -> null', m.parsearNumeroArg('N/D'), null)
eq('espacio duro como miles', m.parsearNumeroArg('1\u00a0234'), 1234)

seccion("similaridad / normalizacion")
eq('Turrocklets vs TURROCKLETS = 1', m.similaridad('Turrocklets', 'TURROCKLETS'), 1)
eq('mojibake supera el umbral', m.similaridad('ALFAJOR C/BA'+String.fromCharCode(0xFFFD)+'O AZUCAR X 6', 'ALFAJOR C/BAÑO AZUCAR X 6') >= m.UMBRAL_SIMILARIDAD, true)
eq('productos distintos < umbral', m.similaridad('Papas fritas clasicas', 'Nachos sabor queso') < 0.85, true)
eq('acentos ignorados', m.similaridad('Papas fritas clásicas', 'PAPAS FRITAS CLASICAS'), 1)

seccion("decodificarCsv")
// 0xD1 = Ñ en Windows-1252, secuencia invalida en UTF-8
const latin1 = Buffer.from([0x42, 0x41, 0xd1, 0x4f]) // "BAÑO"
const r1 = m.decodificarCsv(latin1.buffer.slice(latin1.byteOffset, latin1.byteOffset + latin1.length))
eq('latin-1 detectado', r1.encoding, 'windows-1252')
eq('latin-1 decodificado bien', r1.texto, 'BAÑO')
const utf8 = Buffer.from('BAÑO', 'utf8')
const r2 = m.decodificarCsv(utf8.buffer.slice(utf8.byteOffset, utf8.byteOffset + utf8.length))
eq('utf-8 detectado', r2.encoding, 'utf-8')
eq('utf-8 decodificado bien', r2.texto, 'BAÑO')

seccion("parsearCsvGlaciar")
const T = '\t'
const csv = [
  'rptPedidosReposicionAsistida',
  'Sucursal: 001',
  'Cód.Familia: 003  GOLOSINAS Y CHOCOLATES',
  '',
  ['Cod.Art.','Descripción','Marca','Rubro','Cont.','U.M.','Prov.','Costo','Stock Suc.','x','y','z','w','Venta Media'].join(T),
  ['3328533','TURROCKLETS','ARCOR','GOL','25','GR','P','10','169','','','','','3,15'].join(T),
  ['0022354','TURRON DE MANI ARCOR','ARCOR','GOL','x','GR','P','10','1.234','','','','','37,10'].join(T),
  ['2651142','CHOCOLATE TRES SUEÑOS','ARCOR','GOL','','','P','10','35','','','','','0,19'].join(T),
  ['9999999','PRODUCTO SIN VENTA MEDIA','X','GOL','','','P','10','50','','','','',''].join(T),
  ['8888888','PRODUCTO SIN STOCK','X','GOL','','','P','10','','','','','','1,5'].join(T),
  ['3328533','TURROCKLETS DUPLICADO','ARCOR','GOL','25','GR','P','10','999','','','','','9,99'].join(T),
  ['ABC123','COD ART INVALIDO','X','GOL','','','P','10','5','','','','','1'].join(T),
  'Cant.Articulos: 7',
].join('\r\n')

const r = m.parsearCsvGlaciar(csv)
eq('familia detectada', r.codigoFamilia, '003')
eq('header validado por nombre', r.headerValidado, true)
eq('sin columnas faltantes', r.faltantes, [])
eq('indice de stock resuelto por nombre', r.columnas.stock, 8)
eq('indice de venta media resuelto', r.columnas.ventaMedia, 13)
eq('filas aceptadas', r.filas.length, 4)
eq('stock con separador de miles', r.filas.find(f=>f.cod_art==='0022354').stockCsv, 1234)
eq('venta media con coma', r.filas.find(f=>f.cod_art==='3328533').ventaMediaCsv, 3.15)
eq('gramaje compuesto', r.filas.find(f=>f.cod_art==='3328533').gramaje, '25 GR')
eq('gramaje ausente -> null', r.filas.find(f=>f.cod_art==='2651142').gramaje, null)
eq('sin venta media se importa como 0', r.filas.find(f=>f.cod_art==='9999999').ventaMediaCsv, 0)
eq('sin venta media se marca', r.filas.find(f=>f.cod_art==='9999999').sinVentaMedia, true)
eq('descartadas', r.descartadas.length, 3)
eq('motivos de descarte', r.descartadas.map(d=>d.motivo).sort(), [
  'cod_art con formato inesperado',
  'cod_art duplicado en el CSV (ya aparecía en la línea 6)',
  'stock vacío o no numérico',
])

seccion("header ausente / columnas faltantes")
const sinHeader = m.parsearCsvGlaciar('linea1\nlinea2\n')
eq('header ausente detectado', sinHeader.headerAusente, true)
const headerIncompleto = m.parsearCsvGlaciar(['Cod.Art.'+T+'Descripción'+T+'Marca','1234'+T+'X'+T+'Y'].join('\n'))
eq('faltantes reportadas', headerIncompleto.faltantes, ['Stock Suc.','Venta Media'])
eq('no parsea filas sin columnas requeridas', headerIncompleto.filas.length, 0)

seccion("orden de columnas alterado (Glaciar agrega una columna)")
const csvReordenado = [
  'Cód.Familia: 014',
  ['NUEVA','Cod.Art.','Descripción','Marca','Cont.','U.M.','Stock Suc.','Venta Media'].join(T),
  ['x','3328533','TURROCKLETS','ARCOR','25','GR','169','3,15'].join(T),
].join('\n')
const rr = m.parsearCsvGlaciar(csvReordenado)
eq('resuelve indices corridos', rr.columnas.codArt, 1)
eq('stock correcto pese al corrimiento', rr.filas[0]?.stockCsv, 169)
eq('venta media correcta pese al corrimiento', rr.filas[0]?.ventaMediaCsv, 3.15)

process.exit(resumen() === 0 ? 0 : 1)
