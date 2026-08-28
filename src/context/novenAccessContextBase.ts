import { createContext } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import type { UsuarioAcceso, UsuarioPerfil } from '@/types/index'

export interface SucursalPermitida {
  id: string
  codigo: string
  nombre: string
  zona_id: string
  organizacion_id: string
}

export interface NovenAccessContextValue {
  perfil: UsuarioPerfil | null
  accesos: UsuarioAcceso[]
  legacyMode: boolean
  accesosError: string | null
  sucursalesPermitidas: SucursalPermitida[]
  loading: boolean
  user: User | null
  session: Session | null
  authLoading: boolean
  sucursalId: string
  requiereSeleccionSucursal: boolean
  signIn: (email: string, password: string) => Promise<AuthError | null>
  signOut: () => Promise<void>
  refreshAuthorization: () => Promise<void>
  seleccionarSucursal: (id: string) => void
}

export const NovenAccessContext = createContext<NovenAccessContextValue | null>(null)
