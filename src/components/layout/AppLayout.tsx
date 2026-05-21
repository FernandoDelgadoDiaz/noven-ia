import { Outlet, NavLink } from 'react-router-dom'

export default function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around">
        <NavLink to="/" end className="flex flex-col items-center text-xs gap-1 px-4">
          Dashboard
        </NavLink>
        <NavLink to="/scanner" className="flex flex-col items-center text-xs gap-1 px-4">
          Scanner
        </NavLink>
        <NavLink to="/vencimientos" className="flex flex-col items-center text-xs gap-1 px-4">
          Vencimientos
        </NavLink>
        <NavLink to="/maestro" className="flex flex-col items-center text-xs gap-1 px-4">
          Maestro
        </NavLink>
      </nav>
    </div>
  )
}
