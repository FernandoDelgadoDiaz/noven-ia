import { decodificarCsv, parsearNumeroArg, type EncodingDetectado } from './importar-csv'

export interface Fila0258 {
  linea: number
  cod_art: string
  descripcion: string
  marca: string
  contenido: string
  unidad_medida: string
  bulto: number | null
  dto_sec_fam: string | null
  costo_unitario: number | null
  costo_final: number | null
  precio_sugerido: number | null
  precio_venta: number | null
  stock_transito: number
  stock: number
  per_ant_3: number
  per_ant_2: number
  per_ant_1: number
  ultimo_periodo: number
  venta_media_diaria: number
}

export interface Resultado0258 {
  filas: Fila0258[]
  descartadas: Array<{ linea: number; motivo: string; contenido: string }>
  encabezados: string[]
  faltantes: string[]
  codigoDepartamento: string | null
  codigoSector: string | null
  codigoFamilia: string | null
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function separar(linea: string): string[] {
  return linea.split('|').map((v) => v.trim())
}

function metadata(texto: string, etiqueta: RegExp): string | null {
  for (const linea of texto.split(/\r?\n/).slice(0, 40)) {
    const m = linea.match(etiqueta)
    if (m?.[1]) return m[1].trim().padStart(3, '0')
  }
  return null
}

export function parsear0258(texto: string): Resultado0258 {
  const lineas = texto.split(/\r?\n/)
  const idxHeader = lineas.findIndex((l) => {
    const n = separar(l).map(normalizar)
    return n.includes('codart') && n.includes('vtamedia') && n.includes('costounit')
  })

  const vacio: Resultado0258 = {
    filas: [], descartadas: [], encabezados: [], faltantes: ['Cód.Art.', 'Stock', 'Vta.Media'],
    codigoDepartamento: metadata(texto, /C[oó]d(?:igo)?\.?\s*Departamento\s*:?\s*(\d+)/i),
    codigoSector: metadata(texto, /C[oó]d(?:igo)?\.?\s*Sector\s*:?\s*(\d+)/i),
    codigoFamilia: metadata(texto, /C[oó]d(?:igo)?\.?\s*Familia\s*:?\s*(\d+)/i),
  }
  if (idxHeader < 0) return vacio

  const encabezados = separar(lineas[idxHeader])
  const norm = encabezados.map(normalizar)
  const indice = (nombre: string) => norm.indexOf(nombre)
  const requerido = ['codart', 'descripcion', 'marca', 'cont', 'um', 'costounit', 'costofinal', 'stock', 'perant3', 'perant2', 'perant1', 'ultper', 'vtamedia']
  const faltantes = requerido.filter((r) => indice(r) < 0)
  const resultado: Resultado0258 = { ...vacio, encabezados, faltantes }
  if (faltantes.length) return resultado

  for (let i = idxHeader + 1; i < lineas.length; i++) {
    if (!lineas[i].trim()) continue
    const c = separar(lineas[i])
    const cod = c[indice('codart')] ?? ''
    if (!/^\d{7}$/.test(cod)) {
      resultado.descartadas.push({ linea: i + 1, motivo: 'Cód.Art. inválido', contenido: lineas[i] })
      continue
    }
    const numero = (nombre: string, porDefecto: number | null = null) => parsearNumeroArg(c[indice(nombre)] ?? '') ?? porDefecto
    const stock = numero('stock')
    const vmd = numero('vtamedia')
    if (stock === null || vmd === null) {
      resultado.descartadas.push({ linea: i + 1, motivo: stock === null ? 'Stock inválido' : 'Vta.Media inválida', contenido: lineas[i] })
      continue
    }
    resultado.filas.push({
      linea: i + 1,
      cod_art: cod,
      descripcion: c[indice('descripcion')] ?? '',
      marca: c[indice('marca')] ?? '',
      contenido: c[indice('cont')] ?? '',
      unidad_medida: c[indice('um')] ?? '',
      bulto: numero('bto'),
      dto_sec_fam: indice('dtosecfam') >= 0 ? (c[indice('dtosecfam')] || null) : null,
      costo_unitario: numero('costounit'),
      costo_final: numero('costofinal'),
      precio_sugerido: indice('preciosug') >= 0 ? numero('preciosug') : null,
      precio_venta: indice('preciovta') >= 0 ? numero('preciovta') : null,
      stock_transito: indice('stktransito') >= 0 ? numero('stktransito', 0) ?? 0 : 0,
      stock,
      per_ant_3: numero('perant3', 0) ?? 0,
      per_ant_2: numero('perant2', 0) ?? 0,
      per_ant_1: numero('perant1', 0) ?? 0,
      ultimo_periodo: numero('ultper', 0) ?? 0,
      venta_media_diaria: vmd,
    })
  }
  return resultado
}

export function decodificarYParsear0258(buffer: ArrayBuffer): Resultado0258 & { encoding: EncodingDetectado } {
  const { texto, encoding } = decodificarCsv(buffer)
  return { ...parsear0258(texto), encoding }
}
