import { type FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function ActivarCuenta() {
  const navigate = useNavigate()
  const [validando, setValidando] = useState(true)
  const [sesionLista, setSesionLista] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completado, setCompletado] = useState(false)

  useEffect(() => {
    let mounted = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSesionLista(Boolean(data.session))
      setValidando(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session) {
        setSesionLista(true)
        setValidando(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function activar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setGuardando(true)
    const { error: passwordError } = await supabase.auth.updateUser({ password })
    if (passwordError) {
      setError(passwordError.message)
      setGuardando(false)
      return
    }

    // Es sólo trazabilidad de la invitación. El permiso real ya vive en
    // usuario_accesos y nunca depende de metadata del navegador.
    await supabase.rpc('aceptar_invitacion_acceso_v1')

    setCompletado(true)
    setGuardando(false)
    window.setTimeout(() => navigate('/dashboard', { replace: true }), 900)
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-brand flex items-center justify-center shadow-brand">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">Activá tu acceso a Noven IA</h1>
          <p className="mt-1 text-sm text-muted-foreground">Definí tu contraseña personal para ingresar.</p>
        </div>

        <div className="bg-white rounded-card shadow-elevated p-6">
          {validando ? (
            <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-brand" />
              <p className="text-sm">Validando invitación...</p>
            </div>
          ) : !sesionLista ? (
            <div className="py-6 text-center">
              <KeyRound className="h-9 w-9 mx-auto text-muted-foreground/50" />
              <p className="mt-4 font-semibold text-foreground">La invitación no es válida o venció</p>
              <p className="mt-2 text-sm text-muted-foreground">Pedí a quien te invitó que genere un nuevo acceso.</p>
            </div>
          ) : completado ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-11 w-11 mx-auto text-emerald-600" />
              <p className="mt-4 font-bold text-foreground">Cuenta activada</p>
              <p className="mt-1 text-sm text-muted-foreground">Ingresando a Noven IA...</p>
            </div>
          ) : (
            <form onSubmit={activar} className="space-y-4">
              <div>
                <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide text-foreground">Nueva contraseña</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 h-12 px-4 w-full bg-surface-base border border-border rounded-xl focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div>
                <label htmlFor="confirmacion" className="text-xs font-bold uppercase tracking-wide text-foreground">Repetir contraseña</label>
                <input
                  id="confirmacion"
                  type="password"
                  autoComplete="new-password"
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  className="mt-1.5 h-12 px-4 w-full bg-surface-base border border-border rounded-xl focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="Repetí la contraseña"
                />
              </div>

              {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

              <button
                type="submit"
                disabled={guardando}
                className="w-full h-12 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Crear contraseña y entrar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
