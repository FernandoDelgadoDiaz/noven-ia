// Escritor mínimo de .xlsx real, sin dependencias.
//
// El circuito pide un archivo que la administrativa pueda abrir en Excel, no un
// CSV renombrado. Un .xlsx es un ZIP con partes OOXML, así que acá viven las
// dos piezas: un contenedor ZIP «store» —sin compresión, que es un método
// válido y evita traer un deflate— y la hoja en XML con cadenas embebidas.
//
// Las cadenas van como `inlineStr` a propósito: evitan la tabla compartida y
// dejan cada celda legible dentro de la misma parte. Los números van como
// números; las fechas ya llegan formateadas como texto para no arrastrar
// estilos ni la ambigüedad del calendario 1900/1904.

export type CeldaXlsx = string | number | null

export interface HojaXlsx {
  nombre: string
  encabezados: string[]
  filas: CeldaXlsx[][]
}

const TABLA_CRC32 = (() => {
  const tabla = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let bit = 0; bit < 8; bit += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    tabla[i] = c >>> 0
  }
  return tabla
})()

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i += 1) {
    c = TABLA_CRC32[(c ^ datos[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function utf8(texto: string): Uint8Array {
  return new TextEncoder().encode(texto)
}

/**
 * XML 1.0 sólo admite tabulación, salto de línea y retorno de carro entre los
 * caracteres de control; cualquier otro invalida el archivo entero y Excel se
 * niega a abrirlo. Se filtra por código en vez de por expresión regular para no
 * escribir caracteres de control en el propio fuente.
 */
function sinControles(valor: string): string {
  let salida = ''
  for (const caracter of valor) {
    const codigo = caracter.codePointAt(0) ?? 0
    const permitido = codigo === 9 || codigo === 10 || codigo === 13 || codigo >= 32
    if (permitido) salida += caracter
  }
  return salida
}

function escaparXml(valor: string): string {
  return sinControles(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Nombre de columna de Excel: 1 es A, 27 es AA. */
export function columnaExcel(indice: number): string {
  let n = indice
  let nombre = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    nombre = String.fromCharCode(65 + resto) + nombre
    n = Math.floor((n - 1) / 26)
  }
  return nombre
}

/** Excel limita el nombre de hoja a 31 caracteres y prohíbe : \ / ? * [ ] */
export function nombreHojaValido(nombre: string): string {
  const limpio = nombre.replace(/[:\\/?*[\]]/g, ' ').trim()
  return (limpio || 'Hoja1').slice(0, 31)
}

function celdaXml(referencia: string, valor: CeldaXlsx): string {
  if (valor === null || valor === '') return ''
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return `<c r="${referencia}"><v>${valor}</v></c>`
  }
  return `<c r="${referencia}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(String(valor))}</t></is></c>`
}

function filaXml(numero: number, celdas: CeldaXlsx[]): string {
  const cuerpo = celdas
    .map((valor, indice) => celdaXml(`${columnaExcel(indice + 1)}${numero}`, valor))
    .join('')
  return `<row r="${numero}">${cuerpo}</row>`
}

export function hojaXml(hoja: HojaXlsx): string {
  const filas = [hoja.encabezados as CeldaXlsx[], ...hoja.filas]
    .map((celdas, indice) => filaXml(indice + 1, celdas))
    .join('')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${filas}</sheetData>` +
    '</worksheet>'
  )
}

export interface EntradaZip {
  nombre: string
  datos: Uint8Array
}

function escribirUint32(destino: Uint8Array, offset: number, valor: number): void {
  destino[offset] = valor & 0xff
  destino[offset + 1] = (valor >>> 8) & 0xff
  destino[offset + 2] = (valor >>> 16) & 0xff
  destino[offset + 3] = (valor >>> 24) & 0xff
}

function escribirUint16(destino: Uint8Array, offset: number, valor: number): void {
  destino[offset] = valor & 0xff
  destino[offset + 1] = (valor >>> 8) & 0xff
}

/**
 * ZIP con método 0 (store). La fecha se fija en el mínimo del formato DOS para
 * que dos exportaciones del mismo contenido produzcan bytes idénticos: sin eso
 * no habría forma de verificar el archivo en una prueba.
 */
export function construirZip(entradas: EntradaZip[]): Uint8Array {
  const locales: Uint8Array[] = []
  const centrales: Uint8Array[] = []
  let offset = 0

  for (const entrada of entradas) {
    const nombre = utf8(entrada.nombre)
    const suma = crc32(entrada.datos)
    const tamano = entrada.datos.length

    const local = new Uint8Array(30 + nombre.length + tamano)
    escribirUint32(local, 0, 0x04034b50)
    escribirUint16(local, 4, 20)
    escribirUint16(local, 6, 0x0800) // nombres en UTF-8
    escribirUint16(local, 8, 0) // store
    escribirUint16(local, 10, 0) // hora DOS
    escribirUint16(local, 12, 33) // fecha DOS: 1980-01-01
    escribirUint32(local, 14, suma)
    escribirUint32(local, 18, tamano)
    escribirUint32(local, 22, tamano)
    escribirUint16(local, 26, nombre.length)
    escribirUint16(local, 28, 0)
    local.set(nombre, 30)
    local.set(entrada.datos, 30 + nombre.length)
    locales.push(local)

    const central = new Uint8Array(46 + nombre.length)
    escribirUint32(central, 0, 0x02014b50)
    escribirUint16(central, 4, 20)
    escribirUint16(central, 6, 20)
    escribirUint16(central, 8, 0x0800)
    escribirUint16(central, 10, 0)
    escribirUint16(central, 12, 0)
    escribirUint16(central, 14, 33)
    escribirUint32(central, 16, suma)
    escribirUint32(central, 20, tamano)
    escribirUint32(central, 24, tamano)
    escribirUint16(central, 28, nombre.length)
    escribirUint16(central, 30, 0)
    escribirUint16(central, 32, 0)
    escribirUint16(central, 34, 0)
    escribirUint16(central, 36, 0)
    escribirUint32(central, 38, 0)
    escribirUint32(central, 42, offset)
    central.set(nombre, 46)
    centrales.push(central)

    offset += local.length
  }

  const tamanoCentral = centrales.reduce((total, parte) => total + parte.length, 0)
  const fin = new Uint8Array(22)
  escribirUint32(fin, 0, 0x06054b50)
  escribirUint16(fin, 4, 0)
  escribirUint16(fin, 6, 0)
  escribirUint16(fin, 8, entradas.length)
  escribirUint16(fin, 10, entradas.length)
  escribirUint32(fin, 12, tamanoCentral)
  escribirUint32(fin, 16, offset)
  escribirUint16(fin, 20, 0)

  const partes = [...locales, ...centrales, fin]
  const total = partes.reduce((suma, parte) => suma + parte.length, 0)
  const salida = new Uint8Array(total)
  let cursor = 0
  for (const parte of partes) {
    salida.set(parte, cursor)
    cursor += parte.length
  }
  return salida
}

export function construirXlsx(hoja: HojaXlsx): Uint8Array {
  const nombre = nombreHojaValido(hoja.nombre)

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '</Types>'

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${escaparXml(nombre)}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>'

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '</Relationships>'

  return construirZip([
    { nombre: '[Content_Types].xml', datos: utf8(contentTypes) },
    { nombre: '_rels/.rels', datos: utf8(rels) },
    { nombre: 'xl/workbook.xml', datos: utf8(workbook) },
    { nombre: 'xl/_rels/workbook.xml.rels', datos: utf8(workbookRels) },
    { nombre: 'xl/worksheets/sheet1.xml', datos: utf8(hojaXml(hoja)) },
  ])
}
