import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcularDiasRestantes, calcularNivelRiesgo } from '@/lib/riesgo'
export type { NivelRiesgo } from '@/lib/riesgo'
import type { NivelRiesgo } from '@/lib/riesgo'

const SUCURSAL_ID = '00000000-0000-0000-0000-000000000001'

export type FiltroNivel = 'todos' | NivelRiesgo

export interface VencimientoConProducto {
  id: string
  producto_id: string
  sucursal_id: string
  usuario_id: string | null
  cantidad: number
  lote: string | null
  fecha_vencimiento: string
  fecha_carga: string
  activo: boolean
  created_at: string
  productos: {
    descripcion: string
    marca: string | null
    categoria: string | null
    stock_actual: number
    venta_media_diaria: number
  }
  // calculados
  dias_restantes: number
  nivel_riesgo: NivelRiesgo
}

// Fila cruda que devuelve Supabase antes de tipar
interface RawRow {
  id: string
  producto_id: string
  sucursal_id: string
  usuario_id: string | null
  cantidad: number
  lote: string | null
  fecha_vencimiento: string
  fecha_carga: string
  activo: boolean
  created_at: string
  productos: {
    descripcion: string
    marca: string | null
    categoria: string | null
    stock_actual: number
    venta_media_diaria: number
  } | null
}


interface UseVencimientosListaReturn {
  vencimientos: VencimientoConProducto[]
  vencimientosTodos: VencimientoConProducto[]
  loading: boolean
  error: string | null
  refetch: () => void
  filtroNivel: FiltroNivel
  setFiltroNivel: (nivel: FiltroNivel) => void
  filtroCategoria: string
  setFiltroCategoria: (categoria: string) => void
  busqueda: string
  setBusqueda: (busqueda: string) => void
  categorias: string[]
}

export function useVencimientosLista(): UseVencimientosListaReturn {
  const [vencimientosTodos, setVencimientosTodos] = useState<VencimientoConProducto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroNivel, setFiltroNivel] = useState<FiltroNivel>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)

    const { data: rows, error: fetchError } = await supabase
      .from('vencimientos')
      .select(`
        id, producto_id, sucursal_id, usuario_id, cantidad, lote,
        fecha_vencimiento, fecha_carga, activo, created_at,
        productos (
          descripcion, marca, categoria, stock_actual, venta_media_diaria
        )
      `)
      .eq('activo', true)
      .eq('sucursal_id', SUCURSAL_ID)
      .order('fecha_vencimiento', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const rawRows = (rows ?? []) as unknown as RawRow[]

    const procesados: VencimientoConProducto[] = rawRows
      .filter((row): row is RawRow & { productos: NonNullable<RawRow['productos']> } =>
        row.productos !== null,
      )
      .map((row) => {
        const diasRestantes = calcularDiasRestantes(row.fecha_vencimiento)
        const nivelRiesgo = calcularNivelRiesgo(
          diasRestantes,
          row.productos.stock_actual,
          row.productos.venta_media_diaria,
        )
        return {
          ...row,
          productos: row.productos,
          dias_restantes: diasRestantes,
          nivel_riesgo: nivelRiesgo,
        }
      })
      .sort((a, b) => a.dias_restantes - b.dias_restantes)

    setVencimientosTodos(procesados)
    setLoading(false)
  }, [])

  const refetch = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData, refreshKey])

  const categorias = useMemo(() => {
    const set = new Set<string>()
    vencimientosTodos.forEach((v) => {
      if (v.productos.categoria) {
        set.add(v.productos.categoria)
      }
    })
    return Array.from(set).sort()
  }, [vencimientosTodos])

  const vencimientos = useMemo(() => {
    return vencimientosTodos
      .filter((v) => {
        if (filtroNivel !== 'todos' && v.nivel_riesgo !== filtroNivel) return false
        if (filtroCategoria && v.productos.categoria !== filtroCategoria) return false
        if (
          busqueda.trim() !== '' &&
          !v.productos.descripcion.toLowerCase().includes(busqueda.trim().toLowerCase())
        )
          return false
        return true
      })
      .sort((a, b) => a.dias_restantes - b.dias_restantes)
  }, [vencimientosTodos, filtroNivel, filtroCategoria, busqueda])

  return {
    vencimientos,
    vencimientosTodos,
    loading,
    error,
    refetch,
    filtroNivel,
    setFiltroNivel,
    filtroCategoria,
    setFiltroCategoria,
    busqueda,
    setBusqueda,
    categorias,
  }
}
