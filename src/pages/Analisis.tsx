import { useState, type ReactNode } from 'react'
import { AlertCircle, BrainCircuit, Check, Copy, RefreshCw, Sparkles } from 'lucide-react'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
import { useAnalisis } from '@/hooks/useAnalisis'

function formatFechaHora(iso: string): string {
  const d = new Date(iso)
  const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
  const hora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${fecha} · ${hora}`
}

function limpiarMarkdown(texto: string): string {
  return texto
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*]+)\*(?=\s|$|[.,;:])/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .trim()
}

function renderInlineMarkdown(texto: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return partes.map((parte, index) => {
    if (parte.startsWith('**') && parte.endsWith('**')) {
      return <strong key={`${index}-${parte}`} className="font-bold text-foreground">{parte.slice(2, -2)}</strong>
    }
    return <span key={`${index}-${parte}`}>{parte.replace(/\*([^*]+)\*/g, '$1')}</span>
  })
}

function InformeRenderizado({ texto }: { texto: string }) {
  const lineas = texto.split('\n')

  return (
    <div className="space-y-3">
      {lineas.map((linea, index) => {
        const limpia = linea.trim()
        if (!limpia) return <div key={`espacio-${index}`} className="h-1" aria-hidden="true" />

        const tituloMarkdown = limpia.match(/^\*\*(\d+\.\s+.+)\*\*$/)
        const tituloPlano = limpia.match(/^(\d+\.\s+.+)$/)
        const titulo = tituloMarkdown?.[1] ?? tituloPlano?.[1]
        if (titulo) {
          return (
            <h2 key={`titulo-${index}`} className="pt-2 text-base md:text-lg font-bold text-foreground tracking-tight">
              {titulo}
            </h2>
          )
        }

        if (/^[-•]\s+/.test(limpia)) {
          const contenido = limpia.replace(/^[-•]\s+/, '')
          return (
            <div key={`item-${index}`} className="flex items-start gap-2.5 pl-1">
              <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-brand shrink-0" aria-hidden="true" />
              <p className="text-[15px] md:text-base leading-7 text-foreground/90">
                {renderInlineMarkdown(contenido)}
              </p>
            </div>
          )
        }

        return (
          <p key={`parrafo-${index}`} className="text-[15px] md:text-base leading-7 text-foreground/90">
            {renderInlineMarkdown(limpia)}
          </p>
        )
      })}
    </div>
  )
}

async function copiarAlPortapapeles(texto: string): Promise<void> {
  const limpio = limpiarMarkdown(texto)
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(limpio)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = limpio
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copiado = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copiado) throw new Error('No se pudo copiar el análisis')
}

export default function Analisis() {
  const { isAdmin } = useUsuarioRol()
  const { loading, resultado, error, ultimaActualizacion, generarAnalisis } = useAnalisis()
  const [copiado, setCopiado] = useState(false)
  const [errorCopiar, setErrorCopiar] = useState<string | null>(null)

  const subtitulo = isAdmin ? 'Análisis completo de la sucursal' : 'Análisis de tus familias asignadas'

  async function handleCopiar(): Promise<void> {
    if (!resultado) return
    setErrorCopiar(null)
    try {
      await copiarAlPortapapeles(resultado)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2200)
    } catch {
      setErrorCopiar('No se pudo copiar automáticamente. Mantené presionado sobre el texto para seleccionarlo.')
    }
  }

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

      <main className="px-4 md:px-8 py-5 md:py-6 space-y-4 pb-44 md:pb-12">
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
            <section className="bg-white rounded-card shadow-card animate-fade-in overflow-hidden">
              <div className="px-5 md:px-6 py-4 border-b border-border/50 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Informe operativo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Listo para leer o compartir</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopiar()}
                  className="shrink-0 min-h-10 px-3.5 rounded-xl border border-brand/25 bg-brand-light hover:bg-brand/10 text-brand text-sm font-semibold flex items-center gap-2 transition-all active:scale-[0.97]"
                  aria-live="polite"
                >
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiado ? 'Copiado' : 'Copiar análisis'}
                </button>
              </div>

              <div className="p-5 md:p-6">
                <InformeRenderizado texto={resultado} />
              </div>
            </section>

            {errorCopiar && (
              <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">{errorCopiar}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {ultimaActualizacion && (
                <p className="text-xs text-muted-foreground">
                  Último análisis: {formatFechaHora(ultimaActualizacion)}
                </p>
              )}
              <button
                type="button"
                onClick={() => void generarAnalisis()}
                className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted hover:bg-muted/70 text-foreground text-sm font-semibold transition-all active:scale-[0.97]"
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
