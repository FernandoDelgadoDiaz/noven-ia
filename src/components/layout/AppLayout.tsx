import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ScanLine, Calendar, BrainCircuit, FileUp, Users, LogOut, Bell, X, Network } from 'lucide-react'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'
import { useNovenAccessContext } from '@/hooks/useNovenAccessContext'
import { usePuedeOperarSucursal } from '@/hooks/usePuedeOperarSucursal'
import { usePuedeGestionarCatalogo } from '@/hooks/usePuedeGestionarCatalogo'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import SucursalContextSelector from './SucursalContextSelector'
import InvitationManagementDock from '@/components/admin/InvitationManagementDock'
import { supabase } from '@/lib/supabase'

interface NavItem {
  to: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  isMain?: boolean
}

const BASE_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/scanner', label: 'Scanner', Icon: ScanLine, isMain: true },
  { to: '/vencimientos', label: 'Vencimientos', Icon: Calendar },
  { to: '/analisis', label: 'Análisis', Icon: BrainCircuit },
]

const IMPORT_NAV_ITEM: NavItem = { to: '/importar', label: 'Importar', Icon: FileUp }
const ADMIN_NAV_ITEM: NavItem = { to: '/admin', label: 'Admin', Icon: Users }

const ACCESS_ADMIN_NAV_ITEM: NavItem = {
  to: '/admin/accesos',
  label: 'Accesos',
  Icon: Network,
}

const MOBILE_NAV_LEFT: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/vencimientos', label: 'Vencimientos', Icon: Calendar },
]

const MOBILE_NAV_RIGHT_BASE: NavItem[] = [
  { to: '/analisis', label: 'Análisis', Icon: BrainCircuit },
]

