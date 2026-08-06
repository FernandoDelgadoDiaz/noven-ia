// ─── Parser del CSV de Reposición Asistida de Glaciar ─────────────────────────
//
// Lógica pura, sin React ni Supabase: todo lo que se puede razonar y testear
// sin tocar la red vive acá. El componente `src/pages/Importar.tsx` la consume.
//
// Contexto de la auditoría 2026-08-05: este parser alimenta stock_actual y
// venta_media_diaria, que son las dos entradas del motor de riesgo de merma.
// Un dato mal parseado en silencio miente durante semanas. Por eso nada se
// descarta sin dejar registro del motivo.

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EncodingDetectado = 'utf-8' | 'windows-1252'

export interface FilaParseada {
  /** Número de línea en el archivo original (1-indexado), para poder señalarla. */
  linea: number
  cod_art: string
  descripcion: string
  marca: string
  gramaje: string | null
  stockCsv: number
  ventaMediaCsv: number
  /** La celda de venta media vino vacía: se importa como 0 pero se avisa. */
  sinVentaMedia: boolean
}

export interface FilaDescartada {
  linea: number
  codArt: string
  motivo: string
  contenido: string
}

export interface MapaColumnas {
  codArt: number
  descripcion: number
  marca: number
  cont: number
  um: number
  stock: number
  ventaMedia: number
}

export interface ResultadoParser {
  filas: FilaParseada[]
  descartadas: FilaDescartada[]
  codigoFamilia: string | null
  columnas: MapaColumnas
  /** true si los índices se resolvieron por nombre de columna. */
  headerValidado: boolean
  /** true si no se encontró la línea de encabezado en todo el archivo. */
  headerAusente: boolean
  encabezados: string[]
  /** Columnas requeridas que no se pudieron resolver por nombre. */
  faltantes: string[]
}

/**
 * Orden de columnas histórico del reporte de Glaciar. Se usa solo como red de
 * seguridad cuando el encabezado existe pero no se puede resolver por nombre.
 */
export const COLUMNAS_POR_DEFECTO: MapaColumnas = {
  codArt: 0,
  descripcion: 1,
  marca: 2,
  cont: 4,
  um: 5,
  stock: 8,
  ventaMedia: 13,
}

// ─── Decodificación ───────────────────────────────────────────────────────────

/**
 * Glaciar exporta en Windows-1252. `File.text()` asume UTF-8 siempre y convierte
 * cada byte no-ASCII en U+FFFD, corrompiendo las descripciones de forma
 * permanente (en producción llegaron a guardarse 6 productos con "BA�O" por
 * "BAÑO"). Se intenta UTF-8 estricto y se cae a Windows-1252 ante la mínima
 * señal de que el archivo no era UTF-8.
 */
export function decodificarCsv(buffer: ArrayBuffer): {
  texto: string
  encoding: EncodingDetectado
} {
  try {
    const texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    // `fatal: true` ya rechaza secuencias inválidas, pero un archivo puede traer
    // un U+FFFD literal previamente corrompido: también amerita el fallback.
    if (!texto.includes('�')) return { texto, encoding: 'utf-8' }
  } catch {
    // No era UTF-8 válido: se resuelve abajo.
  }
  return {
    texto: new TextDecoder('windows-1252').decode(buffer),
    encoding: 'windows-1252',
  }
}

// ─── Parseo numérico (formato es-AR) ──────────────────────────────────────────

/**
 * Convierte una celda numérica de Glaciar a number.
 *
 * El parser anterior usaba `parseInt(raw, 10)` y `parseFloat(raw.replace(',', '.'))`.
 * Ambos corrompen valores en formato es-AR:
 *   parseInt("1.234")                   → 1      (corta en el punto)
 *   parseFloat("1.234,56".replace(...)) → 1.234  (replace cambia solo la 1ra coma)
 * Es un error de 1000x sobre valores que alimentan el cálculo de cobertura.
 *
 * Devuelve `null` cuando la celda está vacía o no es interpretable como número;
 * quien llama decide si eso es un descarte o un valor por defecto.
 */
export function parsearNumeroArg(raw: string): number | null {
  // U+00A0 (espacio duro) aparece como separador de miles en algunos exports.
  const limpio = raw.trim().replace(/[\s\u00a0]/g, '')
  if (limpio === '') return null

  let normalizado: string

  if (/^-?\d{1,3}(\.\d{3})+$/.test(limpio)) {
    // "1.234" / "12.345.678" → el punto es separador de miles.
    normalizado = limpio.replace(/\./g, '')
  } else if (limpio.includes(',')) {
    // Formato es-AR: los puntos son miles y la última coma es el decimal.
    const sinMiles = limpio.replace(/\./g, '')
    const ultimaComa = sinMiles.lastIndexOf(',')
    normalizado =
      sinMiles.slice(0, ultimaComa).replace(/,/g, '') + '.' + sinMiles.slice(ultimaComa + 1)
  } else {
    normalizado = limpio
  }

  const valor = Number(normalizado)
  return Number.isFinite(valor) ? valor : null
}

