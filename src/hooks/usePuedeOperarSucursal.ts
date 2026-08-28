import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'
import { useNovenAccessContext } from '@/hooks/useNovenAccessContext'

export function usePuedeOperarSucursal() {
  const { accesos, loading: accesosLoading, legacyMode } = useAccesosMultitenant()
  const { sucursalId, loading: contextoLoading } = useNovenAccessContext()

  const puedeOperar = legacyMode
    ? true
    : Boolean(sucursalId) && accesos.some((acceso) =>
      acceso.activo
      && acceso.sucursal_id === sucursalId
      && ['gerente_sucursal', 'supervisor', 'operador'].includes(acceso.rol),
    )

  return {
    puedeOperar,
    loading: accesosLoading || contextoLoading,
  }
}
