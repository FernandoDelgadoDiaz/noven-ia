import { useNavigate } from 'react-router-dom'
import { useVencimientos } from '@/hooks/useVencimientos'
import RiesgoCard from '@/components/dashboard/RiesgoCard'
import AlertaItem from '@/components/dashboard/AlertaItem'
import type { VencimientoConRiesgo } from '@/types/index'

const SUCURSAL_ID = '00000000-0000-0000-0000-000000000001'

const ORDEN_RIESGO: Record<string, number> = {
  critico: 0,
  alto: 1,
  moderado: 2,
  seguro: 3,
}

function calcularPerdidaPotencial(items: VencimientoConRiesgo[]): string {
  const total = items.reduce((acc, v) => {
    const precio = v.producto.precio_costo ?? 0
    return acc + v.cantidad * precio
  }, 0)

  if (total === 0) return '$0'
  if (total >= 1000) {
    return `$${(total / 1000).toFixed(1)}k`
  }
  return `$${total.toFixed(0)}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, loading, error } = useVencimientos(SUCURSAL_ID)

  // Ordenar por nivel de riesgo
  const alertasOrdenadas = [...data].sort(
    (a, b) => ORDEN_RIESGO[a.nivel_riesgo] - ORDEN_RIESGO[b.nivel_riesgo],
  )

  const enRiesgo = data.filter(
    (v) => v.nivel_riesgo === 'critico' || v.nivel_riesgo === 'alto',
  ).length

  const perdida = calcularPerdidaPotencial(
    data.filter((v) => v.nivel_riesgo === 'critico' || v.nivel_riesgo === 'alto'),
  )

  const proximosA30 = data.filter((v) => v.dias_restantes >= 0 && v.dias_restantes <= 30).length

  const vencidosHoy = data.filter((v) => v.dias_restantes === 0).length

  return (
    <div className="dark min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white leading-tight">
              NoVen <span className="text-[#22c55e]">IA</span>
            </h1>
            <p className="text-xs text-zinc-500">Control de vencimientos</p>
          </div>
          {loading && (
            <span className="text-xs text-zinc-500 flex items-center gap-1.5">
              <span className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-[#22c55e]" />
              Actualizando
            </span>
          )}
        </div>
      </header>

      <main className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        {/* Error state */}
        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-950/60 border border-red-800/60 px-4 py-3 text-sm text-red-400"
          >
            No pudimos cargar los datos. Revisá tu conexion e intentá de nuevo.
          </div>
        )}

        {/* Skeleton de carga */}
        {loading && data.length === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 h-24 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Cards de resumen */}
        {!loading && (
          <>
            <section aria-label="Resumen de riesgos">
              <div className="grid grid-cols-2 gap-3">
                <RiesgoCard
                  titulo="En riesgo"
                  valor={enRiesgo}
                  icono="🔴"
                  color="red"
                />
                <RiesgoCard
                  titulo="Perdida potencial"
                  valor={perdida}
                  icono="💸"
                  color="yellow"
                />
                <RiesgoCard
                  titulo="Proximos 30 dias"
                  valor={proximosA30}
                  icono="📅"
                  color="blue"
                />
                <RiesgoCard
                  titulo="Vencen hoy"
                  valor={vencidosHoy}
                  icono="⚠️"
                  color={vencidosHoy > 0 ? 'red' : 'green'}
                />
              </div>
            </section>

            {/* Lista de alertas */}
            <section aria-label="Alertas de vencimiento">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wide">
                Alertas priorizadas
              </h2>

              {alertasOrdenadas.length === 0 ? (
                /* Estado vacio */
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-10 flex flex-col items-center text-center gap-4">
                  <span className="text-5xl" aria-hidden="true">
                    📦
                  </span>
                  <div>
                    <p className="text-white font-semibold text-base">
                      No hay productos registrados aun
                    </p>
                    <p className="text-zinc-400 text-sm mt-1">
                      Usa el Scanner para cargar el primer vencimiento.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/scanner')}
                    className="mt-1 px-5 py-2.5 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] active:scale-95 text-black text-sm font-semibold transition-all"
                  >
                    Ir al Scanner
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {alertasOrdenadas.map((v) => (
                    <AlertaItem key={v.id} vencimiento={v} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
