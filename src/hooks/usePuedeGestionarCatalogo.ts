import { useMemo } from 'react'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'
import { useSucursalActual } from '@/hooks/useSucursalActual'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'

interface UsePuedeGestionarCatalogoReturn {
  puedeGestionar: boolean
  loading: boolean
  sucursalesGestionables: ReadonlySet<string>
}

/**
 * Capacidad local para importación y clasificación de catálogo.
 *
 * La jerarquía y el rol zonal son de lectura/seguimiento y nunca amplían esta
 * capacidad. Los operadores tampoco clasifican catálogo global. En el modelo
 * multitenant sólo gerente_sucursal y supervisor pueden escribir para una
 * sucursal exacta, en línea con los gates server-side.
 */
export function usePuedeGestionarCatalogo(): UsePuedeGestionarCatalogoReturn {
  const { accesos, loading: accesosLoading, legacyMode } = useAccesosMultitenant()
  const { sucursalId, loading: sucursalLoading } = useSucursalActual()
  const { perfil, isAdmin, loading: rolLoading } = useUsuarioRol()

  const sucursalesGestionables = useMemo(() => {
    const ids = new Set<string>()

    if (legacyMode) {
      // Compatibilidad cerrada: conserva únicamente el antiguo admin local.
      if (isAdmin && perfil?.sucursal_id) ids.add(perfil.sucursal_id)
      return ids
    }

    for (const acceso of accesos) {
      if (!acceso.activo || !acceso.sucursal_id) continue
      if (['gerente_sucursal', 'supervisor'].includes(acceso.rol)) {
        ids.add(acceso.sucursal_id)
      }
    }
    return ids
  }, [accesos, isAdmin, legacyMode, perfil?.sucursal_id])

  return {
    puedeGestionar: Boolean(sucursalId) && sucursalesGestionables.has(sucursalId),
    loading: accesosLoading || sucursalLoading || rolLoading,
    sucursalesGestionables,
  }
}
