import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

    if (!email.trim()) {
      setErrorMessage('Ingresá tu email.')
      return
    }
    if (!password) {
      setErrorMessage('Ingresá tu contraseña.')
      return
    }

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
    <div className="dark min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] px-4 py-12">
      {/* Logo / marca */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/30 mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7"
            aria-hidden="true"
          >
            <path d="M12 2a10 10 0 1 0 10 10H12V2Z" />
            <path d="M12 2a10 10 0 0 1 10 10" />
            <path d="M12 12 2.1 9.1" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          NoVen <span className="text-[#22c55e]">IA</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">Control predictivo de vencimientos</p>
      </div>

      {/* Card de login */}
      <Card className="w-full max-w-sm bg-zinc-900 border-zinc-800 text-white shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-white">Ingresá a tu cuenta</CardTitle>
          <CardDescription className="text-zinc-400">
            Completá tus datos para continuar
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            {/* Campo email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-zinc-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-[#22c55e] focus-visible:border-[#22c55e]"
              />
            </div>

            {/* Campo contraseña */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-zinc-300">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-[#22c55e] focus-visible:border-[#22c55e]"
              />
            </div>

            {/* Mensaje de error */}
            {errorMessage && (
              <div
                role="alert"
                className="rounded-md bg-red-950/60 border border-red-800/60 px-3 py-2.5 text-sm text-red-400"
              >
                {errorMessage}
              </div>
            )}

            {/* Botón de envío */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Ingresando...
                </span>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-zinc-600">
        Si no tenés cuenta, contactá al administrador del sistema.
      </p>
    </div>
  )
}
