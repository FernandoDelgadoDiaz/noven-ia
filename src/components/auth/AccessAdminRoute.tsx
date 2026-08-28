import { Navigate, Outlet } from 'react-router-dom'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'

export default function AccessAdminRoute() {
  const { tieneRol, loading } = useAccesosMultitenant()
  const permitido = tieneRol(['admin_organizacion', 'gerente_zonal'])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-brand" />
          <p className="text-sm text-muted-foreground">Verificando alcance...</p>
        </div>
      </div>
    )
  }

  if (!permitido) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