// ─── Normalización y similaridad de descripciones ─────────────────────────────

/**
 * Normaliza una descripción para comparar productos que son el mismo objeto
 * físico escrito distinto ("Turrocklets" vs "TURROCKLETS").
 * El U+FFFD se elimina para que una descripción corrompida ("BA�O") siga
 * matcheando con la sana ("BAÑO") y no genere un duplicado más.
 */
export function normalizarDescripcion(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/�/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Coeficiente de Dice sobre bigramas. Devuelve 0..1.
 * Elegido sobre Levenshtein porque tolera mejor las reordenaciones de palabras
 * ("ALFAJOR TRIPLE CHOCOLATE" vs "ALFAJOR CHOCOLATE TRIPLE") que son comunes
 * entre lo que carga un operador a mano y lo que exporta Glaciar.
 */
export function similaridad(a: string, b: string): number {
  const x = normalizarDescripcion(a)
  const y = normalizarDescripcion(b)
  if (x === y) return 1
  if (x.length < 2 || y.length < 2) return 0

  const bigramas = (s: string): Map<string, number> => {
    const m = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2)
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }

  const ma = bigramas(x)
  const mb = bigramas(y)
  let interseccion = 0
  let totalA = 0
  let totalB = 0
  for (const n of ma.values()) totalA += n
  for (const n of mb.values()) totalB += n
  for (const [g, n] of ma) interseccion += Math.min(n, mb.get(g) ?? 0)

  return (2 * interseccion) / (totalA + totalB)
}

/** Umbral a partir del cual dos descripciones se consideran el mismo producto. */
export const UMBRAL_SIMILARIDAD = 0.85

// ─── Resolución del encabezado ────────────────────────────────────────────────

function normalizarEncabezado(celda: string): string {
  return celda
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/�/g, '')
    .toLowerCase()
    .replace(/[.\s_]/g, '')
}

/**
 * Resuelve los índices de columna POR NOMBRE en vez de asumir un orden fijo.
 * El parser anterior leía campos[0], [1], [2], [4], [5], [8] y [13] a ciegas:
 * si Glaciar agregaba una columna, el importador escribía la venta media en el
 * stock sin avisar. Ahora un cambio de orden se detecta o se reporta.
 */
export function resolverColumnas(lineaHeader: string): {
  columnas: MapaColumnas
  encabezados: string[]
  faltantes: string[]
  validado: boolean
} {
  const encabezados = lineaHeader.split('\t').map((c) => c.trim())
  const norm = encabezados.map(normalizarEncabezado)

  const buscar = (pred: (h: string) => boolean): number => norm.findIndex(pred)

  const idxCodArt = buscar((h) => h.includes('cod') && h.includes('art'))
  const idxDesc = buscar((h) => h.includes('descripcion'))
  const idxMarca = buscar((h) => h.includes('marca'))
  const idxCont = buscar((h) => h.includes('cont'))
  const idxUm = buscar((h) => h === 'um' || h.includes('unidad'))
  const idxVenta = buscar((h) => h.includes('venta') && h.includes('media'))

  // Puede haber varias columnas con "stock"; la de sucursal es la que importa.
  const candidatosStock = norm
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.includes('stock'))
  const idxStock =
    candidatosStock.find(({ h }) => h.includes('suc'))?.i ?? candidatosStock[0]?.i ?? -1

  const faltantes: string[] = []
  if (idxCodArt === -1) faltantes.push('Cod.Art.')
  if (idxDesc === -1) faltantes.push('Descripción')
  if (idxStock === -1) faltantes.push('Stock Suc.')
  if (idxVenta === -1) faltantes.push('Venta Media')

  // Si no se resolvió NINGUNA columna requerida, el encabezado no tiene el
  // formato esperado: se cae al orden histórico y quien llama muestra el aviso.
  const resolvioAlguna =
    idxCodArt !== -1 || idxDesc !== -1 || idxStock !== -1 || idxVenta !== -1

  if (!resolvioAlguna) {
    return {
      columnas: COLUMNAS_POR_DEFECTO,
      encabezados,
      faltantes,
      validado: false,
    }
  }

  return {
    columnas: {
      codArt: idxCodArt,
      descripcion: idxDesc,
      marca: idxMarca,
      cont: idxCont,
      um: idxUm,
      stock: idxStock,
      ventaMedia: idxVenta,
    },
    encabezados,
    faltantes,
    validado: true,
  }
}

// ─── Parser principal ─────────────────────────────────────────────────────────

const FOOTER_PATTERNS = [
  'rptPedidosReposicionAsistida',
  'Usuario:',
  'Cant.Artículos',
  'Cant.Articulos',
  'Sucursal:',
  'Proveedor:',
]

