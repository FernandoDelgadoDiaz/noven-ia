import { supabase } from '@/lib/supabase'
import type { Producto } from '@/types/index'

/**
 * Producto preexistente que impide dar de alta uno nuevo con estos códigos.
 * `motivo` explica cuál es el choque, para poder mostrarle al operador algo
 * accionable en vez de un error crudo de constraint.
 */
export interface ConflictoCodigos {
  producto: Producto
  motivo: 'cod_art_ocupado' | 'ean_ocupado' | 'ean_guardado_como_cod_art'
}

interface UseProductosReturn {
  searchByBarcode: (barcode: string) => Promise<Producto | null>
  buscarConflictoCodigos: (codArt: string, ean: string) => Promise<ConflictoCodigos | null>
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
   * Verifica, ANTES de insertar, si algún producto ya ocupa estos códigos.
   *
   * A diferencia de `searchByBarcode`, NO filtra por `activo`: los índices únicos
   * `productos_cod_art_key` y `productos_codigo_barras_key` aplican también a los
   * productos dados de baja. Sin este chequeo, intentar reutilizar el código de
   * un producto desactivado devolvía una violación de constraint cruda, sin
   * ninguna pista de qué producto lo estaba ocupando.
   *
   * El tercer caso —`ean_guardado_como_cod_art`— es el vínculo duro: existe un
   * producto cuyo `cod_art` es exactamente el EAN que se está por registrar. Eso
   * significa que ese producto es el MISMO objeto físico, cargado antes con el
   * código en el campo equivocado. Insertar uno nuevo crearía el duplicado que
   * el importador después no puede resolver.
   */
  async function buscarConflictoCodigos(
    codArt: string,
    ean: string,
  ): Promise<ConflictoCodigos | null> {
    const c = codArt.trim()
    const e = ean.trim()

    if (c !== '') {
      const { data, error } = await supabase.from('productos').select('*').eq('cod_art', c).maybeSingle()
      if (error) throw new Error(error.message)
      if (data) return { producto: data as Producto, motivo: 'cod_art_ocupado' }
    }

    if (e !== '') {
      const { data, error } = await supabase.from('productos').select('*').eq('codigo_barras', e).maybeSingle()
      if (error) throw new Error(error.message)
      if (data) return { producto: data as Producto, motivo: 'ean_ocupado' }

      // Vínculo duro: el EAN escaneado quedó guardado como cod_art en otro registro.
      const { data: legacy, error: errLegacy } = await supabase
        .from('productos').select('*').eq('cod_art', e).maybeSingle()
      if (errLegacy) throw new Error(errLegacy.message)
      if (legacy) return { producto: legacy as Producto, motivo: 'ean_guardado_como_cod_art' }
    }

    return null
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
    buscarConflictoCodigos,
    upsertProducto,
  }
}
