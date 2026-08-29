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

interface VencimientoOperativoRow {
  id: string
  producto_id: string
  sucursal_id: string
  usuario_id: string
  cantidad: number
  lote: string | null
  fecha_vencimiento: string
  fecha_carga: string
  activo: boolean
  created_at: string
  nivel_actual: string | null
  organizacion_id: string
  cod_art: string
  codigo_barras: string | null
  descripcion: string
  marca: string | null
  gramaje: string | null
  categoria: string | null
  proveedor: string | null
  sector: string | null
  precio_costo: number | null
  imagen_url: string | null
  imagen_thumb_url: string | null
  familia_id: string | null
  sector_id: string | null
  sector_nombre: string | null
  dias_donacion: number | null
  producto_activo: boolean
  producto_created_at: string
  producto_updated_at: string
  stock_actual: number
  venta_media_diaria: number
}

interface IntervencionRagResumenRow {
  vencimiento_id: string
  porcentaje_descuento: number
  aplicado_at: string
  finalizado_at: string | null
  motivo_finalizacion: string | null
  nota_finalizacion: string | null
}

/** Narrowing helper para el camino legacy. */
function hasProducto(
  row: Vencimiento & { producto: Producto | null },
): row is Vencimiento & { producto: Producto } {
  return row.producto !== null
}

function vistaOperativaNoDisponible(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205'
}

function mapOperativo(row: VencimientoOperativoRow): Vencimiento & {
  producto: Producto
  nivel_actual: string | null
} {
  const producto: Producto = {
    id: row.producto_id,
    cod_art: row.cod_art,
    codigo_barras: row.codigo_barras,
    descripcion: row.descripcion,
    marca: row.marca,
    gramaje: row.gramaje,
    categoria: row.categoria,
    proveedor: row.proveedor,
    sector: row.sector_nombre ?? row.sector,
    venta_media_diaria: row.venta_media_diaria,
    stock_actual: row.stock_actual,
    precio_costo: row.precio_costo,
    imagen_url: row.imagen_url,
    imagen_thumb_url: row.imagen_thumb_url,
    familia_id: row.familia_id,
    activo: row.producto_activo,
    created_at: row.producto_created_at,
    updated_at: row.producto_updated_at,
    organizacion_id: row.organizacion_id,
  }

  return {
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
    producto,
    nivel_actual: row.nivel_actual,
    dias_donacion: row.dias_donacion,
  }
}

async function cargarLegacy(sucursalId: string): Promise<{
  rows: (Vencimiento & { producto: Producto | null; nivel_actual: string | null })[]
  error: string | null
}> {
  const { data, error } = await supabase
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
      nivel_actual,
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
        imagen_thumb_url,
        activo,
        created_at,
        updated_at
      )
    `,
    )
    .eq('sucursal_id', sucursalId)
    .eq('activo', true)
    .order('fecha_vencimiento', { ascending: true })

  if (error) return { rows: [], error: error.message }

  return {
    rows: (data ?? []) as unknown as (Vencimiento & {
      producto: Producto | null
      nivel_actual: string | null
    })[],
    error: null,
  }
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

    const { data: operativos, error: operativoError } = await supabase
      .from('v_vencimientos_operativos')
      .select(
        'id, producto_id, sucursal_id, usuario_id, cantidad, lote, fecha_vencimiento, fecha_carga, activo, created_at, nivel_actual, organizacion_id, cod_art, codigo_barras, descripcion, marca, gramaje, categoria, proveedor, sector, precio_costo, imagen_url, imagen_thumb_url, familia_id, sector_id, sector_nombre, dias_donacion, producto_activo, producto_created_at, producto_updated_at, stock_actual, venta_media_diaria',
      )
      .eq('sucursal_id', sucursalId)
      .eq('activo', true)
      .order('fecha_vencimiento', { ascending: true })

    let typed: (Vencimiento & { producto: Producto; nivel_actual: string | null })[]

    if (!operativoError) {
      typed = ((operativos ?? []) as unknown as VencimientoOperativoRow[]).map(mapOperativo)
    } else if (vistaOperativaNoDisponible(operativoError)) {
      const legacy = await cargarLegacy(sucursalId)
      if (legacy.error) {
        setFetchError(legacy.error)
        setFetchLoading(false)
        return
      }
      typed = legacy.rows.filter(hasProducto)
    } else {
      setFetchError(operativoError.message)
      setFetchLoading(false)
      return
    }

    const hoyDate = new Date()
    const conRiesgoBase: VencimientoConRiesgo[] = typed
      // NULL significa fuera del circuito. Nunca inferimos una ventana alternativa.
      .filter((row): row is typeof row & { dias_donacion: number } => row.dias_donacion != null)
      .map((row) => calcularRiesgo(row, row.producto, hoyDate))
      .sort((a, b) => a.dias_restantes - b.dias_restantes)

    let conRiesgo: VencimientoConRiesgo[] = conRiesgoBase

    if (conRiesgoBase.length > 0) {
      const { data: intervencionesRag, error: intervencionesRagError } = await supabase
        .from('intervenciones_rag')
        .select('vencimiento_id, porcentaje_descuento, aplicado_at, finalizado_at, motivo_finalizacion, nota_finalizacion')
        .in('vencimiento_id', conRiesgoBase.map((row) => row.id))
        .order('aplicado_at', { ascending: false })

      if (!intervencionesRagError) {
        const estadoPorVencimiento = new Map<string, {
          rag_porcentaje: number | null
          oferta_centralizada: boolean
          oferta_centralizada_nota: string | null
        }>()

        for (const row of (intervencionesRag ?? []) as IntervencionRagResumenRow[]) {
          if (estadoPorVencimiento.has(row.vencimiento_id)) continue

          const ragActivo = row.finalizado_at == null
            && Number.isFinite(row.porcentaje_descuento)
            && row.porcentaje_descuento > 0

          estadoPorVencimiento.set(row.vencimiento_id, {
            rag_porcentaje: ragActivo ? row.porcentaje_descuento : null,
            oferta_centralizada: !ragActivo && row.motivo_finalizacion === 'oferta_centralizada',
            oferta_centralizada_nota: row.motivo_finalizacion === 'oferta_centralizada'
              ? row.nota_finalizacion
              : null,
          })
        }

        conRiesgo = conRiesgoBase.map((row) => {
          const estado = estadoPorVencimiento.get(row.id)
          return {
            ...row,
            rag_porcentaje: estado?.rag_porcentaje ?? null,
            oferta_centralizada: estado?.oferta_centralizada ?? false,
            oferta_centralizada_nota: estado?.oferta_centralizada_nota ?? null,
          }
        })
      } else if (!vistaOperativaNoDisponible(intervencionesRagError)) {
        console.error('[useVencimientos] intervenciones RAG:', intervencionesRagError)
      }
    }

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
