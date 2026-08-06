// ─── Reconciliación CSV de Glaciar ↔ productos de la app ──────────────────────
//
// Decide, para cada fila del CSV, contra qué producto de la base se aplica —y,
// tan importante como eso, qué productos de la app NO aparecieron en el CSV.
//
// Ese segundo punto es el bug que motivó la auditoría: "Turrocklets" quedó
// cargado a mano con cod_art '0000000' mientras Glaciar lo exporta como
// '3328533'. El importador no lo encontraba, no actualizaba su stock y nadie se
// enteraba: la app mostraba 127 unidades contra 169 reales. Un producto que no
// matchea no es un no-evento, es una alerta.

import {
  normalizarDescripcion,
  similaridad,
  UMBRAL_SIMILARIDAD,
  type FilaParseada,
} from './importar-csv'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ProductoDb {
  id: string
  cod_art: string
  codigo_barras: string | null
  descripcion: string
  marca: string | null
  gramaje: string | null
  stock_actual: number
  venta_media_diaria: number
  familia_id: string | null
}

export type EstrategiaMatch = 'cod_art' | 'codigo_barras' | 'descripcion'

/** Por qué el cod_art de un producto de la app no puede matchear con Glaciar. */
export type MotivoCodArt = 'sin_asignar' | 'ean' | 'formato_invalido' | null

export interface FilaConciliada {
  fila: FilaParseada
  match: ProductoDb | null
  estrategia: EstrategiaMatch | null
  /** Solo para estrategia 'descripcion': 0..1. */
  similaridad: number | null
  /** El producto matcheado figura en la app en una familia distinta a la del CSV. */
  conflictoFamilia: boolean
}

export interface Huerfano {
  producto: ProductoDb
  motivoCodArt: MotivoCodArt
}

/**
 * Duplicado lógico detectado por el ÚNICO vínculo duro que existe entre un
 * producto escaneado y su equivalente en Glaciar: el código de barras.
 *
 * El registro de Glaciar guarda el EAN en `codigo_barras`; el que se cargó desde
 * el Scanner guardó ese mismo EAN en `cod_art` (campo equivocado). Cuando ambos
 * conviven, son el mismo producto físico contado dos veces.
 *
 * Esta detección no depende de la similaridad de descripción, que falla en casos
 * reales: "Chocolate leche" contra "CHOCOLATE CONLECHE MILKA Un(240" queda muy
 * por debajo del umbral y aun así son el mismo producto.
 */
export interface DuplicadoPorEan {
  fila: FilaParseada
  /** El registro de Glaciar: el que debe sobrevivir. */
  principal: ProductoDb
  /** El registro escaneado, cuyo cod_art es en realidad el EAN del principal. */
  duplicado: ProductoDb
}

export interface Reconciliacion {
  /** Match inequívoco por código: se actualizan sin preguntar. */
  aActualizar: FilaConciliada[]
  /** Match por descripción: NO se aplica sin decisión explícita del usuario. */
  aConfirmar: FilaConciliada[]
  /** Sin match alguno: candidatos a alta. */
  nuevos: FilaConciliada[]
  /** Productos que la app cree de esta familia y que el CSV no trajo. */
  huerfanos: Huerfano[]
  /** Filas matcheadas cuyo producto está hoy en otra familia. */
  conflictosFamilia: FilaConciliada[]
  /** Filas que apuntaban a un producto ya tomado por otra fila del CSV. */
  colisiones: FilaConciliada[]
  /** Pares producto-de-Glaciar / producto-escaneado ligados por el código de barras. */
  duplicadosPorEan: DuplicadoPorEan[]
}

// ─── Clasificación de cod_art ─────────────────────────────────────────────────

/**
 * Un cod_art de Glaciar tiene entre 4 y 8 dígitos. Los productos cargados desde
 * el Scanner quedaron con dos patrones que nunca van a matchear:
 *   - '0000000' (placeholder cuando no se conocía el código)
 *   - el EAN-13 del envase guardado en el campo equivocado
 * Distinguirlos importa porque la reparación es distinta en cada caso.
 */
export function clasificarCodArt(codArt: string): MotivoCodArt {
  const c = codArt.trim()
  if (c === '' || /^0+$/.test(c)) return 'sin_asignar'
  if (/^\d{12,14}$/.test(c)) return 'ean'
  if (!/^\d{4,8}$/.test(c)) return 'formato_invalido'
  return null
}

// ─── Reconciliación ───────────────────────────────────────────────────────────

/**
 * @param filas          filas válidas parseadas del CSV
 * @param candidatos     productos de la base que pueden matchear: los traídos
 *                       por cod_art, por codigo_barras y TODOS los de la familia
 *                       del CSV (estos últimos son los que permiten detectar
 *                       huérfanos y matcheos por descripción)
 * @param familiaIdCsv   familia a la que corresponde el archivo, ya confirmada
 */
