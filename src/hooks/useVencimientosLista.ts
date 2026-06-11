import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcularDiasRestantes, calcularNivelRiesgo } from '@/lib/riesgo'
export type { NivelRiesgo } from '@/lib/riesgo'
import type { NivelRiesgo } from '@/lib/riesgo'
import { useUsuarioFamilias } from '@/hooks/useUsuarioFamilias'
import { useSucursalActual } from '@/hooks/useSucursalActual'

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
  familia_id: string | null
  productos: {
    descripcion: string
    cod_art: string | null
    codigo_barras: string | null
    gramaje: string | null
    marca: string | null
    categoria: string | null
    stock_actual: number
    venta_media_diaria: number
    imagen_url: string | null
  }
  dias_restantes: number
  nivel_riesgo: NivelRiesgo
}

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
    cod_art: string | null
    codigo_barras: string | null
    gramaje: string | null
    marca: string | null
    categoria: string | null
    stock_actual: number
    venta_media_diaria: number
    familia_id: string | null
    imagen_url: string | null
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
  sinFamilias: boolean
}

export function useVencimientosLista(): UseVencimientosListaReturn {
  const { esAdmin, familiaIds, sinFamilias, loading: famLoading } = useUsuarioFamilias()
  const { sucursalId } = useSucursalActual()
  const [rawVencimientos, setRawVencimientos] = useState<VencimientoConProducto[]>([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroNivel, setFiltroNivel] = useState<FiltroNivel>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchData = useCallback(async (): Promise<void> => {
    setFetchLoading(true)
    setError(null)

    const { data: rows, error: fetchError } = await supabase
      .from('vencimientos')
      .select(`
        id, producto_id, sucursal_id, usuario_id, cantidad, lote,
        fecha_vencimiento, fecha_carga, activo, created_at,
        productos (
          descripcion, cod_art, codigo_barras, gramaje, marca, categoria,
          stock_actual, venta_media_diaria, familia_id, imagen_url
        )
      `)
      .eq('activo', true)
      .eq('sucursal_id', sucursalId)
      .order('fecha_vencimiento', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setFetchLoading(false)
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
          row.cantidad,
          row.productos.venta_media_diaria,
        )
        return {
          ...row,
          familia_id: row.productos.familia_id,
          productos: row.productos,
          dias_restantes: diasRestantes,
          nivel_riesgo: nivelRiesgo,
        }
      })
      .sort((a, b) => a.dias_restantes - b.dias_restantes)

    setRawVencimientos(procesados)
    setFetchLoading(false)
  }, [sucursalId])

  const refetch = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData, refreshKey])

  const vencimientosTodos = useMemo(() => {
    if (famLoading) return []
    if (esAdmin) return rawVencimientos
    if (familiaIds.length === 0) return []
    return rawVencimientos.filter((v) => v.familia_id !== null && familiaIds.includes(v.familia_id))
  }, [rawVencimientos, esAdmin, familiaIds, famLoading])

  const loading = famLoading || fetchLoading

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
    sinFamilias,
  }
}
