import { supabase } from '@/lib/supabase'
import type { Familia, Producto } from '@/types/index'

export interface ConflictoCodigos {
  producto: Producto
  motivo: 'cod_art_ocupado' | 'ean_ocupado' | 'ean_guardado_como_cod_art'
}

export interface NuevoProductoScannerInput {
  sucursalId: string
  codArt: string
  ean: string
  descripcion: string
  marca: string | null
  categoria: string | null
  stockActual: number
  ventaMediaDiaria: number
  familiaId: string
}

interface UseProductosReturn {
  searchByBarcode: (barcode: string, sucursalId: string) => Promise<Producto | null>
  buscarConflictoCodigos: (
    codArt: string,
    ean: string,
    sucursalId: string,
    excluirProductoId?: string | null,
  ) => Promise<ConflictoCodigos | null>
  vincularEanScanner: (sucursalId: string, productoId: string, ean: string) => Promise<Producto>
  completarCodArtScanner: (sucursalId: string, productoId: string, codArt: string) => Promise<Producto>
  crearProductoScanner: (input: NuevoProductoScannerInput) => Promise<Producto>
  listarFamiliasScanner: (sucursalId: string) => Promise<Familia[]>
  /** Compatibilidad temporal para flujos no migrados del catálogo. */
  upsertProducto: (p: Partial<Producto>) => Promise<void>
}

/**
 * Acceso al catálogo. El Scanner usa exclusivamente RPCs con scope de sucursal:
 * la organización se deriva en PostgreSQL y nunca se decide en el navegador.
 */
export function useProductos(): UseProductosReturn {
  async function searchByBarcode(barcode: string, sucursalId: string): Promise<Producto | null> {
    const codigo = barcode.trim()
    if (!codigo || !sucursalId) return null

    const { data, error } = await supabase.rpc('buscar_producto_scanner', {
      p_sucursal_id: sucursalId,
      p_codigo: codigo,
    })

    if (error) throw new Error(error.message)
    return (data as Producto | null) ?? null
  }

  async function buscarConflictoCodigos(
    codArt: string,
    ean: string,
    sucursalId: string,
    excluirProductoId: string | null = null,
  ): Promise<ConflictoCodigos | null> {
    if (!sucursalId) return null

    const { data, error } = await supabase.rpc('buscar_conflicto_codigos_scanner', {
      p_sucursal_id: sucursalId,
      p_cod_art: codArt.trim(),
      p_ean: ean.trim(),
      p_excluir_producto_id: excluirProductoId,
    })

    if (error) throw new Error(error.message)
    return (data as ConflictoCodigos | null) ?? null
  }

  async function vincularEanScanner(
    sucursalId: string,
    productoId: string,
    ean: string,
  ): Promise<Producto> {
    const { data, error } = await supabase.rpc('vincular_ean_producto_scanner', {
      p_sucursal_id: sucursalId,
      p_producto_id: productoId,
      p_ean: ean.trim(),
    })
    if (error) throw new Error(error.message)
    if (!data) throw new Error('No se pudo recuperar el producto actualizado.')
    return data as Producto
  }

  async function completarCodArtScanner(
    sucursalId: string,
    productoId: string,
    codArt: string,
  ): Promise<Producto> {
    const { data, error } = await supabase.rpc('completar_cod_art_producto_scanner', {
      p_sucursal_id: sucursalId,
      p_producto_id: productoId,
      p_cod_art: codArt.trim(),
    })
    if (error) throw new Error(error.message)
    if (!data) throw new Error('No se pudo recuperar el producto actualizado.')
    return data as Producto
  }

  async function crearProductoScanner(input: NuevoProductoScannerInput): Promise<Producto> {
    const { data, error } = await supabase.rpc('crear_producto_scanner', {
      p_sucursal_id: input.sucursalId,
      p_cod_art: input.codArt.trim(),
      p_ean: input.ean.trim(),
      p_descripcion: input.descripcion.trim(),
      p_marca: input.marca,
      p_categoria: input.categoria,
      p_stock_actual: input.stockActual,
      p_venta_media_diaria: input.ventaMediaDiaria,
      p_familia_id: input.familiaId,
    })
    if (error) throw new Error(error.message)
    if (!data) throw new Error('No se pudo recuperar el producto creado.')
    return data as Producto
  }

  async function listarFamiliasScanner(sucursalId: string): Promise<Familia[]> {
    if (!sucursalId) return []
    const { data, error } = await supabase.rpc('listar_familias_scanner', {
      p_sucursal_id: sucursalId,
    })
    if (error) throw new Error(error.message)
    return (data ?? []) as Familia[]
  }

  /**
   * Compatibilidad temporal. No usar desde Scanner V2.
   */
  async function upsertProducto(p: Partial<Producto>): Promise<void> {
    if (p.id) {
      const { id, created_at: _created, ...fields } = p as Partial<Producto> & { id: string }
      void _created
      const { error } = await supabase
        .from('productos')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase.from('productos').insert(p)
      if (error) throw new Error(error.message)
    }
  }

  return {
    searchByBarcode,
    buscarConflictoCodigos,
    vincularEanScanner,
    completarCodArtScanner,
    crearProductoScanner,
    listarFamiliasScanner,
    upsertProducto,
  }
}
