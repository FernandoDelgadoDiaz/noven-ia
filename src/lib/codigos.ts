// ─── Reglas de códigos de producto ────────────────────────────────────────────
//
// REGLA INVIOLABLE DEL MODELO:
//   `cod_art`       es SIEMPRE el código interno de Glaciar.
//   `codigo_barras` es SIEMPRE el EAN/GTIN impreso en el envase.
// Nunca al revés, en ningún camino del flujo.
//
// Por qué importa: cuando un EAN termina guardado en `cod_art`, el importador de
// Glaciar no encuentra ese producto, no le actualiza el stock, y nadie se entera.
// En producción eso generó cuatro duplicados del mismo producto físico contados
// dos veces por el motor de riesgo.
//
// El caso más traicionero es el EAN-8: tiene 8 dígitos y por lo tanto NINGUNA
// heurística de formato puede distinguirlo con certeza de un código interno, ya
// que el espacio de los códigos de Glaciar se solapa con el de los EAN-8. El
// único discriminante confiable es de dónde vino el dato: si salió del lector de
// código de barras, es un EAN; si lo tipeó el operador en el campo de código
// interno, es un cod_art.

/** Longitud exacta del código interno de Glaciar. */
export const LARGO_COD_ART = 7

/**
 * Longitudes válidas de un código de barras de producto:
 *   EAN-8 (8)   · productos chicos: golosinas, chocolates, chicles
 *   UPC-A (12)  · productos importados, sobre todo de EE.UU.
 *   EAN-13 (13) · el estándar general en Argentina
 *   GTIN-14 (14)· cajas y bultos
 * Aceptar solo 13 dejaba al operador sin forma de cargar un producto con EAN-8:
 * el botón de guardar quedaba deshabilitado y no había camino alternativo.
 */
export const LARGOS_EAN = [8, 12, 13, 14] as const

export function esCodArtValido(valor: string): boolean {
  const v = valor.trim()
  if (!new RegExp(`^\\d{${LARGO_COD_ART}}$`).test(v)) return false
  // Todo ceros es el placeholder que se usaba cuando no se conocía el código
  // real. Así nació el duplicado de "Turrocklets" en producción: un registro con
  // cod_art '0000000' que el importador de Glaciar nunca pudo matchear.
  // Los ceros a la izquierda sí son válidos ('0022354' es un código real).
  if (/^0+$/.test(v)) return false
  return true
}

export function esEanValido(valor: string): boolean {
  const v = valor.trim()
  return /^\d+$/.test(v) && (LARGOS_EAN as readonly number[]).includes(v.length)
}

/** Máximo de dígitos que tiene sentido aceptar en un campo de código de barras. */
export const MAX_LARGO_EAN = Math.max(...LARGOS_EAN)

/**
 * Decide en qué campo del alta corresponde precargar un código escaneado.
 *
 * Un código de 7 dígitos es inequívocamente un cod_art de Glaciar. Cualquier
 * otro largo válido de barras va a `codigo_barras`. Ante la duda, no se precarga
 * nada: es preferible que el operador tipee a que el sistema adivine mal y
 * termine con un EAN en `cod_art`.
 */
export function clasificarCodigoEscaneado(codigo: string): 'cod_art' | 'ean' | 'desconocido' {
  const c = codigo.trim()
  if (!/^\d+$/.test(c)) return 'desconocido'
  if (c.length === LARGO_COD_ART) return 'cod_art'
  if (esEanValido(c)) return 'ean'
  return 'desconocido'
}

export const MENSAJE_COD_ART_INVALIDO = `El código interno debe tener exactamente ${LARGO_COD_ART} dígitos`
export const MENSAJE_EAN_INVALIDO = `El código de barras debe tener ${LARGOS_EAN.join(', ')} dígitos (EAN-8, UPC-A, EAN-13 o GTIN-14)`
