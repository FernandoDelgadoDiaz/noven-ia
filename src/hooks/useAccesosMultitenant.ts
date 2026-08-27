import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { RolAccesoMultitenant, UsuarioAcceso } from '@/types/index'

interface UseAccesosMultitenantReturn {
  accesos: UsuarioAcceso[]
  loading: boolean
  /**
   * true mientras producción todavía no tenga `usuario_accesos`.
   * Permite migrar el frontend antes del cutover de base sin romper 091.
   */
  legacyMode: boolean
  error: string | null
  refetch: () => Promise<void>
  tieneRol: (roles: RolAccesoMultitenant | RolAccesoMultitenant[]) => boolean
}

function tablaMultitenantNoDisponible(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  // PostgreSQL undefined_table / PostgREST schema-cache miss.
  return error.code === '42P01' || error.code === 'PGRST205' || /usuario_accesos/i.test(error.message ?? '')
}

/**
 * Lee la NUEVA fuente de autorización multitenant.
 *
 * No inventa permisos a partir del frontend. La tabla tiene RLS y cada usuario
 * solo puede leer sus propias filas. Mientras la migración todavía no esté
 * aplicada en producción, el hook entra explícitamente en `legacyMode` para que
 * el resto de la app 091 pueda seguir usando `usuarios.rol/sucursal_id`.
 */
export function useAccesosMultitenant(): UseAccesosMultitenantReturn {
  const { user, loading: authLoading } = useAuth()
  const [accesos, setAccesos] = useState<UsuarioAcceso[]>([])
  const [loading, setLoading] = useState(true)
  const [legacyMode, setLegacyMode] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (): Promise<void> => {
    if (authLoading) return
    if (!user) {
      setAccesos([])
      setLegacyMode(false)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('usuario_accesos')
      .select('id, usuario_id, organizacion_id, rol, zona_id, sucursal_id, activo, created_at, updated_at')
      .eq('usuario_id', user.id)
      .eq('activo', true)
      .order('created_at', { ascending: true })

    if (queryError) {
      if (tablaMultitenantNoDisponible(queryError)) {
        setAccesos([])
        setLegacyMode(true)
        setError(null)
      } else {
        setAccesos([])
        setLegacyMode(false)
        setError(queryError.message)
      }
      setLoading(false)
      return
    }

    setAccesos((data ?? []) as UsuarioAcceso[])
    setLegacyMode(false)
    setLoading(false)
  }, [authLoading, user])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const roles = useMemo(() => new Set(accesos.map((a) => a.rol)), [accesos])

  const tieneRol = useCallback(
    (buscado: RolAccesoMultitenant | RolAccesoMultitenant[]): boolean => {
      const lista = Array.isArray(buscado) ? buscado : [buscado]
      return lista.some((rol) => roles.has(rol))
    },
    [roles],
  )

  return { accesos, loading, legacyMode, error, refetch: fetchData, tieneRol }
}
