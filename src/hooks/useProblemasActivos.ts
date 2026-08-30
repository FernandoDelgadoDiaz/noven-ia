import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type EstadoProblemaActivo =
  | 'requiere_cierre'
  | 'escalado_sin_respuesta'
  | 'requiere_revision'
  | 'requiere_intervencion'
  | 'intervencion_aplicada'
  | 'bajo_control'
  | 'dato_a_revisar'

export interface ProblemaActivo {
  vencimiento_id: string
  producto_id: string
  descripcion: string
  cod_art: string
  marca: string | null
  familia_id: string | null
  nivel: 'decomiso' | 'donacion' | 'urgente' | 'radar'
  estado_problema: EstadoProblemaActivo
  motivo_prioridad: string
  prioridad_orden: number
  dias_hasta_vencimiento: number
  dias_comerciales_restantes: number
  cantidad_comprometida: number
  unidades_expuestas: number
  costo_unitario_sin_iva: number | null
  dinero_en_riesgo_sin_iva: number | null
  rag_porcentaje: number | null
  estado_seguimiento_rag: string
  velocidad_observada: number | null
  velocidad_necesaria: number | null
  ultimo_control_at: string | null
  escalamiento_id: string | null
  escalado_at: string | null
  notificado: boolean
  push_destinatarios: number | null
  push_enviados: number | null
  ultima_respuesta_at: string | null
  ultima_respuesta_por: string | null
  ultima_respuesta_tipo: string | null
}

export interface ResumenProblemasActivos {
  abiertos: number
  sin_respuesta: number
  bajo_control: number
  requieren_accion: number
  unidades_expuestas: number
  dinero_en_riesgo_sin_iva: number
  valorizados: number
}

interface ProblemasActivosResponse {
  success: boolean
  error?: string
  resumen?: ResumenProblemasActivos
  problemas?: ProblemaActivo[]
  criterio?: string
}

interface ProblemasActivosState {
  resumen: ResumenProblemasActivos
  problemas: ProblemaActivo[]
  loading: boolean
  error: string | null
}

const RESUMEN_VACIO: ResumenProblemasActivos = {
  abiertos: 0,
  sin_respuesta: 0,
  bajo_control: 0,
  requieren_accion: 0,
  unidades_expuestas: 0,
  dinero_en_riesgo_sin_iva: 0,
  valorizados: 0,
}

export function useProblemasActivos(sucursalId: string | null) {
  const [state, setState] = useState<ProblemasActivosState>({
    resumen: { ...RESUMEN_VACIO },
    problemas: [],
    loading: true,
    error: null,
  })
  const requestSeq = useRef(0)

  const fetchData = useCallback(async (): Promise<void> => {
    const requestId = ++requestSeq.current

    if (!sucursalId) {
      setState({ resumen: { ...RESUMEN_VACIO }, problemas: [], loading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Sesión no disponible')

      const response = await fetch('/.netlify/functions/problemas-activos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sucursalId }),
      })

      const payload = await response.json() as ProblemasActivosResponse
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'No se pudo cargar el seguimiento de problemas')
      }
      if (requestSeq.current !== requestId) return

      setState({
        resumen: payload.resumen ?? { ...RESUMEN_VACIO },
        problemas: payload.problemas ?? [],
        loading: false,
        error: null,
      })
    } catch (err) {
      if (requestSeq.current !== requestId) return
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'No se pudo cargar el seguimiento de problemas',
      }))
    }
  }, [sucursalId])

  useEffect(() => {
    void fetchData()
    return () => {
      requestSeq.current += 1
    }
  }, [fetchData])

  return {
    ...state,
    refetch: fetchData,
  }
}