export function reconciliar(
  filas: FilaParseada[],
  candidatos: ProductoDb[],
  familiaIdCsv: string | null,
): Reconciliacion {
  const porCodArt = new Map<string, ProductoDb>()
  const porEan = new Map<string, ProductoDb>()
  for (const p of candidatos) {
    if (!porCodArt.has(p.cod_art)) porCodArt.set(p.cod_art, p)
    if (p.codigo_barras && !porEan.has(p.codigo_barras)) porEan.set(p.codigo_barras, p)
  }

  const asignados = new Set<string>()
  const aActualizar: FilaConciliada[] = []
  const aConfirmar: FilaConciliada[] = []
  const nuevos: FilaConciliada[] = []
  const colisiones: FilaConciliada[] = []

  const pendientes: FilaParseada[] = []

  // ── Pasada 1: match exacto por cod_art (la única fuente inequívoca) ────────
  for (const fila of filas) {
    const p = porCodArt.get(fila.cod_art)
    if (!p) {
      pendientes.push(fila)
      continue
    }
    if (asignados.has(p.id)) {
      colisiones.push({ fila, match: p, estrategia: 'cod_art', similaridad: null, conflictoFamilia: false })
      continue
    }
    asignados.add(p.id)
    aActualizar.push({
      fila,
      match: p,
      estrategia: 'cod_art',
      similaridad: null,
      conflictoFamilia: familiaIdCsv !== null && p.familia_id !== null && p.familia_id !== familiaIdCsv,
    })
  }

  // ── Pasada 2: el cod_art del CSV coincide con un codigo_barras guardado ────
  // Rara vez acierta (un cod_art de Glaciar no es un EAN), pero es barata y
  // cubre el caso de productos cargados con el código corrido de campo.
  const pendientes2: FilaParseada[] = []
  for (const fila of pendientes) {
    const p = porEan.get(fila.cod_art)
    if (!p) {
      pendientes2.push(fila)
      continue
    }
    if (asignados.has(p.id)) {
      colisiones.push({ fila, match: p, estrategia: 'codigo_barras', similaridad: null, conflictoFamilia: false })
      continue
    }
    asignados.add(p.id)
    aActualizar.push({
      fila,
      match: p,
      estrategia: 'codigo_barras',
      similaridad: null,
      conflictoFamilia: familiaIdCsv !== null && p.familia_id !== null && p.familia_id !== familiaIdCsv,
    })
  }

  // ── Pasada 3: similaridad de descripción ──────────────────────────────────
  // Única estrategia capaz de recuperar los productos con cod_art desalineado.
  // Nunca se aplica sola: alimenta la lista que el usuario debe confirmar.
  const libres = candidatos.filter((p) => !asignados.has(p.id))
  const indiceLibres = libres.map((p) => ({ p, norm: normalizarDescripcion(p.descripcion) }))

  for (const fila of pendientes2) {
    let mejor: ProductoDb | null = null
    let mejorScore = 0
    for (const { p, norm } of indiceLibres) {
      if (asignados.has(p.id)) continue
      if (norm === '') continue
      const s = similaridad(fila.descripcion, p.descripcion)
      if (s > mejorScore) {
        mejorScore = s
        mejor = p
      }
    }
    if (mejor && mejorScore >= UMBRAL_SIMILARIDAD) {
      asignados.add(mejor.id)
      aConfirmar.push({
        fila,
        match: mejor,
        estrategia: 'descripcion',
        similaridad: mejorScore,
        conflictoFamilia:
          familiaIdCsv !== null && mejor.familia_id !== null && mejor.familia_id !== familiaIdCsv,
      })
    } else {
      nuevos.push({ fila, match: null, estrategia: null, similaridad: null, conflictoFamilia: false })
    }
  }

  // ── Duplicados ligados por código de barras ───────────────────────────────
  // Para cada fila que matcheó contra un producto de Glaciar con codigo_barras,
  // se busca si existe OTRO producto cuyo cod_art sea exactamente ese EAN: es el
  // registro escaneado del mismo producto físico. Es el vínculo duro, y atrapa
  // los pares que la similaridad de descripción no alcanza a ver.
  const duplicadosPorEan: DuplicadoPorEan[] = []
  const yaReportado = new Set<string>()
  for (const fc of [...aActualizar, ...aConfirmar]) {
    const principal = fc.match
    if (!principal?.codigo_barras) continue
    const duplicado = porCodArt.get(principal.codigo_barras)
    if (!duplicado || duplicado.id === principal.id) continue
    if (yaReportado.has(duplicado.id)) continue
    yaReportado.add(duplicado.id)
    duplicadosPorEan.push({ fila: fc.fila, principal, duplicado })
  }

  // ── Huérfanos: la app los ubica en esta familia pero el CSV no los trajo ───
  // Se excluyen los ya señalados como duplicado por EAN: para esos hay un
  // diagnóstico más preciso y accionable que "no vino en el CSV".
  const huerfanos: Huerfano[] =
    familiaIdCsv === null
      ? []
      : candidatos
          .filter(
            (p) => p.familia_id === familiaIdCsv && !asignados.has(p.id) && !yaReportado.has(p.id),
          )
          .map((p) => ({ producto: p, motivoCodArt: clasificarCodArt(p.cod_art) }))

  // Más probable primero: los de cod_art sospechoso son los candidatos reales a
  // estar desalineados, no productos genuinamente ausentes del reporte.
  huerfanos.sort((a, b) => {
    const rank = (m: MotivoCodArt): number =>
      m === 'sin_asignar' ? 0 : m === 'ean' ? 1 : m === 'formato_invalido' ? 2 : 3
    return rank(a.motivoCodArt) - rank(b.motivoCodArt)
  })

  aConfirmar.sort((a, b) => (b.similaridad ?? 0) - (a.similaridad ?? 0))

  const conflictosFamilia = [...aActualizar, ...aConfirmar].filter((f) => f.conflictoFamilia)

  return { aActualizar, aConfirmar, nuevos, huerfanos, conflictosFamilia, colisiones, duplicadosPorEan }
}
