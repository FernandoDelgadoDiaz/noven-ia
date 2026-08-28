import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'
import { supabase } from '@/lib/supabase'

// UUID de la sucursal legacy para mantener compatibilidad con producción actual
const SUCURSAL_LEGACY = '00000000-0000-0000-0000-000000000001'
const STORAGE_KEY = 'noven_sucursal_actual'
const STORAGE_EVENT = 'noven:sucursal-cambio'

export interface SucursalPermitida {
  id: string
  codigo: string
  nombre: string
  zona_id: string
}

interface UseSucursalActualReturn {
  /** Cadena vacía cuando el scope requiere que el usuario elija una sucursal. */
  sucursalId: string
  loading: boolean
  legacyMode: boolean
  requiereSeleccionSucursal: boolean
  sucursalesPermitidas: SucursalPermitida[]
  seleccionarSucursal: (id: string) => void
}

function leerSeleccionPersistida(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

/**
 * Resuelve la sucursal operativa sin otorgar permisos desde el frontend.
 * La lista de sucursales se consulta contra `sucursales` y queda filtrada por RLS:
 * - gerente_sucursal/supervisor/operador: su sucursal;
 * - gerente_zonal: todas las sucursales de su zona;
 * - admin_organizacion: todas las sucursales de su organización.
 *
 * Si una cuenta tiene a la vez alcance superior y una sucursal propia (por ejemplo,
 * gerente 091 + admin de organización), conserva su sucursal propia como contexto
 * inicial. Una selección manual posterior siempre tiene prioridad.
 *
 * Todas las instancias del hook se sincronizan mediante un evento interno. Esto es
 * necesario porque AppLayout, Dashboard, Vencimientos y otros módulos montan el hook
 * por separado: cambiar el selector debe actualizar a todos en el mismo instante.
 */
export function useSucursalActual(): UseSucursalActualReturn {
  const { perfil, loading: rolLoading } = useUsuarioRol()
  const { accesos, loading: accesosLoading, legacyMode } = useAccesosMultitenant()
  const [sucursalesPermitidas, setSucursalesPermitidas] = useState<SucursalPermitida[]>([])
  const [scopeLoading, setScopeLoading] = useState(true)
  const [seleccion, setSeleccion] = useState(leerSeleccionPersistida)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const sincronizar = () => setSeleccion(leerSeleccionPersistida())
    window.addEventListener('storage', sincronizar)
    window.addEventListener(STORAGE_EVENT, sincronizar)
    return () => {
      window.removeEventListener('storage', sincronizar)
      window.removeEventListener(STORAGE_EVENT, sincronizar)
    }
  }, [])

  useEffect(() => {
    if (rolLoading || accesosLoading) return

    if (legacyMode) {
      setSucursalesPermitidas([])
      setScopeLoading(false)
      return
    }

    let cancelled = false
    setScopeLoading(true)
    supabase
      .from('sucursales')
      .select('id, codigo, nombre, zona_id')
      .eq('activa', true)
      .order('codigo', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[useSucursalActual] No se pudo resolver el scope de sucursales:', error.message)
          setSucursalesPermitidas([])
        } else {
          setSucursalesPermitidas((data ?? []) as SucursalPermitida[])
        }
        setScopeLoading(false)
      })

    return () => { cancelled = true }
  }, [rolLoading, accesosLoading, legacyMode])

  const idsPermitidos = useMemo(
    () => new Set(sucursalesPermitidas.map((s) => s.id)),
    [sucursalesPermitidas],
  )

  // En multitenant la fuente real es usuario_accesos, no usuarios.sucursal_id.
  // Así un admin de organización que además es gerente de una sucursal conserva
  // esa sucursal como contexto habitual aunque el perfil legacy tenga sucursal null.
  const sucursalPropiaId = useMemo(() => {
    const acceso = accesos.find((a) =>
      a.activo &&
      a.rol === 'gerente_sucursal' &&
      Boolean(a.sucursal_id) &&
      idsPermitidos.has(a.sucursal_id as string),
    )
    return acceso?.sucursal_id ?? ''
  }, [accesos, idsPermitidos])

  useEffect(() => {
    if (scopeLoading || legacyMode || !seleccion) return
    if (!idsPermitidos.has(seleccion)) {
      localStorage.removeItem(STORAGE_KEY)
      setSeleccion('')
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(STORAGE_EVENT))
    }
  }, [idsPermitidos, legacyMode, scopeLoading, seleccion])

  const seleccionarSucursal = useCallback((id: string) => {
    if (!idsPermitidos.has(id)) return
    localStorage.setItem(STORAGE_KEY, id)
    setSeleccion(id)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(STORAGE_EVENT))
  }, [idsPermitidos])

  const loading = rolLoading || accesosLoading || (!legacyMode && scopeLoading)

  if (loading) {
    return {
      sucursalId: '',
      loading: true,
      legacyMode,
      requiereSeleccionSucursal: false,
      sucursalesPermitidas,
      seleccionarSucursal,
    }
  }

  if (legacyMode) {
    return {
      sucursalId: perfil?.sucursal_id ?? SUCURSAL_LEGACY,
      loading: false,
      legacyMode: true,
      requiereSeleccionSucursal: false,
      sucursalesPermitidas,
      seleccionarSucursal,
    }
  }

  // Una elección explícita siempre prevalece sobre el contexto propio.
  if (seleccion && idsPermitidos.has(seleccion)) {
    return {
      sucursalId: seleccion,
      loading: false,
      legacyMode: false,
      requiereSeleccionSucursal: false,
      sucursalesPermitidas,
      seleccionarSucursal,
    }
  }

  // Fuente principal multitenant: acceso gerente_sucursal activo.
  if (sucursalPropiaId) {
    return {
      sucursalId: sucursalPropiaId,
      loading: false,
      legacyMode: false,
      requiereSeleccionSucursal: false,
      sucursalesPermitidas,
      seleccionarSucursal,
    }
  }

  // Fallback de transición mientras sigan coexistiendo perfil legacy y scopes.
  if (perfil?.sucursal_id && idsPermitidos.has(perfil.sucursal_id)) {
    return {
      sucursalId: perfil.sucursal_id,
      loading: false,
      legacyMode: false,
      requiereSeleccionSucursal: false,
      sucursalesPermitidas,
      seleccionarSucursal,
    }
  }

  if (sucursalesPermitidas.length === 1) {
    return {
      sucursalId: sucursalesPermitidas[0].id,
      loading: false,
      legacyMode: false,
      requiereSeleccionSucursal: false,
      sucursalesPermitidas,
      seleccionarSucursal,
    }
  }

  return {
    sucursalId: '',
    loading: false,
    legacyMode: false,
    requiereSeleccionSucursal: sucursalesPermitidas.length > 1,
    sucursalesPermitidas,
    seleccionarSucursal,
  }
}
