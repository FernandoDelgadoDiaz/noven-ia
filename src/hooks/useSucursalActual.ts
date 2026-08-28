import { useNovenAccessContext } from '@/hooks/useNovenAccessContext'
import type { SucursalPermitida } from '@/context/novenAccessContextBase'

export type { SucursalPermitida }

interface UseSucursalActualReturn {
  /** Cadena vacía cuando el scope requiere que el usuario elija una sucursal. */
  sucursalId: string
  loading: boolean
  legacyMode: boolean
  requiereSeleccionSucursal: boolean
  sucursalesPermitidas: SucursalPermitida[]
  seleccionarSucursal: (id: string) => void
}

/**
 * Contexto operativo compatible con el hook histórico. La selección y el alcance
 * se resuelven una sola vez en NovenAccessProvider y todas las pantallas leen el
 * mismo valor en el mismo render.
 */
export function useSucursalActual(): UseSucursalActualReturn {
  const {
    sucursalId,
    authLoading,
    loading,
    legacyMode,
    requiereSeleccionSucursal,
    sucursalesPermitidas,
    seleccionarSucursal,
  } = useNovenAccessContext()

  return {
    sucursalId,
    loading: authLoading || loading,
    legacyMode,
    requiereSeleccionSucursal,
    sucursalesPermitidas,
    seleccionarSucursal,
  }
}
