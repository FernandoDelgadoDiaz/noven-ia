import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  calcularDiasRestantes,
  calcularNivelRiesgo,
} from '@/lib/riesgo'
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
  dias_donacion: number
  productos: {
    descripcion: string
    cod_art: string | null
    codigo_barras: string | null
    gramaje: string | null
    marca: string | null
    categoria: string | null
    sector: string | null
    stock_actual: number
    venta_media_diaria: number
    imagen_url: string | null
  }
  dias_restantes: number
  nivel_riesgo: NivelRiesgo
}

interface RawLegacyRow {
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
    sector: string | null
    stock_actual: number
    venta_media_diaria: number
    familia_id: string | null
    imagen_url: string | null
  } | null
}

interface RawOperativoRow {
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
  descripcion: string
  cod_art: string | null
  codigo_barras: string | null
  gramaje: string | null
  marca: string | null
  categoria: string | null
  sector: string | null
  sector_nombre: string | null
  dias_donacion: number | null
  stock_actual: number
  venta_media_diaria: number
  familia_id: string | null
  imagen_url: string | null
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

function vistaOperativaNoDisponible(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function procesarFila(
  row: Omit<VencimientoConProducto, 'dias_restantes' | 'nivel_riesgo' | 'familia_id' | 'dias_donacion'> & {
    familia_id?: string | null
    dias_donacion?: number | null
  },
): VencimientoConProducto | null {
  // NULL significa sector fuera del circuito. No hay fallback técnico.
  if (row.dias_donacion == null) return null

  const diasRestantes = calcularDiasRestantes(row.fecha_vencimiento)
  const diasDonacion = row.dias_donacion
  const nivelRiesgo = calcularNivelRiesgo(
    diasRestantes,
    row.cantidad,
    row.productos.venta_media_diaria,
    diasDonacion,
  )

  return {
    ...row,
    familia_id: row.productos ? (row.familia_id ?? null) : null,
    dias_donacion: diasDonacion,
    dias_restantes: diasRestantes,
    nivel_riesgo: nivelRiesgo,
  }
}

function esVencimientoProcesado(row: VencimientoConProducto | null): row is VencimientoConProducto {
  return row !== null
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
    if (!sucursalId) {
      setRawVencimientos([])
      setFetchLoading(false)
      return
    }

    setFetchLoading(true)
    setError(null)

    const desde = new Date()
    desde.setDate(desde.getDate() - 90)
    const desdeIso = desde.toISOString().slice(0, 10)

    const { data: operativos, error: operativoError } = await supabase
      .from('v_vencimientos_operativos')
      .select(
        'id, producto_id, sucursal_id, usuario_id, cantidad, lote, fecha_vencimiento, fecha_carga, activo, created_at, descripcion, cod_art, codigo_barras, gramaje, marca, categoria, sector, sector_nombre, dias_donacion, stock_actual, venta_media_diaria, familia_id, imagen_url',
      )
      .eq('activo', true)
      .eq('sucursal_id', sucursalId)
      .gte('fecha_vencimiento', desdeIso)
      .order('fecha_vencimiento', { ascending: true })

    if (!operativoError) {
      const procesados = ((operativos ?? []) as unknown as RawOperativoRow[])
        .map((row) =>
          procesarFila({
            id: row.id,
            producto_id: row.producto_id,
            sucursal_id: row.sucursal_id,
            usuario_id: row.usuario_id,
            cantidad: row.cantidad,
            lote: row.lote,
            fecha_vencimiento: row.fecha_vencimiento,
            fecha_carga: row.fecha_carga,
            activo: row.activo,
            created_at: row.created_at,
            familia_id: row.familia_id,
            dias_donacion: row.dias_donacion,
            productos: {
              descripcion: row.descripcion,
              cod_art: row.cod_art,
              codigo_barras: row.codigo_barras,
              gramaje: row.gramaje,
              marca: row.marca,
              categoria: row.categoria,
              sector: row.sector_nombre ?? row.sector,
              stock_actual: row.stock_actual,
              venta_media_diaria: row.venta_media_diaria,
              imagen_url: row.imagen_url,
            },
          }),
        )
        .filter(esVencimientoProcesado)
        .sort((a, b) => a.dias_restantes - b.dias_restantes)

      setRawVencimientos(procesados)
      setFetchLoading(false)
      return
    }

    if (!vistaOperativaNoDisponible(operativoError)) {
      setError(operativoError.message)
      setFetchLoading(false)
      return
    }

    const { data: rows, error: fetchError } = await supabase
      .from('vencimientos')
      .select(`
        id, producto_id, sucursal_id, usuario_id, cantidad, lote,
        fecha_vencimiento, fecha_carga, activo, created_at,
        productos (
          descripcion, cod_art, codigo_barras, gramaje, marca, categoria, sector,
          stock_actual, venta_media_diaria, familia_id, imagen_url
        )
      `)
      .eq('activo', true)
      .eq('sucursal_id', sucursalId)
      .gte('fecha_vencimiento', desdeIso)
      .order('fecha_vencimiento', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setFetchLoading(false)
      return
    }

    // El camino legacy no expone política autoritativa. Para mantener la regla
    // de no inferencia, no convierte esas filas en riesgo operativo.
    const procesados = ((rows ?? []) as unknown as RawLegacyRow[])
      .filter((row): row is RawLegacyRow & { productos: NonNullable<RawLegacyRow['productos']> } =>
        row.productos !== null,
      )
      .map((row) =>
        procesarFila({
          ...row,
          familia_id: row.productos.familia_id,
          dias_donacion: null,
          productos: row.productos,
        }),
      )
      .filter(esVencimientoProcesado)

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
      if (v.productos.categoria) set.add(v.productos.categoria)
    })
    return Array.from(set).sort()
  }, [vencimientosTodos])

  const vencimientos = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return vencimientosTodos
      .filter((v) => {
        if (filtroNivel !== 'todos' && v.nivel_riesgo !== filtroNivel) return false
        if (filtroCategoria && v.productos.categoria !== filtroCategoria) return false
        if (termino !== '') {
          const campos = [
            v.productos.descripcion,
            v.productos.marca,
            v.productos.gramaje,
            v.productos.cod_art,
            v.productos.codigo_barras,
          ]
          if (!campos.some((valor) => valor?.toLowerCase().includes(termino))) return false
        }
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
