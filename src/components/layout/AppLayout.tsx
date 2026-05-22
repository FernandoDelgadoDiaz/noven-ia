import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, ScanLine, Calendar, Package, FileUp } from 'lucide-react'

interface NavItem {
  to: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  soloDesktop?: boolean
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Inicio', Icon: LayoutDashboard },
  { to: '/scanner', label: 'Scanner', Icon: ScanLine },
  { to: '/vencimientos', label: 'Vencimientos', Icon: Calendar },
  { to: '/maestro', label: 'Maestro', Icon: Package },
  { to: '/importar', label: 'Importar', Icon: FileUp, soloDesktop: true },
]

export default function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <main className="flex-1 pb-16">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-900 border-t border-zinc-800 flex items-center justify-around z-20"
        aria-label="Navegacion principal"
      >
        {navItems.map(({ to, label, Icon, soloDesktop }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors min-w-[56px]',
                soloDesktop ? 'hidden md:flex' : '',
                isActive
                  ? 'text-[#22c55e]'
                  : 'text-zinc-500 hover:text-zinc-300',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`h-5 w-5 transition-colors ${isActive ? 'text-[#22c55e]' : 'text-zinc-500'}`}
                />
                <span
                  className={`text-[10px] font-medium leading-none ${isActive ? 'text-[#22c55e]' : 'text-zinc-500'}`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
