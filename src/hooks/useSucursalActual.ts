import { useMemo } from 'react'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'

// UUID de la sucursal legacy para mantener compatibilidad con producción actual
const SUCURSAL_LEGACY = '00000000-0000-0000-0000-000000000001'

interface UseSucursalActualReturn {
  /** Cadena vacía cuando el scope requiere que el usuario elija una sucursal. */
  sucursalId: string
  loading: boolean
  legacyMode: boolean
  requiereSeleccionSucursal: boolean
}

/**
 * Resuelve la sucursal operativa sin otorgar permisos desde el frontend.
 *
 * - Antes del cutover: conserva exactamente el comportamiento legacy de 091.
 * - Después del cutover: si el usuario tiene UN único scope de sucursal, lo usa.
 * - Gerentes zonales/organización o usuarios con varias sucursales NO caen a 091:
 *   devuelven `requiereSeleccionSucursal=true` hasta que el selector de contexto
 *   elija una sucursal permitida por RLS.
 */
export function useSucursalActual(): UseSucursalActualReturn {
  const { perfil, loading: rolLoading } = useUsuarioRol()
  const {
    accesos,
    loading: accesosLoading,
    legacyMode,
  } = useAccesosMultitenant()

  const sucursalesDirectas = useMemo(
    () => Array.from(new Set(accesos.map((a) => a.sucursal_id).filter((id): id is string => id !== null))),
    [accesos],
  )

  if (accesosLoading || rolLoading) {
    return {
      sucursalId: '',
      loading: true,
      legacyMode,
      requiereSeleccionSucursal: false,
    }
  }

  if (legacyMode) {
    return {
      sucursalId: perfil?.sucursal_id ?? SUCURSAL_LEGACY,
      loading: false,
      legacyMode: true,
      requiereSeleccionSucursal: false,
    }
  }

  if (sucursalesDirectas.length === 1) {
    return {
      sucursalId: sucursalesDirectas[0],
      loading: false,
      legacyMode: false,
      requiereSeleccionSucursal: false,
    }
  }

  return {
    sucursalId: '',
    loading: false,
    legacyMode: false,
    requiereSeleccionSucursal: true,
  }
}
