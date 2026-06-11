import { supabase } from '@/lib/supabase'
import type { Producto } from '@/types/index'

interface UseProductosReturn {
  searchByBarcode: (barcode: string) => Promise<Producto | null>
  upsertProducto: (p: Partial<Producto>) => Promise<void>
}

/**
 * Hook de acceso al catálogo de productos.
 *
 * NO descarga la tabla completa al montar. Cada operación hace una query
 * puntual contra Supabase. Si en el futuro se necesita listar el catálogo
 * completo (ej. página Maestro), crear un hook dedicado con paginación.
 */
export function useProductos(): UseProductosReturn {
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
    upsertProducto,
  }
}
