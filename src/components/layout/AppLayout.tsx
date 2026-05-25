import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, ScanLine, Calendar, Package, FileUp } from 'lucide-react'

interface NavItem {
  to: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  isMain?: boolean
  soloDesktop?: boolean
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/scanner', label: 'Scanner', Icon: ScanLine, isMain: true },
  { to: '/vencimientos', label: 'Vencimientos', Icon: Calendar },
  { to: '/maestro', label: 'Maestro', Icon: Package },
  { to: '/importar', label: 'Importar', Icon: FileUp, soloDesktop: true },
]

export default function AppLayout() {
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

        {/* Bottom status */}
        <div className="px-5 py-4 border-t border-border/40">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 animate-pulse-slow" />
            <span className="text-xs text-muted-foreground">Sincronizado</span>
          </div>
          <p className="text-[10px] text-muted-foreground/50">NoVen IA · v2.0</p>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className="flex-1 md:ml-[230px] flex flex-col min-h-screen">
        <main className="flex-1 pb-nav md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav — hidden on desktop ───────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-t border-border/40 shadow-nav"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          minHeight: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        }}
        aria-label="Navegación principal"
      >
        <div className="h-full flex items-end justify-around px-2">
          {navItems
            .filter(({ soloDesktop }) => !soloDesktop)
            .map(({ to, label, Icon, isMain }) => {
              if (isMain) {
                return (
                  <NavLink key={to} to={to} className="flex items-end justify-center pb-2">
                    {({ isActive }) => (
                      <div
                        className={[
                          'relative flex flex-col items-center gap-1 px-5 py-2.5 rounded-[18px]',
                          '-translate-y-3 transition-all duration-200 select-none',
                          isActive
                            ? 'bg-brand shadow-brand-lg scale-105'
                            : 'bg-brand shadow-brand active:scale-[0.96]',
                        ].join(' ')}
                      >
                        <Icon className="h-5 w-5 text-white" />
                        <span className="text-[10px] font-bold text-white leading-none tracking-wide">
                          {label}
                        </span>
                      </div>
                    )}
                  </NavLink>
                )
              }
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    [
                      'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-150 min-w-[48px] mb-1 select-none active:scale-[0.94]',
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
              )
            })}
        </div>
      </nav>
    </div>
  )
}
