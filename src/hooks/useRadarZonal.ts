import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type RespuestaRadarZonal = 'misma_fecha' | 'otra_fecha' | 'no_lo_tengo' | 'revisar_despues'

export interface AlertaRadarZonal {
  destino_id: string
  alerta_id: string
  estado: 'pendiente' | 'revisar_despues'
  producto_id: string
  cod_art: string
  codigo_barras: string | null
  descripcion: string
  marca: string | null
  gramaje: string | null
  imagen_thumb_url: string | null
  familia_id: string
  fecha_vencimiento: string
  nivel_origen: 'radar' | 'urgente' | 'donacion' | 'decomiso'
  sucursal_origen_id: string
  sucursal_origen_codigo: string
  sucursal_origen_nombre: string
  sucursal_destino_id: string
  sucursal_destino_codigo: string
  stock_snapshot: number
  stock_actual: number
  stock_actualizado_at: string | null
  created_at: string
}

interface ResponderArgs {
  destinoId: string
  respuesta: RespuestaRadarZonal
  cantidad?: number | null
  fechaOtra?: string | null
}

interface UseRadarZonalReturn {
  alertas: AlertaRadarZonal[]
  cantidadPendiente: number
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  responder: (args: ResponderArgs) => Promise<void>
}

function esRpcAunNoDisponible(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    (error.message ?? '').includes('listar_mis_alertas_zonales_v1')
  )
}

export function useRadarZonal(sucursalId: string): UseRadarZonalReturn {
  const [alertas, setAlertas] = useState<AlertaRadarZonal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (): Promise<void> => {
    if (!sucursalId) {
      setAlertas([])
      setError(null)
      return
    }

    setLoading(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('listar_mis_alertas_zonales_v1', {
        p_sucursal_id: sucursalId,
      })

      if (rpcError) {
        // Permite desplegar el frontend antes de aplicar la migración 00340 sin
        // romper Dashboard durante la ventana de despliegue controlado.
        if (esRpcAunNoDisponible(rpcError)) {
          setAlertas([])
          setError(null)
          return
        }
        throw rpcError
      }

      setAlertas(Array.isArray(data) ? (data as AlertaRadarZonal[]) : [])
      setError(null)
    } catch (err) {
      console.error('[radar-zonal] No se pudieron cargar alertas', err)
      setError('No pudimos cargar Radar Zonal.')
    } finally {
      setLoading(false)
    }
  }, [sucursalId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const responder = useCallback(
    async ({ destinoId, respuesta, cantidad = null, fechaOtra = null }: ResponderArgs): Promise<void> => {
      const { error: rpcError } = await supabase.rpc('responder_alerta_zonal_v1', {
        p_destino_id: destinoId,
        p_respuesta: respuesta,
        p_cantidad: cantidad,
        p_fecha_otra: fechaOtra,
      })

      if (rpcError) throw rpcError
      await refetch()
    },
    [refetch],
  )

  return {
    alertas,
    cantidadPendiente: alertas.length,
    loading,
    error,
    refetch,
    responder,
  }
}
