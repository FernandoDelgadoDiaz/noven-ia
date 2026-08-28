import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UsuarioAcceso, UsuarioPerfil } from '@/types/index'

const SUCURSAL_LEGACY = '00000000-0000-0000-0000-000000000001'
const STORAGE_KEY = 'noven_sucursal_actual'
const STORAGE_EVENT = 'noven:sucursal-cambio'

export interface SucursalPermitida {
  id: string
  codigo: string
  nombre: string
  zona_id: string
  organizacion_id: string
}

interface AuthorizationState {
  perfil: UsuarioPerfil | null
  accesos: UsuarioAcceso[]
  legacyMode: boolean
  accesosError: string | null
  sucursalesPermitidas: SucursalPermitida[]
  loading: boolean
}

interface NovenAccessContextValue extends AuthorizationState {
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

const EMPTY_AUTHORIZATION: AuthorizationState = {
  perfil: null,
  accesos: [],
  legacyMode: false,
  accesosError: null,
  sucursalesPermitidas: [],
  loading: true,
}

const NovenAccessContext = createContext<NovenAccessContextValue | null>(null)

function leerSeleccionPersistida(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

function tablaMultitenantNoDisponible(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || /usuario_accesos/i.test(error.message ?? '')
}

export function NovenAccessProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authorization, setAuthorization] = useState<AuthorizationState>(EMPTY_AUTHORIZATION)
  const [seleccion, setSeleccion] = useState(leerSeleccionPersistida)

  const sessionRef = useRef<Session | null>(null)
  const authorizationRunRef = useRef(0)
  const sessionUserRef = useRef<string | null | undefined>(undefined)
  const sessionSyncPromiseRef = useRef<Promise<void> | null>(null)

  const clearAuthorization = useCallback(() => {
    authorizationRunRef.current += 1
    setAuthorization({ ...EMPTY_AUTHORIZATION, loading: false })
  }, [])

  const cargarAutorizacionPara = useCallback(async (userId: string): Promise<void> => {
    const runId = ++authorizationRunRef.current
    setAuthorization((prev) => ({ ...prev, loading: true, accesosError: null }))

    const [perfilResult, accesosResult] = await Promise.all([
      supabase
        .from('usuarios')
        .select('id, nombre, rol, sucursal_id, activo')
        .eq('id', userId)
        .single(),
      supabase
        .from('usuario_accesos')
        .select('id, usuario_id, organizacion_id, rol, zona_id, sucursal_id, activo, created_at, updated_at')
        .eq('usuario_id', userId)
        .eq('activo', true)
        .order('created_at', { ascending: true }),
    ])

    if (runId !== authorizationRunRef.current) return

    const perfil = perfilResult.error || !perfilResult.data
      ? null
      : perfilResult.data as UsuarioPerfil

    if (accesosResult.error) {
      if (tablaMultitenantNoDisponible(accesosResult.error)) {
        setAuthorization({
          perfil,
          accesos: [],
          legacyMode: true,
          accesosError: null,
          sucursalesPermitidas: [],
          loading: false,
        })
      } else {
        setAuthorization({
          perfil,
          accesos: [],
          legacyMode: false,
          accesosError: accesosResult.error.message,
          sucursalesPermitidas: [],
          loading: false,
        })
      }
      return
    }

    const accesos = (accesosResult.data ?? []) as UsuarioAcceso[]
    const { data: sucursalesData, error: sucursalesError } = await supabase
      .from('sucursales')
      .select('id, codigo, nombre, zona_id, organizacion_id')
      .eq('activa', true)
      .order('codigo', { ascending: true })

    if (runId !== authorizationRunRef.current) return

    setAuthorization({
      perfil,
      accesos,
      legacyMode: false,
      accesosError: sucursalesError ? `No se pudo resolver el alcance de sucursales: ${sucursalesError.message}` : null,
      sucursalesPermitidas: sucursalesError ? [] : (sucursalesData ?? []) as SucursalPermitida[],
      loading: false,
    })
  }, [])

