import { useNovenAccessContext } from '@/context/NovenAccessContext'
import type { RolUsuario, UsuarioPerfil } from '@/types/index'

interface UseUsuarioRolReturn {
  perfil: UsuarioPerfil | null
  rol: RolUsuario | null
  isAdmin: boolean
  loading: boolean
}

/** Perfil legacy compatible, leído del snapshot de autorización compartido. */
export function useUsuarioRol(): UseUsuarioRolReturn {
  const { perfil, authLoading, loading } = useNovenAccessContext()
  return {
    perfil,
    rol: perfil?.rol ?? null,
    isAdmin: perfil?.rol === 'admin',
    loading: authLoading || loading,
  }
}
