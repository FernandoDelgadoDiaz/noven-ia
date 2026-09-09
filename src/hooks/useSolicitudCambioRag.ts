import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { SolicitudCambioRagActual } from '@/types/index'

interface EstadoSolicitudCambioRag {
  solicitud: SolicitudCambioRagActual | null
  loading: boolean
  error: string | null
  disponible: boolean
}

interface UseSolicitudCambioRag extends EstadoSolicitudCambioRag {
  refetch: () => Promise<void>
}

function circuitoNoDisponible(error: { code?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01'
    || error.code === 'PGRST205'
}

export function useSolicitudCambioRag(vencimientoId: string): UseSolicitudCambioRag {
  const [estado, setEstado] = useState<EstadoSolicitudCambioRag>({
    solicitud: null,
    loading: true,
    error: null,
    disponible: true,
  })

  const refetch = useCallback(async (): Promise<void> => {
    setEstado((prev) => ({ ...prev, loading: true, error: null }))
    const { data, error } = await supabase
      .from('v_solicitudes_cambio_rag_actual')
      .select('id, organizacion_id, zona_id, sucursal_id, producto_id, vencimiento_id, solicitada_por, porcentaje_rag_vigente, porcentaje_solicitado, creada_at, ultimo_evento, ultimo_actor_id, ultimo_evento_at, habilitada_desde, estado_actual')
      .eq('vencimiento_id', vencimientoId)
      .order('creada_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      if (circuitoNoDisponible(error)) {
        setEstado({ solicitud: null, loading: false, error: null, disponible: false })
        return
      }
      setEstado({ solicitud: null, loading: false, error: error.message, disponible: true })
      return
    }

    setEstado({
      solicitud: (data ?? null) as SolicitudCambioRagActual | null,
      loading: false,
      error: null,
      disponible: true,
    })
  }, [vencimientoId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { ...estado, refetch }
}
