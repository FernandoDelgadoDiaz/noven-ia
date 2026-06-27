import { BrainCircuit, Sparkles, RefreshCw, AlertCircle } from 'lucide-react'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
import { useAnalisis } from '@/hooks/useAnalisis'

function formatFechaHora(iso: string): string {
  const d = new Date(iso)
  const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
  const hora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${fecha} · ${hora}`
}

export default function Analisis() {
  const { isAdmin } = useUsuarioRol()
  const { loading, resultado, error, ultimaActualizacion, generarAnalisis } = useAnalisis()

  const subtitulo = isAdmin ? 'Análisis completo de la sucursal' : 'Análisis de tus familias asignadas'

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
            <BrainCircuit className="h-5 w-5 text-brand" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none">
              Análisis inteligente
            </h1>
            <p className="text-sm text-muted-foreground mt-1 leading-none">{subtitulo}</p>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-5 md:py-6 space-y-4 pb-28 md:pb-10">
        {/* Botón generar / regenerar */}
        {!resultado && !loading && (
          <button
            type="button"
            onClick={() => void generarAnalisis()}
            className="w-full min-h-[64px] flex items-center justify-center gap-3 bg-brand hover:bg-brand-hover text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98]"
          >
            <Sparkles className="h-5 w-5" />
            Generar análisis
          </button>
        )}

        {/* Loading */}
        {loading && (
          <div className="rounded-card bg-white shadow-card px-6 py-12 flex flex-col items-center text-center gap-4">
            <span className="h-10 w-10 border-[3px] border-brand/30 border-t-brand rounded-full animate-spin" />
            <div>
              <p className="text-foreground font-semibold text-base">Analizando tus datos…</p>
              <p className="text-muted-foreground text-sm mt-1">Esto puede tardar unos segundos.</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div role="alert" className="rounded-card bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2 animate-fade-in">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => void generarAnalisis()}
                className="mt-2 text-xs font-semibold text-red-600 hover:text-red-800 border border-red-300 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Resultado */}
        {resultado && !loading && (
          <>
            <div className="bg-white rounded-card shadow-card p-5 md:p-6 animate-fade-in">
              <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">{resultado}</p>
            </div>

            <div className="flex items-center justify-between gap-3">
              {ultimaActualizacion && (
                <p className="text-xs text-muted-foreground">
                  Último análisis: {formatFechaHora(ultimaActualizacion)}
                </p>
              )}
              <button
                type="button"
                onClick={() => void generarAnalisis()}
                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/70 text-foreground text-sm font-semibold transition-all active:scale-[0.97]"
              >
                <RefreshCw className="h-4 w-4" />
                Actualizar análisis
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
