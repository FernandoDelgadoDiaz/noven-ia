import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'

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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-[#22c55e]" />
          <p className="text-sm text-muted-foreground">Verificando sesión y permisos...</p>
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
