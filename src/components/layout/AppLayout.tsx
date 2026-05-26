import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ScanLine, Calendar, Package, FileUp, Users, LogOut } from 'lucide-react'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
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
  { to: '/maestro', label: 'Maestro', Icon: Package },
  { to: '/importar', label: 'Importar', Icon: FileUp },
]

const ADMIN_NAV_ITEM: NavItem = { to: '/admin', label: 'Admin', Icon: Users }

const BASE_MOBILE_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/vencimientos', label: 'Vencimientos', Icon: Calendar },
  { to: '/maestro', label: 'Maestro', Icon: Package },
  { to: '/importar', label: 'Importar', Icon: FileUp },
]

export default function AppLayout() {
  const { isAdmin } = useUsuarioRol()
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = isAdmin ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM] : BASE_NAV_ITEMS
  const mobileNavItems = isAdmin
    ? [...BASE_MOBILE_NAV_ITEMS, ADMIN_NAV_ITEM]
    : BASE_MOBILE_NAV_ITEMS
  return (
    <div className="flex min-h-screen bg-surface-base">

      {/* ── Sidebar — desktop only ──────────────────────────────────── */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-[230px] bg-white border-r border-border/50 z-30">

        {/* Logo */}
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

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Menú principal">
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

        {/* Bottom: cerrar sesión + status */}
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

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className="flex-1 md:ml-[230px] flex flex-col min-h-screen">
        <main className="flex-1 pb-nav md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── Scanner flotante — mobile only ──────────────────────────── */}
      <div className="md:hidden fixed bottom-[calc(32px+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-30">
        <NavLink to="/scanner">
          {({ isActive }) => (
            <div
              className={[
                'h-16 w-16 rounded-full flex items-center justify-center active:scale-[0.95] transition-transform duration-150',
                isActive
                  ? 'bg-brand-hover shadow-brand-lg'
                  : 'bg-brand shadow-brand-lg',
              ].join(' ')}
            >
              <ScanLine className="h-7 w-7 text-white" aria-hidden="true" />
            </div>
          )}
        </NavLink>
      </div>

      {/* ── Mobile bottom nav — hidden on desktop ───────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-border/40 shadow-nav"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        }}
        aria-label="Navegación principal"
      >
        <div className="h-full flex items-center">
          <div className={`flex-1 h-full grid items-center px-2 ${mobileNavItems.length >= 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
            {mobileNavItems.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-150 select-none active:scale-[0.94]',
                    isActive
                      ? 'text-brand bg-brand-light'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-5 w-5 transition-colors ${
                        isActive ? 'text-brand' : 'text-muted-foreground'
                      }`}
                    />
                    <span
                      className={`text-[10px] leading-none transition-colors ${
                        isActive ? 'text-brand font-semibold' : 'text-muted-foreground font-medium'
                      }`}
                    >
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Cerrar sesión — mobile */}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-14 shrink-0 h-full flex flex-col items-center justify-center gap-1 border-l border-border/40 text-muted-foreground hover:text-red-500 hover:bg-red-50/60 transition-colors active:scale-[0.94]"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">Salir</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
