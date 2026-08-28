import { Navigate, Outlet } from 'react-router-dom'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'
import { useNovenAccessContext } from '@/hooks/useNovenAccessContext'

export default function AccessAdminRoute() {
  const { accesos, loading, legacyMode } = useAccesosMultitenant()
  const { sucursalesPermitidas } = useNovenAccessContext()

  const esAdministradorJerarquia = !legacyMode
    && accesos.some((acceso) => acceso.rol === 'admin_organizacion' && acceso.activo)
    && accesos.some((acceso) =>
      acceso.rol === 'gerente_sucursal'
      && acceso.activo
      && Boolean(acceso.sucursal_id)
      && sucursalesPermitidas.some((sucursal) =>
        sucursal.id === acceso.sucursal_id && sucursal.codigo === '091',
      ),
    )

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

  if (!esAdministradorJerarquia) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
