import { Navigate, Outlet } from 'react-router-dom'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'

export default function RagZonalRoute() {
  const { accesos, loading, legacyMode } = useAccesosMultitenant()
  const puedeGestionarPrecios = !legacyMode && accesos.some((acceso) =>
    acceso.activo
    && acceso.rol === 'administrativa_precios_zonal'
    && Boolean(acceso.zona_id)
    && acceso.sucursal_id === null,
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-muted border-t-brand" />
      </div>
    )
  }

  if (!puedeGestionarPrecios) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
