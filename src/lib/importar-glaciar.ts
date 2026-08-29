import { parsearCsvGlaciar, type ResultadoParser } from './importar-csv'
import { parsear0258 } from './importar-0258'
import { extraerMetadataGlaciar, type MetadataGlaciar } from './glaciar-metadata'

export type ModoImportacionGlaciar = 'familia' | 'masiva'
export type FuenteImportacionGlaciar = 'reposicion_asistida' | '0258'

export interface AnalisisReporteGlaciar {
  parser: ResultadoParser
  metadata: MetadataGlaciar
  modo: ModoImportacionGlaciar
  fuente: FuenteImportacionGlaciar
  codigoSectorFuente: string | null
  /** Errores que impiden siquiera ofrecer el botón de confirmar importación. */
  erroresBloqueantes: string[]
}

export interface OpcionesAnalisisGlaciar {
  /**
   * `familia`: exige Cód.Familia y habilita aprendizaje/reconciliación asistida.
   * `masiva`: el ruteo sale del cod_art ya aprendido en el catálogo y por eso no
   * exige una familia global en el encabezado del archivo.
   */
  modo?: ModoImportacionGlaciar
}

function parece0258(textoCompleto: string): boolean {
  const primeraLineaUtil = textoCompleto.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  const normalizada = primeraLineaUtil
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return primeraLineaUtil.includes('|') && normalizada.includes('costo unit') && normalizada.includes('vta.media')
}

function parserDesde0258(textoCompleto: string): {
  parser: ResultadoParser
  metadata: MetadataGlaciar
  codigoSectorFuente: string | null
} {
  const r = parsear0258(textoCompleto)
  const parser: ResultadoParser = {
    filas: r.filas.map((f) => ({
      linea: f.linea,
      cod_art: f.cod_art,
      descripcion: f.descripcion,
      marca: f.marca,
      gramaje: [f.contenido, f.unidad_medida].filter(Boolean).join(' ') || null,
      stockCsv: f.stock,
      ventaMediaCsv: f.venta_media_diaria,
      sinVentaMedia: false,
    })),
    descartadas: r.descartadas.map((d) => ({
      linea: d.linea,
      codArt: '',
      motivo: d.motivo,
      contenido: d.contenido,
    })),
    codigoFamilia: r.codigoFamilia,
    columnas: {
      codArt: r.encabezados.findIndex((h) => /c[oó]d\.art\./i.test(h)),
      descripcion: r.encabezados.findIndex((h) => /descripci[oó]n/i.test(h)),
      marca: r.encabezados.findIndex((h) => /^marca$/i.test(h)),
      cont: r.encabezados.findIndex((h) => /^cont\.?$/i.test(h)),
      um: r.encabezados.findIndex((h) => /^u\/m$/i.test(h)),
      stock: r.encabezados.findIndex((h) => /^stock$/i.test(h)),
      ventaMedia: r.encabezados.findIndex((h) => /vta\.media/i.test(h)),
    },
    headerValidado: r.encabezados.length > 0 && r.faltantes.length === 0,
    headerAusente: r.encabezados.length === 0,
    encabezados: r.encabezados,
    faltantes: r.faltantes,
  }

  return {
    parser,
    metadata: {
      codigoSucursal: r.codigoSucursal,
      codigoFamilia: r.codigoFamilia,
      fechaReporteTexto: null,
    },
    codigoSectorFuente: r.codigoSector,
  }
}

/**
 * Puerta única de análisis para reportes Glaciar antes de escribir datos.
 * Acepta Reposición Asistida histórica y el Informe de Ventas Semanal 0258.
 */
export function analizarReporteGlaciar(
  textoCompleto: string,
  opciones: OpcionesAnalisisGlaciar = {},
): AnalisisReporteGlaciar {
  const modo = opciones.modo ?? 'familia'
  const fuente: FuenteImportacionGlaciar = parece0258(textoCompleto) ? '0258' : 'reposicion_asistida'
  const analisisBase = fuente === '0258'
    ? parserDesde0258(textoCompleto)
    : {
        parser: parsearCsvGlaciar(textoCompleto),
        metadata: extraerMetadataGlaciar(textoCompleto),
        codigoSectorFuente: null,
      }
  const { parser, metadata, codigoSectorFuente } = analisisBase
  const erroresBloqueantes: string[] = []

  if (metadata.codigoSucursal === null) {
    erroresBloqueantes.push(
      fuente === '0258'
        ? 'No se pudo identificar la sucursal del 0258. Se esperaba una columna Stk NNN (por ejemplo Stk 091).'
        : 'No se pudo identificar la sucursal del reporte (Cod.Suc.Padrón). No se puede importar sin una sucursal fuente verificable.',
    )
  }

  if (parser.headerAusente) {
    erroresBloqueantes.push(`No se encontró el encabezado válido de ${fuente === '0258' ? 'Glaciar 0258' : 'Reposición Asistida'} (Cod.Art.).`)
  } else if (parser.faltantes.length > 0) {
    erroresBloqueantes.push(`Faltan columnas requeridas: ${parser.faltantes.join(', ')}.`)
  }

  // El 0258 operativo se genera por sector. No aceptamos una carga departamental
  // que mezcle Almacén, Bebidas, Limpieza, etc.; cada archivo debe tener un único
  // sector verificable para evitar una actualización masiva fuera de alcance.
  if (fuente === '0258' && modo === 'masiva' && codigoSectorFuente === null) {
    erroresBloqueantes.push('El 0258 masivo debe corresponder a un único sector. No se admite una carga que mezcle varios sectores.')
  }

  // En la primera vuelta por familia, la familia debe ser inequívoca. En 0258
  // se deriva de Dto-Sec-Fam únicamente cuando todas las filas válidas comparten
  // el mismo código. En modo masivo por sector no se exige familia global.
  if (modo === 'familia' && parser.codigoFamilia === null) {
    erroresBloqueantes.push('No se pudo identificar una única Cód.Familia en el reporte.')
  }

  if (
    modo === 'familia' &&
    parser.codigoFamilia !== null &&
    metadata.codigoFamilia !== null &&
    parser.codigoFamilia !== metadata.codigoFamilia
  ) {
    erroresBloqueantes.push(
      `La familia detectada por la grilla (${parser.codigoFamilia}) no coincide con la metadata (${metadata.codigoFamilia}).`,
    )
  }

  if (!parser.headerAusente && parser.faltantes.length === 0 && parser.filas.length === 0) {
    erroresBloqueantes.push('El reporte tiene estructura válida pero no contiene productos importables.')
  }

  return { parser, metadata, modo, fuente, codigoSectorFuente, erroresBloqueantes }
}
