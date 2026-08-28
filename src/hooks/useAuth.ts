import type { User, Session, AuthError } from '@supabase/supabase-js'
import { useNovenAccessContext } from '@/hooks/useNovenAccessContext'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

interface UseAuthReturn extends AuthState {
  signIn: (email: string, password: string) => Promise<AuthError | null>
  signOut: () => Promise<void>
}

/**
 * API compatible con el hook histórico, respaldada por una única sesión global.
 * Montar este hook varias veces ya no abre listeners Auth independientes.
 */
export function useAuth(): UseAuthReturn {
  const { user, session, authLoading, signIn, signOut } = useNovenAccessContext()
  return { user, session, loading: authLoading, signIn, signOut }
}
