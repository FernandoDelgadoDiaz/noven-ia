let ultimaLecturaCamara: { codigo: string; at: number } | null = null

const VENTANA_LECTURA_MS = 5_000

/**
 * Marca una lectura producida por el componente de cámara. No persiste datos:
 * sólo permite que useScanner distinga una lectura física de un texto escrito.
 */
export function marcarLecturaCamara(codigo: string): void {
  ultimaLecturaCamara = { codigo: codigo.trim(), at: Date.now() }
}

/**
 * Consume una marca una sola vez. Una lectura vieja o de otro código no sirve
 * para habilitar un EAN escrito manualmente.
 */
export function consumirLecturaCamara(codigo: string): boolean {
  const actual = ultimaLecturaCamara
  ultimaLecturaCamara = null
  if (!actual) return false
  return actual.codigo === codigo.trim() && Date.now() - actual.at <= VENTANA_LECTURA_MS
}
