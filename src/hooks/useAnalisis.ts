import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
import { useUsuarioFamilias } from '@/hooks/useUsuarioFamilias'

const CACHE_KEY = 'analisis_cache'

interface AnalisisCache {
  analisis: string
  generado_en: string
}

function leerCache(): AnalisisCache | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as AnalisisCache | null
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
  const { rol } = useUsuarioRol()
  const { familiaIds } = useUsuarioFamilias()

  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<string | null>(() => leerCache()?.analisis ?? null)
  const [error, setError] = useState<string | null>(null)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(
    () => leerCache()?.generado_en ?? null,
  )

  const generarAnalisis = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setError('Sesión expirada. Volvé a iniciar sesión.')
        return
      }

      const res = await fetch('/.netlify/functions/analisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ usuario_id: user?.id, rol, familia_ids: familiaIds }),
      })
      const data = (await res.json()) as {
        success: boolean
        analisis?: string
        generado_en?: string
        error?: string
      }

      if (!res.ok || !data.success || !data.analisis) {
        setError(data.error ?? 'No se pudo generar el análisis.')
        return
      }

      const generado = data.generado_en ?? new Date().toISOString()
      setResultado(data.analisis)
      setUltimaActualizacion(generado)
      localStorage.setItem(CACHE_KEY, JSON.stringify({ analisis: data.analisis, generado_en: generado }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error de red al generar el análisis.')
    } finally {
      setLoading(false)
    }
  }, [user, rol, familiaIds])

  return { loading, resultado, error, ultimaActualizacion, generarAnalisis }
}
