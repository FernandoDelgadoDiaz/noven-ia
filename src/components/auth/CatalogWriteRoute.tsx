import { Navigate, Outlet } from 'react-router-dom'
import { usePuedeGestionarCatalogo } from '@/hooks/usePuedeGestionarCatalogo'

export default function CatalogWriteRoute() {
  const { puedeGestionar, loading } = usePuedeGestionarCatalogo()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-brand" />
          <p className="text-sm text-muted-foreground">Verificando permiso de catálogo...</p>
        </div>
      </div>
    )
  }

  if (!puedeGestionar) return <Navigate to="/importar/pendientes" replace />
  return <Outlet />
}
