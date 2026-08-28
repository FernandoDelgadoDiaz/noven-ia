import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'
import { supabase } from '@/lib/supabase'

// UUID de la sucursal legacy para mantener compatibilidad con producción actual
const SUCURSAL_LEGACY = '00000000-0000-0000-0000-000000000001'
const STORAGE_KEY = 'noven_sucursal_actual'

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
 */
export function useSucursalActual(): UseSucursalActualReturn {
  const { perfil, loading: rolLoading } = useUsuarioRol()
  const { loading: accesosLoading, legacyMode } = useAccesosMultitenant()
  const [sucursalesPermitidas, setSucursalesPermitidas] = useState<SucursalPermitida[]>([])
  const [scopeLoading, setScopeLoading] = useState(true)
  const [seleccion, setSeleccion] = useState(() =>
    typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) ?? '') : '',
  )

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

  useEffect(() => {
    if (scopeLoading || legacyMode || !seleccion) return
    if (!idsPermitidos.has(seleccion)) {
      localStorage.removeItem(STORAGE_KEY)
      setSeleccion('')
    }
  }, [idsPermitidos, legacyMode, scopeLoading, seleccion])

  const seleccionarSucursal = useCallback((id: string) => {
    if (!idsPermitidos.has(id)) return
    localStorage.setItem(STORAGE_KEY, id)
    setSeleccion(id)
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

  // Una elección explícita siempre prevalece sobre el contexto propio del perfil.
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

  // Mantiene el local habitual de un gerente que además tenga alcance superior.
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
