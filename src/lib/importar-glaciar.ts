import { parsearCsvGlaciar, type ResultadoParser } from './importar-csv'
import { extraerMetadataGlaciar, type MetadataGlaciar } from './glaciar-metadata'

export interface AnalisisReporteGlaciar {
  parser: ResultadoParser
  metadata: MetadataGlaciar
  /** Errores que impiden siquiera ofrecer el botón de confirmar importación. */
  erroresBloqueantes: string[]
}

/**
 * Puerta única de análisis para un reporte Glaciar antes de escribir datos.
 *
 * El parser histórico sigue siendo la autoridad sobre la grilla de productos;
 * la capa de metadata agrega identidad de sucursal, necesaria en multitenancy.
 * Separarlos evita arriesgar el parser que ya está probado con archivos reales.
 */
export function analizarReporteGlaciar(textoCompleto: string): AnalisisReporteGlaciar {
  const parser = parsearCsvGlaciar(textoCompleto)
  const metadata = extraerMetadataGlaciar(textoCompleto)
  const erroresBloqueantes: string[] = []

  if (metadata.codigoSucursal === null) {
    erroresBloqueantes.push(
      'No se pudo identificar la sucursal del reporte (Cod.Suc.Padrón). No se puede importar sin una sucursal fuente verificable.',
    )
  }

  if (parser.headerAusente) {
    erroresBloqueantes.push('No se encontró el encabezado real de Reposición Asistida (Cod.Art.).')
  } else if (parser.faltantes.length > 0) {
    erroresBloqueantes.push(`Faltan columnas requeridas: ${parser.faltantes.join(', ')}.`)
  }

  if (parser.codigoFamilia === null) {
    erroresBloqueantes.push('No se pudo identificar Cód.Familia en el reporte.')
  }

  if (
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

  return { parser, metadata, erroresBloqueantes }
}
