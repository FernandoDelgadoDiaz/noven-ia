import type { FilaParseada } from './importar-csv'
import type { ProductoDb } from './importar-reconciliacion'

/**
 * Plan seguro para una Reposición Asistida completa.
 *
 * En modo masivo NO se usa similaridad de descripción: con cientos/miles de
 * artículos, una coincidencia aproximada puede actualizar el SKU equivocado.
 * Sólo un cod_art exacto previamente aprendido habilita una actualización.
 */
export interface FilaMasivaResuelta {
  fila: FilaParseada
  producto: ProductoDb
  familia_id: string
}

export interface FilaMasivaSinFamilia {
  fila: FilaParseada
  producto: ProductoDb
}

export interface ResumenFamiliaMasiva {
  familia_id: string
  productos: number
}

export interface PlanImportacionMasiva {
  /** SKU conocido + familia conocida: puede actualizar stock/VMD automáticamente. */
  actualizables: FilaMasivaResuelta[]
  /** SKU conocido, pero todavía no puede derivarse a operador/familia. */
  conocidosSinFamilia: FilaMasivaSinFamilia[]
  /** cod_art todavía inexistente en el catálogo: requiere aprendizaje/mapeo. */
  sinMapear: FilaParseada[]
  /** Conteo para preview y derivación posterior a operadores. */
  porFamilia: ResumenFamiliaMasiva[]
}

export function planificarImportacionMasiva(
  filas: FilaParseada[],
  productos: ProductoDb[],
): PlanImportacionMasiva {
  const porCodArt = new Map<string, ProductoDb>()
  for (const producto of productos) {
    const codigo = producto.cod_art.trim()
    if (codigo !== '' && !porCodArt.has(codigo)) porCodArt.set(codigo, producto)
  }

  const actualizables: FilaMasivaResuelta[] = []
  const conocidosSinFamilia: FilaMasivaSinFamilia[] = []
  const sinMapear: FilaParseada[] = []
  const conteoFamilias = new Map<string, number>()

  for (const fila of filas) {
    const producto = porCodArt.get(fila.cod_art)
    if (!producto) {
      sinMapear.push(fila)
      continue
    }

    if (!producto.familia_id) {
      conocidosSinFamilia.push({ fila, producto })
      continue
    }

    actualizables.push({ fila, producto, familia_id: producto.familia_id })
    conteoFamilias.set(
      producto.familia_id,
      (conteoFamilias.get(producto.familia_id) ?? 0) + 1,
    )
  }

  const porFamilia = Array.from(conteoFamilias, ([familia_id, productos]) => ({
    familia_id,
    productos,
  })).sort((a, b) => b.productos - a.productos || a.familia_id.localeCompare(b.familia_id))

  return { actualizables, conocidosSinFamilia, sinMapear, porFamilia }
}
