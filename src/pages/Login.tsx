import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

function getErrorMessage(error: string): string {
  if (error.toLowerCase().includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos. Revisá tus datos.'
  }
  if (error.toLowerCase().includes('email not confirmed')) {
    return 'Confirmá tu email antes de ingresar.'
  }
  if (error.toLowerCase().includes('too many requests')) {
    return 'Demasiados intentos. Esperá unos minutos y volvé a intentar.'
  }
  return 'No pudimos iniciar sesión. Intentá de nuevo.'
}

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    if (!email.trim()) { setErrorMessage('Ingresá tu email.'); return }
    if (!password) { setErrorMessage('Ingresá tu contraseña.'); return }
    setIsLoading(true)
    try {
      const error = await signIn(email.trim(), password)
      if (error) {
        setErrorMessage(getErrorMessage(error.message))
      } else {
        navigate('/dashboard', { replace: true })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center px-4 py-12">

      {/* Brand mark */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-[20px] bg-brand shadow-brand mb-5">
          <ScanLineIcon />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          NoVen <span className="text-brand">IA</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Control predictivo de vencimientos</p>
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm bg-white rounded-card shadow-elevated p-8">
        <h2 className="text-lg font-semibold text-foreground mb-1">Ingresá a tu cuenta</h2>
        <p className="text-sm text-muted-foreground mb-6">Completá tus datos para continuar</p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-12 px-4 w-full bg-surface-base border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-150 text-sm disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="h-12 px-4 w-full bg-surface-base border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-150 text-sm disabled:opacity-50"
            />
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 animate-fade-in"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 w-full h-12 bg-brand hover:bg-brand-hover text-white font-semibold rounded-lg shadow-brand hover:shadow-brand-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Ingresando...
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Si no tenés cuenta, contactá al administrador del sistema.
      </p>
    </div>
  )
}

function ScanLineIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
      aria-hidden="true"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  )
}
