import { Navigate } from 'react-router-dom'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'

export default function DefaultAuthenticatedRoute() {
  const { accesos, loading, legacyMode } = useAccesosMultitenant()
  const activos = accesos.filter((acceso) => acceso.activo)
  const esSoloAdministrativaPrecios = !legacyMode
    && activos.length > 0
    && activos.every((acceso) => acceso.rol === 'administrativa_precios_zonal')

  if (loading) return null
  return <Navigate to={esSoloAdministrativaPrecios ? '/rag/zona' : '/dashboard'} replace />
}
