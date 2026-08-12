import { cargar, eq, seccion, resumen } from './_helpers.mjs'

const m = await cargar('src/lib/importar-csv.ts')


const T='\t'
// Encabezado EXACTO del reporte real, con los indices que dio el diagnostico.
const fila = (pares) => { const a=Array(17).fill(''); for(const [i,v] of pares) a[i]=v; return a.join(T) }

const HEADER_L18 = fila([[6,'Fec.'],[7,'Mín'],[8,'Stock'],[9,'Stock'],[10,'Stock'],[11,'Stock'],[13,'Venta'],[14,'Stk'],[16,'Cant.']])
const HEADER_L19 = fila([[0,'Cod.Art.'],[1,'Descripción'],[2,'Marca'],[3,'Bto'],[4,'Cont'],[5,'U/M'],[6,'Disc.'],[7,'Form'],[8,'Suc.'],[9,'Proc.'],[10,'Trans.'],[11,'CDR'],[12,'Ins'],[13,'Media'],[14,'Mín'],[15,'Rot.'],[16,'Sug.']])
// Fila de datos real: stock en indice 8, venta media en indice 13.
const DATO = fila([[0,'3328533'],[1,'TURROCKLETS'],[2,'ARCOR'],[3,'1'],[4,'25'],[5,'GR'],[6,'0'],[7,'0'],[8,'169'],[9,'0'],[10,'0'],[11,'0'],[12,'0'],[13,'3,15'],[14,'10'],[15,'0'],[16,'0']])
const DATO2 = fila([[0,'0022354'],[1,'TURRON DE MANI ARCOR'],[2,'ARCOR'],[4,'20'],[5,'GR'],[8,'1.234'],[13,'37,10']])

const CSV = [
  'rptPedidosReposicionAsistida','Usuario: gerente091','Sucursal: 001','Cód.Familia: 003  GOLOSINAS Y CHOCOLATES','',
  HEADER_L18, HEADER_L19, DATO, DATO2, 'Cant.Articulos: 2',
].join('\r\n')

seccion("HEADER EN DOS LINEAS (el archivo real)")
const r = m.parsearCsvGlaciar(CSV)
eq('header NO ausente', r.headerAusente, false)
eq('header validado por nombre', r.headerValidado, true)
eq('SIN columnas faltantes (era la regresion)', r.faltantes, [])
eq('indice de stock = 8', r.columnas.stock, 8)
eq('indice de venta media = 13', r.columnas.ventaMedia, 13)
eq('indice de cod_art = 0', r.columnas.codArt, 0)
eq('indice de descripcion = 1', r.columnas.descripcion, 1)
eq('indice de U/M = 5 (antes no matcheaba)', r.columnas.um, 5)
eq('indice de Cont = 4', r.columnas.cont, 4)
eq('nombre combinado del indice 8', r.encabezados[8], 'Stock Suc.')
eq('nombre combinado del indice 13', r.encabezados[13], 'Venta Media')
eq('nombre del indice 1 (solo linea de abajo)', r.encabezados[1], 'Descripción')

seccion("LECTURA DE UNA FILA DE DATOS REAL")
eq('filas parseadas', r.filas.length, 2)
const t = r.filas.find(f=>f.cod_art==='3328533')
eq('stock leido del indice 8', t?.stockCsv, 169)
eq('venta media leida del indice 13', t?.ventaMediaCsv, 3.15)
eq('descripcion', t?.descripcion, 'TURROCKLETS')
eq('marca', t?.marca, 'ARCOR')
eq('gramaje desde Cont + U/M', t?.gramaje, '25 GR')
const t2 = r.filas.find(f=>f.cod_art==='0022354')
eq('stock con separador de miles', t2?.stockCsv, 1234)
eq('venta media con coma decimal', t2?.ventaMediaCsv, 37.1)
eq('sin descartes espurios', r.descartadas.length, 0)
eq('familia detectada', r.codigoFamilia, '003')

seccion("EL MISMO ARCHIVO EN WINDOWS-1252")
// cp1252: 'ó' = 0xF3. Se codifica el CSV entero a cp1252 byte a byte.
const CP1252 = { 'ó':0xF3, 'á':0xE1, 'é':0xE9, 'í':0xED, 'ú':0xFA, 'ñ':0xF1, 'Ñ':0xD1, 'Á':0xC1, 'É':0xC9, 'Í':0xCD, 'Ó':0xD3, 'Ú':0xDA }
const bytes = []
for (const ch of CSV) {
  if (CP1252[ch] !== undefined) bytes.push(CP1252[ch])
  else if (ch.charCodeAt(0) < 256) bytes.push(ch.charCodeAt(0))
  else bytes.push(0x3F)
}
const buf = Uint8Array.from(bytes)
const dec = m.decodificarCsv(buf.buffer)
eq('encoding detectado', dec.encoding, 'windows-1252')
eq('tilde recuperada en Descripcion', dec.texto.includes('Descripción'), true)
eq('sin caracter de reemplazo', dec.texto.includes('\uFFFD'), false)

const r2 = m.parsearCsvGlaciar(dec.texto)
eq('cp1252: sin columnas faltantes', r2.faltantes, [])
eq('cp1252: indice de stock = 8', r2.columnas.stock, 8)
eq('cp1252: indice de venta media = 13', r2.columnas.ventaMedia, 13)
eq('cp1252: stock leido', r2.filas.find(f=>f.cod_art==='3328533')?.stockCsv, 169)
eq('cp1252: venta media leida', r2.filas.find(f=>f.cod_art==='3328533')?.ventaMediaCsv, 3.15)
eq('cp1252: familia detectada', r2.codigoFamilia, '003')

seccion("cp1252 mal decodificado como UTF-8: el matcheo debe fallar")
// Demuestra por que la deteccion de encoding es condicion necesaria.
const malDecodificado = new TextDecoder('utf-8').decode(buf)
const r3 = m.parsearCsvGlaciar(malDecodificado)
eq('con mojibake, "Descripción" NO matchea por nombre', r3.encabezados[1] !== 'Descripción', true)
console.log(`      (encabezado corrupto: ${JSON.stringify(r3.encabezados[1])})`)
eq('pero stock y venta media igual se resuelven', [r3.columnas.stock, r3.columnas.ventaMedia], [8,13])

seccion("header en UNA sola linea sigue funcionando")
const UNA = [
  'Cód.Familia: 014',
  ['Cod.Art.','Descripción','Marca','Bto','Cont','U/M','a','b','Stock Suc.','c','d','e','f','Venta Media'].join(T),
  fila([[0,'1111111'],[1,'PROD'],[2,'M'],[4,'10'],[5,'GR'],[8,'50'],[13,'1,5']]),
].join('\n')
const r4 = m.parsearCsvGlaciar(UNA)
eq('una linea: sin faltantes', r4.faltantes, [])
eq('una linea: stock', r4.filas[0]?.stockCsv, 50)
eq('una linea: venta media', r4.filas[0]?.ventaMediaCsv, 1.5)

process.exit(resumen() === 0 ? 0 : 1)
