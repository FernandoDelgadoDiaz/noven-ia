import { Navigate, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'

export default function StandardAppRoute({ children }: { children?: ReactNode }) {
  const { accesos, loading, legacyMode } = useAccesosMultitenant()
  const activos = accesos.filter((acceso) => acceso.activo)
  const esSoloAdministrativaPrecios = !legacyMode
    && activos.length > 0
    && activos.every((acceso) => acceso.rol === 'administrativa_precios_zonal')

  if (loading) return null
  if (esSoloAdministrativaPrecios) return <Navigate to="/rag/zona" replace />
  return children ? <>{children}</> : <Outlet />
}
