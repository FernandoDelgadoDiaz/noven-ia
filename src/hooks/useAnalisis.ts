import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useSucursalActual } from '@/hooks/useSucursalActual'

interface AnalisisCache {
  analisis: string
  generado_en: string
}

function cacheKey(usuarioId: string, sucursalId: string): string {
  return `analisis_cache:${usuarioId}:${sucursalId}`
}

function leerCache(usuarioId: string, sucursalId: string): AnalisisCache | null {
  if (!usuarioId || !sucursalId) return null
  try {
    return JSON.parse(localStorage.getItem(cacheKey(usuarioId, sucursalId)) ?? 'null') as AnalisisCache | null
  } catch {
    return null
  }
}

interface UseAnalisisReturn {
  loading: boolean
  resultado: string | null
  error: string | null
  ultimaActualizacion: string | null
  generarAnalisis: () => Promise<void>
}

export function useAnalisis(): UseAnalisisReturn {
  const { user } = useAuth()
  const { sucursalId, loading: sucursalLoading } = useSucursalActual()
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null)
  const sucursalActualRef = useRef(sucursalId)

  useEffect(() => {
    sucursalActualRef.current = sucursalId
    setError(null)
    setLoading(false)

    const usuarioId = user?.id ?? ''
    const cache = leerCache(usuarioId, sucursalId)
    setResultado(cache?.analisis ?? null)
    setUltimaActualizacion(cache?.generado_en ?? null)
  }, [user?.id, sucursalId])

  const generarAnalisis = useCallback(async (): Promise<void> => {
    if (sucursalLoading) return
    if (!sucursalId) {
      setError('Seleccioná una sucursal antes de generar el análisis.')
      return
    }

    const usuarioId = user?.id ?? ''
    if (!usuarioId) {
      setError('Sesión expirada. Volvé a iniciar sesión.')
      return
    }

    const sucursalSolicitada = sucursalId
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setError('Sesión expirada. Volvé a iniciar sesión.')
        return
      }

      const res = await fetch('/.netlify/functions/analisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sucursal_id: sucursalSolicitada }),
      })
      const data = await res.json() as {
        success: boolean
        analisis?: string
        generado_en?: string
        sucursal_id?: string
        error?: string
      }

      if (!res.ok || !data.success || !data.analisis) {
        setError(data.error ?? 'No se pudo generar el análisis.')
        return
      }

      if (data.sucursal_id !== sucursalSolicitada || sucursalActualRef.current !== sucursalSolicitada) {
        return
      }

      const generado = data.generado_en ?? new Date().toISOString()
      const cache: AnalisisCache = { analisis: data.analisis, generado_en: generado }
      setResultado(cache.analisis)
      setUltimaActualizacion(cache.generado_en)
      localStorage.setItem(cacheKey(usuarioId, sucursalSolicitada), JSON.stringify(cache))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error de red al generar el análisis.')
    } finally {
      if (sucursalActualRef.current === sucursalSolicitada) setLoading(false)
    }
  }, [user?.id, sucursalId, sucursalLoading])

  return { loading, resultado, error, ultimaActualizacion, generarAnalisis }
}
