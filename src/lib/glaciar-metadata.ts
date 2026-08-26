// ─── Metadata de reportes Glaciar ─────────────────────────────────────────────
//
// El reporte de Reposición Asistida trae datos de contexto fuera de la grilla
// de productos. En multitenancy esos metadatos dejan de ser decorativos: son la
// evidencia que determina a QUÉ sucursal pertenece el archivo antes de escribir.
//
// Este módulo es deliberadamente puro: no conoce React ni Supabase.

export interface MetadataGlaciar {
  /** Código normalizado de sucursal, por ejemplo "091". */
  codigoSucursal: string | null
  /** Código de familia informado por Glaciar, por ejemplo "003". */
  codigoFamilia: string | null
  /** Fecha/hora textual del reporte si pudo encontrarse; no se interpreta acá. */
  fechaReporteTexto: string | null
}

function normalizarCodigoSucursal(raw: string): string | null {
  const limpio = raw.trim()
  if (!/^\d{1,6}$/.test(limpio)) return null
  // Glaciar usa códigos de tres dígitos en la cadena actual. No truncamos códigos
  // más largos para no hacer una suposición irreversible sobre futuras empresas.
  return limpio.length < 3 ? limpio.padStart(3, '0') : limpio
}

/**
 * Extrae metadata del bloque superior del reporte.
 *
 * Formatos reales cubiertos:
 *   "Cod.Suc.Padrón:\t091"
 *   "Cod.Suc.Padron:\t091"
 *   "... - Sucursal: 091"
 *
 * Se prioriza `Cod.Suc.Padrón`, porque es un campo estructurado del reporte. La
 * leyenda "Sucursal:" queda como fallback para tolerar variantes de exportación.
 */
export function extraerMetadataGlaciar(textoCompleto: string): MetadataGlaciar {
  const lineas = textoCompleto.split(/\r?\n/)
  const cabecera = lineas.slice(0, 30)

  let codigoSucursal: string | null = null
  let codigoFamilia: string | null = null
  let fechaReporteTexto: string | null = null

  for (const linea of cabecera) {
    if (codigoSucursal === null) {
      const sucPadron = linea.match(/C[oó]d\.Suc\.Padr[oó]n:\s*\t?\s*(\d{1,6})/i)
      if (sucPadron) codigoSucursal = normalizarCodigoSucursal(sucPadron[1])
    }

    if (codigoFamilia === null) {
      const familia = linea.match(/C[oó]d\.Familia:\s*\t?\s*(\d+)/i)
      if (familia) codigoFamilia = familia[1].trim()
    }

    if (fechaReporteTexto === null) {
      // Ejemplo real: "04/08/2026 - 19:24:40"
      const fechaHora = linea.match(/\b(\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}:\d{2}:\d{2})\b/)
      if (fechaHora) fechaReporteTexto = fechaHora[1]
    }
  }

  if (codigoSucursal === null) {
    for (const linea of cabecera) {
      const fallback = linea.match(/\bSucursal:\s*(\d{1,6})\b/i)
      if (fallback) {
        codigoSucursal = normalizarCodigoSucursal(fallback[1])
        break
      }
    }
  }

  return { codigoSucursal, codigoFamilia, fechaReporteTexto }
}
