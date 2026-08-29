import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'
import { useNovenAccessContext } from '@/hooks/useNovenAccessContext'

export function usePuedeGestionarCatalogo() {
  const { accesos, loading: accesosLoading, legacyMode } = useAccesosMultitenant()
  const { sucursalId, loading: contextoLoading } = useNovenAccessContext()

  const puedeGestionar = legacyMode
    ? true
    : Boolean(sucursalId) && accesos.some((acceso) =>
      acceso.activo
      && acceso.sucursal_id === sucursalId
      && ['gerente_sucursal', 'supervisor'].includes(acceso.rol),
    )

  return {
    puedeGestionar,
    loading: accesosLoading || contextoLoading,
  }
}
