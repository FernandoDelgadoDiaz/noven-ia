import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'
import type { Sucursal } from '@/types/index'

const SUCURSAL_LEGACY = '00000000-0000-0000-0000-000000000001'

interface UseSucursalesAccesiblesReturn {
  sucursales: Sucursal[]
  loading: boolean
  error: string | null
  legacyMode: boolean
  refetch: () => Promise<void>
}

interface SucursalMultitenant extends Sucursal {
  codigo: string
  organizacion_id: string
  zona_id: string
}

/**
 * Devuelve las sucursales que pueden formar parte del contexto operativo.
 *
 * Seguridad real = RLS. El filtro local es una defensa adicional transitoria,
 * porque hasta el cutover `sucursales` conserva una policy legacy USING(true).
 */
export function useSucursalesAccesibles(): UseSucursalesAccesiblesReturn {
  const { perfil, loading: rolLoading } = useUsuarioRol()
  const { accesos, loading: accesosLoading, legacyMode } = useAccesosMultitenant()
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const scope = useMemo(() => {
    const organizaciones = new Set<string>()
    const zonas = new Set<string>()
    const sucursalesDirectas = new Set<string>()

    for (const acceso of accesos) {
      if (!acceso.activo) continue
      if (acceso.rol === 'admin_organizacion') organizaciones.add(acceso.organizacion_id)
      if (acceso.rol === 'gerente_zonal' && acceso.zona_id) zonas.add(acceso.zona_id)
      if (acceso.sucursal_id) sucursalesDirectas.add(acceso.sucursal_id)
    }

    return { organizaciones, zonas, sucursalesDirectas }
  }, [accesos])

  const fetchData = useCallback(async (): Promise<void> => {
    if (rolLoading || accesosLoading) return
    if (!perfil) {
      setSucursales([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    if (legacyMode) {
      const id = perfil.sucursal_id ?? SUCURSAL_LEGACY
      const { data, error: queryError } = await supabase
        .from('sucursales')
        .select('id, nombre, direccion, activa, created_at')
        .eq('id', id)
        .maybeSingle()

      if (queryError) {
        setSucursales([])
        setError(queryError.message)
      } else {
        setSucursales(data ? [data as Sucursal] : [])
      }
      setLoading(false)
      return
    }

    const { data, error: queryError } = await supabase
      .from('sucursales')
      .select('id, codigo, organizacion_id, zona_id, nombre, direccion, activa, created_at')
      .eq('activa', true)
      .order('codigo', { ascending: true })

    if (queryError) {
      setSucursales([])
      setError(queryError.message)
      setLoading(false)
      return
    }

    const permitidas = ((data ?? []) as SucursalMultitenant[]).filter((s) =>
      scope.organizaciones.has(s.organizacion_id)
      || scope.zonas.has(s.zona_id)
      || scope.sucursalesDirectas.has(s.id),
    )

    setSucursales(permitidas)
    setLoading(false)
  }, [perfil, legacyMode, scope, rolLoading, accesosLoading])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return {
    sucursales,
    loading: loading || rolLoading || accesosLoading,
    error,
    legacyMode,
    refetch: fetchData,
  }
}
