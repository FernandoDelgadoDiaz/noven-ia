import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'


function NovenBrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M13 25h7l4 21h24l6-16H23" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="29" cy="52" r="3" fill="currentColor" />
      <circle cx="47" cy="52" r="3" fill="currentColor" />
      <path d="M34 18c5-5 13-5 18 0" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M38 22c3-3 7-3 10 0" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
      <circle cx="43" cy="27" r="3" fill="#F59E0B" />
    </svg>
  )
}

function PantallaAcceso({ titulo, detalle, onSalir }: { titulo: string; detalle: string; onSalir: () => void }) {
  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center px-5">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-card border border-border/60 p-6 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-700 font-bold">!</div>
        <h1 className="mt-4 text-lg font-bold text-foreground">{titulo}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{detalle}</p>
        <button
          type="button"
          onClick={onSalir}
          className="mt-5 w-full h-11 rounded-xl border border-border font-semibold text-sm text-foreground hover:bg-muted"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default function PrivateRoute() {
  const { session, loading: authLoading, signOut } = useAuth()
  const { perfil, loading: perfilLoading } = useUsuarioRol()
  const { accesos, loading: accesosLoading, legacyMode, error: accesosError } = useAccesosMultitenant()

  const loading = authLoading || (Boolean(session) && (perfilLoading || accesosLoading))

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex w-full max-w-sm flex-col items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-brand text-white shadow-brand-lg">
            <NovenBrandMark className="h-16 w-16" />
          </div>

          <div className="mt-6 text-center">
            <p className="text-2xl font-black tracking-tight text-foreground">NoVen IA</p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Inteligencia operacional para supermercados
            </p>
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-full bg-white/70 px-4 py-2.5 shadow-card">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
            <p className="text-sm font-medium text-muted-foreground">Verificando sesión y permisos...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (accesosError) {
    return (
      <PantallaAcceso
        titulo="No se pudieron verificar tus permisos"
        detalle="Noven no pudo validar el alcance de esta cuenta. Cerrá sesión y volvé a ingresar. Si continúa, contactá al administrador."
        onSalir={() => void signOut()}
      />
    )
  }

  if (!perfil) {
    return (
      <PantallaAcceso
        titulo="Cuenta sin perfil operativo"
        detalle="La sesión existe, pero esta cuenta no tiene un perfil operativo válido en Noven."
        onSalir={() => void signOut()}
      />
    )
  }

  if (!perfil.activo) {
    return (
      <PantallaAcceso
        titulo="Cuenta pendiente o desactivada"
        detalle="Tu cuenta todavía no está habilitada para operar en Noven, o fue desactivada por un administrador."
        onSalir={() => void signOut()}
      />
    )
  }

  if (!legacyMode && accesos.length === 0) {
    return (
      <PantallaAcceso
        titulo="Sin acceso activo"
        detalle="Tu cuenta está activa, pero no tiene ninguna organización, zona o sucursal habilitada."
        onSalir={() => void signOut()}
      />
    )
  }

  return <Outlet />
}
