import { supabase } from '@/lib/supabase'
import { useSucursalActual } from '@/hooks/useSucursalActual'
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
  searchByBarcode: (barcode: string, sucursalId?: string) => Promise<Producto | null>
  buscarConflictoCodigos: (
    codArt: string,
    ean: string,
    sucursalId?: string,
    excluirProductoId?: string | null,
  ) => Promise<ConflictoCodigos | null>
  vincularEanScanner: (sucursalId: string, productoId: string, ean: string) => Promise<Producto>
  completarCodArtScanner: (sucursalId: string, productoId: string, codArt: string) => Promise<Producto>
  crearProductoScanner: (input: NuevoProductoScannerInput) => Promise<Producto>
  listarFamiliasScanner: (sucursalId?: string) => Promise<Familia[]>
}

/**
 * Acceso al catálogo del Scanner exclusivamente mediante RPCs con scope de
 * sucursal. No expone ningún escritor genérico sobre `productos`: un nuevo flujo
 * que necesite modificar catálogo debe tener un contrato SQL explícito y acotado.
 */
export function useProductos(): UseProductosReturn {
  const { sucursalId: sucursalActual } = useSucursalActual()

  function resolverSucursal(sucursalId?: string): string {
    return (sucursalId ?? sucursalActual).trim()
  }

  async function searchByBarcode(barcode: string, sucursalId?: string): Promise<Producto | null> {
    const codigo = barcode.trim()
    const scope = resolverSucursal(sucursalId)
    if (!codigo || !scope) return null

    const { data, error } = await supabase.rpc('buscar_producto_scanner', {
      p_sucursal_id: scope,
      p_codigo: codigo,
    })

    if (error) throw new Error(error.message)
    return (data as Producto | null) ?? null
  }

  async function buscarConflictoCodigos(
    codArt: string,
    ean: string,
    sucursalId?: string,
    excluirProductoId: string | null = null,
  ): Promise<ConflictoCodigos | null> {
    const scope = resolverSucursal(sucursalId)
    if (!scope) return null

    const { data, error } = await supabase.rpc('buscar_conflicto_codigos_scanner', {
      p_sucursal_id: scope,
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

  async function listarFamiliasScanner(sucursalId?: string): Promise<Familia[]> {
    const scope = resolverSucursal(sucursalId)
    if (!scope) return []
    const { data, error } = await supabase.rpc('listar_familias_scanner', {
      p_sucursal_id: scope,
    })
    if (error) throw new Error(error.message)
    return (data ?? []) as Familia[]
  }

  return {
    searchByBarcode,
    buscarConflictoCodigos,
    vincularEanScanner,
    completarCodArtScanner,
    crearProductoScanner,
    listarFamiliasScanner,
  }
}