  const sincronizarSesion = useCallback((nextSession: Session | null): Promise<void> => {
    const nextUserId = nextSession?.user.id ?? null
    sessionRef.current = nextSession
    setSession(nextSession)
    setAuthLoading(false)

    // INITIAL_SESSION/getSession y SIGNED_IN pueden informar la misma cuenta casi
    // simultáneamente. Compartimos la misma carga en vez de abrir consultas duplicadas.
    if (sessionUserRef.current === nextUserId) {
      return sessionSyncPromiseRef.current ?? Promise.resolve()
    }

    sessionUserRef.current = nextUserId
    const promise = nextUserId
      ? cargarAutorizacionPara(nextUserId)
      : Promise.resolve().then(clearAuthorization)

    sessionSyncPromiseRef.current = promise
    void promise.finally(() => {
      if (sessionSyncPromiseRef.current === promise) sessionSyncPromiseRef.current = null
    })
    return promise
  }, [cargarAutorizacionPara, clearAuthorization])

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      void sincronizarSesion(nextSession)
    })

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      return sincronizarSesion(data.session)
    }).catch(() => {
      if (!mounted) return
      sessionRef.current = null
      setSession(null)
      setAuthLoading(false)
      clearAuthorization()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [clearAuthorization, sincronizarSesion])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sincronizarSeleccion = () => setSeleccion(leerSeleccionPersistida())
    window.addEventListener('storage', sincronizarSeleccion)
    window.addEventListener(STORAGE_EVENT, sincronizarSeleccion)
    return () => {
      window.removeEventListener('storage', sincronizarSeleccion)
      window.removeEventListener(STORAGE_EVENT, sincronizarSeleccion)
    }
  }, [])

  const idsPermitidos = useMemo(
    () => new Set(authorization.sucursalesPermitidas.map((s) => s.id)),
    [authorization.sucursalesPermitidas],
  )

  const sucursalPropiaId = useMemo(() => {
    const acceso = authorization.accesos.find((a) =>
      a.activo &&
      a.rol === 'gerente_sucursal' &&
      Boolean(a.sucursal_id) &&
      idsPermitidos.has(a.sucursal_id as string),
    )
    return acceso?.sucursal_id ?? ''
  }, [authorization.accesos, idsPermitidos])

  useEffect(() => {
    if (authLoading || authorization.loading || authorization.legacyMode || !seleccion) return
    if (!idsPermitidos.has(seleccion)) {
      localStorage.removeItem(STORAGE_KEY)
      setSeleccion('')
      window.dispatchEvent(new Event(STORAGE_EVENT))
    }
  }, [authLoading, authorization.legacyMode, authorization.loading, idsPermitidos, seleccion])

  const { sucursalId, requiereSeleccionSucursal } = useMemo(() => {
    if (authLoading || authorization.loading || !session) {
      return { sucursalId: '', requiereSeleccionSucursal: false }
    }

    if (authorization.legacyMode) {
      return {
        sucursalId: authorization.perfil?.sucursal_id ?? SUCURSAL_LEGACY,
        requiereSeleccionSucursal: false,
      }
    }

    if (seleccion && idsPermitidos.has(seleccion)) {
      return { sucursalId: seleccion, requiereSeleccionSucursal: false }
    }

    if (sucursalPropiaId) {
      return { sucursalId: sucursalPropiaId, requiereSeleccionSucursal: false }
    }

    if (authorization.perfil?.sucursal_id && idsPermitidos.has(authorization.perfil.sucursal_id)) {
      return { sucursalId: authorization.perfil.sucursal_id, requiereSeleccionSucursal: false }
    }

    if (authorization.sucursalesPermitidas.length === 1) {
      return { sucursalId: authorization.sucursalesPermitidas[0].id, requiereSeleccionSucursal: false }
    }

    return {
      sucursalId: '',
      requiereSeleccionSucursal: authorization.sucursalesPermitidas.length > 1,
    }
  }, [
    authLoading,
    authorization.legacyMode,
    authorization.loading,
    authorization.perfil?.sucursal_id,
    authorization.sucursalesPermitidas,
    idsPermitidos,
    seleccion,
    session,
    sucursalPropiaId,
  ])

  const seleccionarSucursal = useCallback((id: string) => {
    if (!idsPermitidos.has(id)) return
    localStorage.setItem(STORAGE_KEY, id)
    setSeleccion(id)
    window.dispatchEvent(new Event(STORAGE_EVENT))
  }, [idsPermitidos])

  const refreshAuthorization = useCallback(async (): Promise<void> => {
    let userId = sessionRef.current?.user.id ?? null
    if (!userId) {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        clearAuthorization()
        return
      }
      userId = data.user.id
    }
    await cargarAutorizacionPara(userId)
  }, [cargarAutorizacionPara, clearAuthorization])

  const signIn = useCallback(async (email: string, password: string): Promise<AuthError | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error
    await sincronizarSesion(data.session)
    return null
  }, [sincronizarSesion])

  const signOut = useCallback(async (): Promise<void> => {
    localStorage.removeItem(STORAGE_KEY)
    setSeleccion('')
    const { error } = await supabase.auth.signOut()
    if (error) console.error('[NovenAccessProvider] No se pudo cerrar la sesión:', error.message)
    await sincronizarSesion(null)
  }, [sincronizarSesion])

  const value = useMemo<NovenAccessContextValue>(() => ({
    user: session?.user ?? null,
    session,
    authLoading,
    ...authorization,
    sucursalId,
    requiereSeleccionSucursal,
    signIn,
    signOut,
    refreshAuthorization,
    seleccionarSucursal,
  }), [
    authLoading,
    authorization,
    refreshAuthorization,
    requiereSeleccionSucursal,
    seleccionarSucursal,
    session,
    signIn,
    signOut,
    sucursalId,
  ])

  return <NovenAccessContext.Provider value={value}>{children}</NovenAccessContext.Provider>
}

export function useNovenAccessContext(): NovenAccessContextValue {
  const value = useContext(NovenAccessContext)
  if (!value) throw new Error('useNovenAccessContext debe usarse dentro de NovenAccessProvider')
  return value
}
