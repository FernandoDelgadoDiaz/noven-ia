import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Producto } from '@/types/index'

interface ProductosState {
  data: Producto[]
  loading: boolean
  error: string | null
}

interface UseProductosReturn extends ProductosState {
  searchByBarcode: (barcode: string) => Promise<Producto | null>
  upsertProducto: (p: Partial<Producto>) => Promise<void>
  refetch: () => Promise<void>
}

export function useProductos(): UseProductosReturn {
  const [state, setState] = useState<ProductosState>({
    data: [],
    loading: true,
    error: null,
  })

  const fetchAll = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('descripcion', { ascending: true })

    if (error) {
      setState({ data: [], loading: false, error: error.message })
      return
    }

    setState({ data: (data as Producto[]) ?? [], loading: false, error: null })
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  /**
   * Busca un producto por código de barras. Si no encuentra resultado,
   * intenta con cod_art como fallback (útil cuando el barcode coincide
   * con el código de artículo interno).
   */
  async function searchByBarcode(barcode: string): Promise<Producto | null> {
    if (!barcode.trim()) return null

    // Intento 1: buscar por codigo_barras
    const { data: byBarcode, error: err1 } = await supabase
      .from('productos')
      .select('*')
      .eq('codigo_barras', barcode.trim())
      .eq('activo', true)
      .maybeSingle()

    if (err1) {
      throw new Error(err1.message)
    }

    if (byBarcode) return byBarcode as Producto

    // Intento 2: fallback a cod_art
    const { data: byCodArt, error: err2 } = await supabase
      .from('productos')
      .select('*')
      .eq('cod_art', barcode.trim())
      .eq('activo', true)
      .maybeSingle()

    if (err2) {
      throw new Error(err2.message)
    }

    return (byCodArt as Producto | null) ?? null
  }

  /**
   * Inserta o actualiza un producto.
   * Si `p.id` está presente se hace update; si no, se hace insert.
   * Requiere que el usuario tenga el rol "admin" (el RLS lo valida en servidor).
   */
  async function upsertProducto(p: Partial<Producto>): Promise<void> {
    if (p.id) {
      // Update: solo campos que llegan en `p`
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

    // Refrescar la lista en memoria
    await fetchAll()
  }

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    searchByBarcode,
    upsertProducto,
    refetch: fetchAll,
  }
}
