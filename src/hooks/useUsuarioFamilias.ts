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
 * En multitenant replica el alcance operacional de PostgreSQL:
 * - gerente_zonal: todas las familias, sólo dentro de su zona y para lectura;
 * - gerente_sucursal/supervisor: todas las familias, sólo en su sucursal;
 * - operador: sólo usuario_familias_sucursal para ESA sucursal.
 *
 * `admin_organizacion` es una capacidad jerárquica y no amplía el contexto
 * operativo por sí sola. RLS sigue siendo la barrera real.
 */
export function useUsuarioFamilias(): UseUsuarioFamiliasReturn {
  const { perfil, isAdmin: legacyAdmin, loading: rolLoading } = useUsuarioRol()
  const { accesos, loading: accesosLoading, legacyMode } = useAccesosMultitenant()
  const {
    sucursalId,
    sucursalesPermitidas,
    loading: sucursalLoading,
  } = useSucursalActual()
  const [familiaIds, setFamiliaIds] = useState<string[]>([])
  const [famLoading, setFamLoading] = useState(true)

  const sucursalActual = useMemo(
    () => sucursalesPermitidas.find((s) => s.id === sucursalId) ?? null,
    [sucursalId, sucursalesPermitidas],
  )

  const veTodasFamilias = useMemo(() => {
    if (legacyMode) return legacyAdmin
    if (!sucursalId || !sucursalActual) return false

    return accesos.some((a) => {
      if (!a.activo || a.organizacion_id !== sucursalActual.organizacion_id) return false

      if (a.rol === 'gerente_zonal') {
        return Boolean(a.zona_id) && a.zona_id === sucursalActual.zona_id
      }
      if (a.rol === 'gerente_sucursal' || a.rol === 'supervisor') {
        return a.sucursal_id === sucursalId
      }
      return false
    })
  }, [accesos, legacyAdmin, legacyMode, sucursalActual, sucursalId])

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
  const sinFamilias = Boolean(sucursalId) && !loading && !veTodasFamilias && familiaIds.length === 0

  return {
    esAdmin: veTodasFamilias,
    familiaIds,
    sinFamilias,
    loading,
  }
}
