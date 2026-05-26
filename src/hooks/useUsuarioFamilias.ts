import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'

interface UseUsuarioFamiliasReturn {
  esAdmin: boolean
  familiaIds: string[]
  sinFamilias: boolean
  loading: boolean
}

export function useUsuarioFamilias(): UseUsuarioFamiliasReturn {
  const { perfil, isAdmin, loading: rolLoading } = useUsuarioRol()
  const [familiaIds, setFamiliaIds] = useState<string[]>([])
  const [famLoading, setFamLoading] = useState(true)

  useEffect(() => {
    if (rolLoading) return

    if (!perfil) {
      setFamiliaIds([])
      setFamLoading(false)
      return
    }

    if (isAdmin) {
      setFamiliaIds([])
      setFamLoading(false)
      return
    }

    setFamLoading(true)
    supabase
      .from('usuario_familias')
      .select('familia_id')
      .eq('usuario_id', perfil.id)
      .then(({ data, error }) => {
        if (error || !data) {
          setFamiliaIds([])
        } else {
          setFamiliaIds(data.map((row) => row.familia_id as string))
        }
        setFamLoading(false)
      })
  }, [perfil, isAdmin, rolLoading])

  const loading = rolLoading || famLoading
  const sinFamilias = !loading && !isAdmin && familiaIds.length === 0

  return {
    esAdmin: isAdmin,
    familiaIds,
    sinFamilias,
    loading,
  }
}
