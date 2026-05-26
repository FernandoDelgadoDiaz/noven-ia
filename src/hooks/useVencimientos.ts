import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcularRiesgo } from '@/lib/predictive'
import type { Producto, Vencimiento, VencimientoConRiesgo } from '@/types/index'
import { useUsuarioFamilias } from '@/hooks/useUsuarioFamilias'

interface VencimientosState {
  data: VencimientoConRiesgo[]
  loading: boolean
  error: string | null
}

interface UseVencimientosReturn extends VencimientosState {
  refetch: () => Promise<void>
  sinFamilias: boolean
}

/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD (sin conversión de zona horaria)
 * para comparar directamente con columnas `date` de Postgres.
 */
function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Narrowing helper: valida que una fila de Supabase incluye el join de producto.
 */
function hasProducto(
  row: Vencimiento & { producto: Producto | null },
): row is Vencimiento & { producto: Producto } {
  return row.producto !== null
}

export function useVencimientos(sucursalId: string | null): UseVencimientosReturn {
  const { esAdmin, familiaIds, sinFamilias, loading: famLoading } = useUsuarioFamilias()
  const [rawData, setRawData] = useState<VencimientoConRiesgo[]>([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchData = useCallback(async (): Promise<void> => {
    if (!sucursalId) {
      setRawData([])
      setFetchLoading(false)
      return
    }

    setFetchLoading(true)
    setFetchError(null)

    const hoy = todayIso()

    const { data: rows, error } = await supabase
      .from('vencimientos')
      .select(
        `
        id,
        producto_id,
        sucursal_id,
        usuario_id,
        cantidad,
        lote,
        fecha_vencimiento,
        fecha_carga,
        activo,
        created_at,
        producto:productos (
          id,
          cod_art,
          codigo_barras,
          descripcion,
          marca,
          gramaje,
          categoria,
          proveedor,
          sector,
          venta_media_diaria,
          stock_actual,
          precio_costo,
          familia_id,
          imagen_url,
          activo,
          created_at,
          updated_at
        )
      `,
      )
      .eq('sucursal_id', sucursalId)
      .eq('activo', true)
      .gte('fecha_vencimiento', hoy)
      .order('fecha_vencimiento', { ascending: true })

    if (error) {
      setFetchError(error.message)
      setFetchLoading(false)
      return
    }

    const hoyDate = new Date()

    const typed = (rows ?? []) as unknown as (Vencimiento & { producto: Producto | null })[]
    const conRiesgo: VencimientoConRiesgo[] = typed
      .filter(hasProducto)
      .map((row) => calcularRiesgo(row, row.producto, hoyDate))
      .sort((a, b) => a.dias_restantes - b.dias_restantes)

    setRawData(conRiesgo)
    setFetchLoading(false)
  }, [sucursalId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const data = useMemo(() => {
    if (famLoading) return []
    if (esAdmin) return rawData
    if (familiaIds.length === 0) return []
    return rawData.filter(
      (v) => v.producto.familia_id !== null && familiaIds.includes(v.producto.familia_id),
    )
  }, [rawData, esAdmin, familiaIds, famLoading])

  const loading = famLoading || fetchLoading

  return {
    data,
    loading,
    error: fetchError,
    refetch: fetchData,
    sinFamilias,
  }
}