export function parsearCsvGlaciar(textoCompleto: string): ResultadoParser {
  const lineas = textoCompleto.split(/\r?\n/)
  const filas: FilaParseada[] = []
  const descartadas: FilaDescartada[] = []

  // Código de familia en el bloque de encabezado del reporte.
  let codigoFamilia: string | null = null
  for (const linea of lineas.slice(0, 20)) {
    const match = linea.match(/C[oó]d\.Familia:\s*(\d+)/i)
    if (match) {
      codigoFamilia = match[1].trim()
      break
    }
  }

  // Localizar el encabezado y resolver los índices de columna.
  let idxHeader = -1
  for (let i = 0; i < lineas.length; i++) {
    if (normalizarEncabezado(lineas[i]).includes('codart')) {
      idxHeader = i
      break
    }
  }

  if (idxHeader === -1) {
    return {
      filas: [],
      descartadas: [],
      codigoFamilia,
      columnas: COLUMNAS_POR_DEFECTO,
      headerValidado: false,
      headerAusente: true,
      encabezados: [],
      faltantes: ['Cod.Art.', 'Descripción', 'Stock Suc.', 'Venta Media'],
    }
  }

  const { columnas, encabezados, faltantes, validado } = resolverColumnas(lineas[idxHeader])

  // Sin las columnas requeridas no se parsea nada: importar a ciegas es peor
  // que no importar.
  if (faltantes.length > 0 && validado) {
    return {
      filas: [],
      descartadas: [],
      codigoFamilia,
      columnas,
      headerValidado: true,
      headerAusente: false,
      encabezados,
      faltantes,
    }
  }

  const maxIndice = Math.max(columnas.codArt, columnas.descripcion, columnas.stock, columnas.ventaMedia)
  const vistos = new Map<string, number>()

  for (let i = idxHeader + 1; i < lineas.length; i++) {
    const linea = lineas[i]
    const nroLinea = i + 1
    if (linea.trim() === '') continue
    if (FOOTER_PATTERNS.some((p) => linea.includes(p))) continue

    const campos = linea.split('\t')
    const codArt = campos[columnas.codArt]?.trim() ?? ''

    if (campos.length <= maxIndice) {
      // Puede ser una línea de pie de página sin patrón conocido; solo se
      // reporta si arranca con algo que parece un código de artículo.
      if (/^\d{3,}/.test(codArt)) {
        descartadas.push({
          linea: nroLinea,
          codArt,
          motivo: 'fila con menos columnas de las esperadas',
          contenido: linea.slice(0, 120),
        })
      }
      continue
    }

    if (!/^\d{4,13}$/.test(codArt)) {
      if (codArt !== '') {
        descartadas.push({
          linea: nroLinea,
          codArt,
          motivo: 'cod_art con formato inesperado',
          contenido: linea.slice(0, 120),
        })
      }
      continue
    }

    const lineaPrevia = vistos.get(codArt)
    if (lineaPrevia !== undefined) {
      descartadas.push({
        linea: nroLinea,
        codArt,
        motivo: `cod_art duplicado en el CSV (ya aparecía en la línea ${lineaPrevia})`,
        contenido: linea.slice(0, 120),
      })
      continue
    }

    const stock = parsearNumeroArg(campos[columnas.stock] ?? '')
    if (stock === null) {
      descartadas.push({
        linea: nroLinea,
        codArt,
        motivo: 'stock vacío o no numérico',
        contenido: linea.slice(0, 120),
      })
      continue
    }

    // La venta media vacía NO descarta la fila: descartarla era lo que hacía
    // desaparecer productos reales de la importación sin que nadie se enterara.
    const ventaMediaRaw = parsearNumeroArg(campos[columnas.ventaMedia] ?? '')
    const sinVentaMedia = ventaMediaRaw === null

    const cont = columnas.cont >= 0 ? (campos[columnas.cont]?.trim() ?? '') : ''
    const um = columnas.um >= 0 ? (campos[columnas.um]?.trim() ?? '') : ''

    vistos.set(codArt, nroLinea)
    filas.push({
      linea: nroLinea,
      cod_art: codArt,
      descripcion: (columnas.descripcion >= 0 ? campos[columnas.descripcion]?.trim() : '') || codArt,
      marca: columnas.marca >= 0 ? (campos[columnas.marca]?.trim() ?? '') : '',
      gramaje: cont && um ? `${cont} ${um}` : null,
      stockCsv: Math.round(stock),
      ventaMediaCsv: ventaMediaRaw ?? 0,
      sinVentaMedia,
    })
  }

  return {
    filas,
    descartadas,
    codigoFamilia,
    columnas,
    headerValidado: validado,
    headerAusente: false,
    encabezados,
    faltantes,
  }
}
