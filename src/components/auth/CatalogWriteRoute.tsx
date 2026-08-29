import { Navigate, Outlet } from 'react-router-dom'
import { usePuedeGestionarCatalogoSucursal } from '@/hooks/usePuedeGestionarCatalogoSucursal'

export default function CatalogWriteRoute() {
  const { puedeGestionar, loading } = usePuedeGestionarCatalogoSucursal()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="h-8 w-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
      </div>
    )
  }

  if (!puedeGestionar) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