export default function AppLayout() {
  const { isAdmin } = useUsuarioRol()
  const { accesos, legacyMode } = useAccesosMultitenant()
  const { sucursalId, sucursalesPermitidas } = useNovenAccessContext()
  const { puedeOperar } = usePuedeOperarSucursal()
  const { puedeGestionar: gestionaCatalogo } = usePuedeGestionarCatalogo()
  const navigate = useNavigate()

  // Las capacidades multirrol se acumulan, pero cada una conserva SU alcance.
  // Un rol jerárquico no convierte a la cuenta en gerente operativo de otras sucursales.
  const administraSucursal = legacyMode
    ? isAdmin
    : Boolean(sucursalId) && accesos.some((a) =>
      a.activo && a.rol === 'gerente_sucursal' && a.sucursal_id === sucursalId,
    )

  const administraJerarquia = !legacyMode
    && accesos.some((a) => a.activo && a.rol === 'admin_organizacion')
    && accesos.some((a) =>
      a.activo
      && a.rol === 'gerente_sucursal'
      && Boolean(a.sucursal_id)
      && sucursalesPermitidas.some((s) => s.id === a.sucursal_id && s.codigo === '091'),
    )

  const { soportado, permiso, activar } = usePushNotifications()
  const [pushDismissed, setPushDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('push_dismissed') === 'true',
  )
  const mostrarBannerPush = soportado && permiso === 'default' && !pushDismissed

  function descartarBannerPush() {
    localStorage.setItem('push_dismissed', 'true')
    setPushDismissed(true)
  }

  async function handleSignOut() {
    localStorage.removeItem('noven_sucursal_actual')
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems: NavItem[] = [
    ...BASE_NAV_ITEMS.filter((item) => item.to !== '/scanner' || puedeOperar),
    ...(gestionaCatalogo ? [IMPORT_NAV_ITEM] : []),
    ...(administraSucursal ? [ADMIN_NAV_ITEM] : []),
    ...(administraJerarquia ? [ACCESS_ADMIN_NAV_ITEM] : []),
  ]

  // Si la cuenta gerente 091 tiene además la capacidad jerárquica, Accesos se
  // mantiene disponible sin alterar el alcance operativo local de la 091.
  const mobileNavRight: NavItem[] = [
    ...MOBILE_NAV_RIGHT_BASE,
    ...(gestionaCatalogo ? [IMPORT_NAV_ITEM] : []),
    ...(administraSucursal ? [ADMIN_NAV_ITEM] : []),
    ...(administraJerarquia && !administraSucursal ? [ACCESS_ADMIN_NAV_ITEM] : []),
  ]

  return (
    <div className="flex min-h-screen bg-surface-base">
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-[230px] bg-white border-r border-border/50 z-30">
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-brand flex items-center justify-center shadow-brand shrink-0">
              <ScanLine className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground tracking-tight leading-none">
                NoVen <span className="text-brand">IA</span>
              </p>
              <p className="text-[10px] text-muted-foreground leading-none mt-1">Control inteligente</p>
            </div>
          </div>
        </div>

        <div className="mx-5 h-px bg-border/60" />
        <SucursalContextSelector />

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Menú principal">
          {navItems.map(({ to, label, Icon, isMain }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-150 select-none',
                  isMain
                    ? isActive
                      ? 'bg-brand text-white shadow-brand font-semibold'
                      : 'text-brand hover:bg-brand/10 font-medium'
                    : isActive
                      ? 'bg-brand-light text-brand font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted font-medium',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-4 w-4 shrink-0 ${isMain && !isActive ? 'text-brand' : ''}`} />
                  <span className="text-sm">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-border/40 space-y-3">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all duration-150 font-medium"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="text-sm">Cerrar sesión</span>
          </button>
          <div className="px-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 animate-pulse-slow" />
              <span className="text-xs text-muted-foreground">Sincronizado</span>
            </div>
            <p className="text-[10px] text-muted-foreground/50">NoVen IA · v2.0</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 md:ml-[230px] flex flex-col min-h-screen">
        <div className="md:hidden bg-white border-b border-border/50">
          <SucursalContextSelector mobile />
          {administraJerarquia && administraSucursal && (
            <div className="px-3 pb-2">
              <NavLink
                to="/admin/accesos"
                className="h-10 w-full rounded-xl bg-brand-light text-brand border border-brand/15 font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Network className="h-4 w-4" />
                Accesos y jerarquía
              </NavLink>
            </div>
          )}
        </div>

        <main className="flex-1 pb-nav md:pb-0">
          <Outlet />
        </main>
      </div>

      <InvitationManagementDock />

      {mostrarBannerPush && (
        <div
          className="fixed left-3 right-3 z-30 md:left-auto md:right-6 md:max-w-sm bg-white border border-border shadow-elevated rounded-2xl p-3.5 flex items-center gap-3 animate-fade-in"
          style={{ bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}
          role="region"
          aria-label="Activar notificaciones"
        >
          <div className="h-9 w-9 rounded-full bg-brand-light flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-brand" aria-hidden="true" />
          </div>
          <p className="flex-1 text-xs text-foreground leading-snug">
            🔔 Activá las notificaciones para recibir alertas urgentes y de Radar Zonal
          </p>
          <button
            type="button"
            onClick={() => void activar()}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition-colors active:scale-[0.97]"
          >
            Activar
          </button>
          <button
            type="button"
            onClick={descartarBannerPush}
            className="shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-border/40 shadow-nav"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        }}
        aria-label="Navegación principal"
      >
        <div className="h-full flex items-center">
          <div className="flex flex-1 items-center justify-around h-full">
            {MOBILE_NAV_LEFT.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-150 select-none active:scale-[0.94]',
                    isActive ? 'text-brand bg-brand-light' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-brand' : 'text-muted-foreground'}`} />
                    <span className={`text-[10px] leading-none transition-colors ${isActive ? 'text-brand font-semibold' : 'text-muted-foreground font-medium'}`}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {puedeOperar && <div className="w-16 shrink-0" aria-hidden="true" />}

          <div className="flex flex-1 items-center justify-around h-full">
            {mobileNavRight.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-150 select-none active:scale-[0.94]',
                    isActive ? 'text-brand bg-brand-light' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-brand' : 'text-muted-foreground'}`} />
                    <span className={`text-[10px] leading-none transition-colors ${isActive ? 'text-brand font-semibold' : 'text-muted-foreground font-medium'}`}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-50/60 transition-colors active:scale-[0.94]"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">Salir</span>
            </button>
          </div>
        </div>
      </nav>

      {puedeOperar && (
        <div className="md:hidden fixed bottom-[calc(36px+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-30">
          <NavLink to="/scanner" aria-label="Ir al Scanner">
            {({ isActive }) => (
              <div
                className={[
                  'h-16 w-16 rounded-full flex items-center justify-center active:scale-[0.95] transition-transform duration-150 shadow-brand-lg ring-4 ring-white',
                  isActive ? 'bg-brand-hover' : 'bg-brand',
                ].join(' ')}
              >
                <ScanLine className="h-7 w-7 text-white" aria-hidden="true" />
              </div>
            )}
          </NavLink>
        </div>
      )}
    </div>
  )
}
