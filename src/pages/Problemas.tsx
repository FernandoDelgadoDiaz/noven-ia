import { useState } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import ProblemasActivosPanel from '@/components/dashboard/ProblemasActivosPanel'
import { useProblemasActivos } from '@/hooks/useProblemasActivos'
import { useSucursalActual } from '@/hooks/useSucursalActual'

export default function Problemas() {
  const { sucursalId } = useSucursalActual()
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const {
    resumen,
    problemas,
    loading,
    error,
    refetch,
  } = useProblemasActivos(sucursalId)

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5 text-brand" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none">Problemas</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-none">Seguimiento de problemas económicos activos</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void refetch()}
            disabled={loading}
            className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground transition-colors duration-150 disabled:opacity-40 active:scale-[0.94]"
            aria-label="Actualizar problemas"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="px-4 md:px-8 py-4 md:py-6 pb-28 md:pb-10">
        <ProblemasActivosPanel
          resumen={resumen}
          problemas={problemas}
          loading={loading}
          error={error}
          mostrarTodos={mostrarTodos}
          onVerTodos={() => setMostrarTodos(true)}
        />
      </main>
    </div>
  )
}
