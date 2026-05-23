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
        className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md shadow-nav z-20 flex items-end justify-around px-2"
        style={{
          height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        aria-label="Navegación principal"
      >
        {navItems.map(({ to, label, Icon, isMain, soloDesktop }) => {
          if (isMain) {
            return (
              <NavLink key={to} to={to} className="flex items-end justify-center pb-2">
                {({ isActive }) => (
                  <div
                    className={[
                      'relative -translate-y-3 flex flex-col items-center gap-1 px-5 py-2.5 rounded-[18px]',
                      'transition-all duration-200',
                      isActive
                        ? 'bg-brand shadow-brand-lg scale-105'
                        : 'bg-brand shadow-brand',
                    ].join(' ')}
                  >
                    <Icon className="h-5 w-5 text-white" />
                    <span className="text-[10px] font-bold text-white leading-none">
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
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-150 min-w-[52px] mb-1',
                  soloDesktop ? 'hidden md:flex' : '',
                  isActive
                    ? 'text-brand bg-brand-light'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-brand' : 'text-muted-foreground'}`} />
                  <span className={`text-[10px] font-medium leading-none ${isActive ? 'text-brand' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
