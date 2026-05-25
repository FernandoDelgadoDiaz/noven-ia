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
  { to: '/dashboard', label: 'Inicio', Icon: LayoutDashboard },
  { to: '/vencimientos', label: 'Lista', Icon: Calendar },
  { to: '/scanner', label: 'Scanner', Icon: ScanLine, isMain: true },
  { to: '/maestro', label: 'Maestro', Icon: Package },
  { to: '/importar', label: 'Importar', Icon: FileUp, soloDesktop: true },
]

export default function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-base">
      <main className="flex-1 pb-nav">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-t border-border/40 shadow-nav"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          minHeight: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        }}
        aria-label="Navegación principal"
      >
        {/* Inner: full-width on mobile, centered on desktop */}
        <div className="h-full flex items-end justify-around px-2 md:items-center md:justify-center md:gap-1 md:max-w-sm md:mx-auto">
          {navItems.map(({ to, label, Icon, isMain, soloDesktop }) => {
            if (isMain) {
              return (
                <NavLink
                  key={to}
                  to={to}
                  className="flex items-end justify-center pb-2 md:pb-0 md:items-center"
                >
                  {({ isActive }) => (
                    <div
                      className={[
                        'relative flex flex-col items-center gap-1 px-5 py-2.5 rounded-[18px]',
                        '-translate-y-3 md:translate-y-0',
                        'transition-all duration-200 select-none',
                        isActive
                          ? 'bg-brand shadow-brand-lg scale-105 md:scale-[1.02]'
                          : 'bg-brand shadow-brand hover:shadow-brand-lg active:scale-[0.96]',
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
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-150 min-w-[48px] mb-1 select-none',
                    'active:scale-[0.94]',
                    soloDesktop ? 'hidden md:flex' : '',
                    isActive
                      ? 'text-brand bg-brand-light'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-5 w-5 transition-colors duration-150 ${
                        isActive ? 'text-brand' : 'text-muted-foreground'
                      }`}
                    />
                    <span
                      className={`text-[10px] leading-none transition-colors duration-150 ${
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
