import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'
import { useSucursalActual } from '@/hooks/useSucursalActual'

interface UseUsuarioFamiliasReturn {
  /** Nombre legacy: significa que el usuario ve todas las familias de su contexto. */
  esAdmin: boolean
  familiaIds: string[]
  sinFamilias: boolean
  loading: boolean
}

/**
 * Familias visibles del usuario dentro de la sucursal operativa actual.
 *
 * Compatibilidad:
 * - legacy: conserva `usuario_familias` + admin global de la app actual;
 * - multitenant: gerente/supervisor ven todas las familias de su contexto;
 *   operador solo las filas de `usuario_familias_sucursal` para ESA sucursal.
 *
 * RLS sigue siendo la barrera real. Este hook solo evita mostrar en UI datos que
 * la base igualmente rechazará.
 */
export function useUsuarioFamilias(): UseUsuarioFamiliasReturn {
  const { perfil, isAdmin: legacyAdmin, loading: rolLoading } = useUsuarioRol()
  const { accesos, loading: accesosLoading, legacyMode } = useAccesosMultitenant()
  const { sucursalId, loading: sucursalLoading } = useSucursalActual()
  const [familiaIds, setFamiliaIds] = useState<string[]>([])
  const [famLoading, setFamLoading] = useState(true)

  const veTodasFamilias = useMemo(() => {
    if (legacyMode) return legacyAdmin
    return accesos.some((a) =>
      a.activo &&
      ['admin_organizacion', 'gerente_zonal', 'gerente_sucursal', 'supervisor'].includes(a.rol),
    )
  }, [accesos, legacyAdmin, legacyMode])

  useEffect(() => {
    if (rolLoading || accesosLoading || sucursalLoading) return

    if (!perfil) {
      setFamiliaIds([])
      setFamLoading(false)
      return
    }

    if (veTodasFamilias) {
      setFamiliaIds([])
      setFamLoading(false)
      return
    }

    setFamLoading(true)

    if (legacyMode) {
      void supabase
        .from('usuario_familias')
        .select('familia_id')
        .eq('usuario_id', perfil.id)
        .then(({ data, error }) => {
          setFamiliaIds(error || !data ? [] : data.map((row) => row.familia_id as string))
          setFamLoading(false)
        })
      return
    }

    if (!sucursalId) {
      setFamiliaIds([])
      setFamLoading(false)
      return
    }

    void supabase
      .from('usuario_familias_sucursal')
      .select('familia_id')
      .eq('usuario_id', perfil.id)
      .eq('sucursal_id', sucursalId)
      .eq('activo', true)
      .then(({ data, error }) => {
        setFamiliaIds(error || !data ? [] : data.map((row) => row.familia_id as string))
        setFamLoading(false)
      })
  }, [
    perfil,
    legacyMode,
    veTodasFamilias,
    sucursalId,
    rolLoading,
    accesosLoading,
    sucursalLoading,
  ])

  const loading = rolLoading || accesosLoading || sucursalLoading || famLoading
  const sinFamilias = !loading && !veTodasFamilias && familiaIds.length === 0

  return {
    esAdmin: veTodasFamilias,
    familiaIds,
    sinFamilias,
    loading,
  }
}
