import { useCallback, useMemo } from 'react'
import { useNovenAccessContext } from '@/hooks/useNovenAccessContext'
import type { RolAccesoMultitenant, UsuarioAcceso } from '@/types/index'

interface UseAccesosMultitenantReturn {
  accesos: UsuarioAcceso[]
  loading: boolean
  legacyMode: boolean
  error: string | null
  refetch: () => Promise<void>
  tieneRol: (roles: RolAccesoMultitenant | RolAccesoMultitenant[]) => boolean
}

/** Fuente compatible de permisos, respaldada por el snapshot global de acceso. */
export function useAccesosMultitenant(): UseAccesosMultitenantReturn {
  const {
    accesos,
    authLoading,
    loading,
    legacyMode,
    accesosError,
    refreshAuthorization,
  } = useNovenAccessContext()

  const roles = useMemo(() => new Set(accesos.map((a) => a.rol)), [accesos])
  const tieneRol = useCallback(
    (buscado: RolAccesoMultitenant | RolAccesoMultitenant[]): boolean => {
      const lista = Array.isArray(buscado) ? buscado : [buscado]
      return lista.some((rol) => roles.has(rol))
    },
    [roles],
  )

  return {
    accesos,
    loading: authLoading || loading,
    legacyMode,
    error: accesosError,
    refetch: refreshAuthorization,
    tieneRol,
  }
}
