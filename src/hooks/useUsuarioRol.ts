import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { RolUsuario, UsuarioPerfil } from '@/types/index'

interface UseUsuarioRolReturn {
  perfil: UsuarioPerfil | null
  rol: RolUsuario | null
  isAdmin: boolean
  loading: boolean
}

export function useUsuarioRol(): UseUsuarioRolReturn {
  const { user } = useAuth()
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setPerfil(null)
      setLoading(false)
      return
    }

    setLoading(true)
    supabase
      .from('usuarios')
      .select('id, nombre, rol, sucursal_id, activo')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setPerfil(null)
        } else {
          setPerfil(data as UsuarioPerfil)
        }
        setLoading(false)
      })
  }, [user])

  return {
    perfil,
    rol: perfil?.rol ?? null,
    isAdmin: perfil?.rol === 'admin',
    loading,
  }
}
