import { useUsuarioRol } from '@/hooks/useUsuarioRol'

// UUID de la sucursal legacy para mantener compatibilidad con producción actual
const SUCURSAL_LEGACY = '00000000-0000-0000-0000-000000000001'

interface UseSucursalActualReturn {
  sucursalId: string
  loading: boolean
}

/**
 * Devuelve el sucursal_id del perfil del usuario autenticado.
 * Si el perfil no tiene sucursal_id seteado, usa el fallback legacy
 * para mantener compatibilidad con la sucursal existente en producción.
 */
export function useSucursalActual(): UseSucursalActualReturn {
  const { perfil, loading } = useUsuarioRol()
  const sucursalId = perfil?.sucursal_id ?? SUCURSAL_LEGACY
  return { sucursalId, loading }
}
