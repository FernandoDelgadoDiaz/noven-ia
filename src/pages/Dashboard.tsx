import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, ScanLine, RefreshCw } from 'lucide-react'
import { useVencimientos } from '@/hooks/useVencimientos'
import RiesgoCard from '@/components/dashboard/RiesgoCard'
import AlertaItem from '@/components/dashboard/AlertaItem'
import EditarVencimientoModal from '@/components/dashboard/EditarVencimientoModal'
import type { VencimientoConRiesgo } from '@/types/index'

const SUCURSAL_ID = '00000000-0000-0000-0000-000000000001'

const ORDEN_RIESGO: Record<string, number> = {
  decomiso: 0,
  donacion: 1,
  urgente: 2,
  radar: 3,
  seguro: 4,
}

function calcularUnidadesEnRiesgo(items: VencimientoConRiesgo[]): number {
  return items.reduce((acc, v) => acc + v.cantidad, 0)
}

function formatFechaHoy(): string {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useVencimientos(SUCURSAL_ID)
  const [vencimientoEditando, setVencimientoEditando] = useState<VencimientoConRiesgo | null>(null)

  const alertasOrdenadas = [...data].sort(
    (a, b) => ORDEN_RIESGO[a.nivel_riesgo] - ORDEN_RIESGO[b.nivel_riesgo],
  )

  const enRiesgo = data.filter(
    (v) => v.nivel_riesgo === 'decomiso' || v.nivel_riesgo === 'donacion' || v.nivel_riesgo === 'urgente',
  ).length

  const unidadesEnRiesgo = calcularUnidadesEnRiesgo(
    data.filter((v) => v.nivel_riesgo === 'decomiso' || v.nivel_riesgo === 'donacion' || v.nivel_riesgo === 'urgente'),
  )

  const enRadar = data.filter((v) => v.nivel_riesgo === 'radar').length
  const decomisados = data.filter((v) => v.nivel_riesgo === 'decomiso').length
  const hayCriticos = decomisados > 0 || data.some((v) => v.nivel_riesgo === 'donacion')

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Modal */}
      {vencimientoEditando !== null && (
        <EditarVencimientoModal
          vencimiento={{
            id: vencimientoEditando.id,
            producto_id: vencimientoEditando.producto_id,
            fecha_vencimiento: vencimientoEditando.fecha_vencimiento,
            cantidad: vencimientoEditando.cantidad,
            nivel_riesgo: vencimientoEditando.nivel_riesgo,
            productos: {
              descripcion: vencimientoEditando.producto.descripcion,
              cod_art: vencimientoEditando.producto.cod_art,
              codigo_barras: vencimientoEditando.producto.codigo_barras,
              gramaje: vencimientoEditando.producto.gramaje,
              marca: vencimientoEditando.producto.marca,
              stock_actual: vencimientoEditando.producto.stock_actual,
              venta_media_diaria: vencimientoEditando.producto.venta_media_diaria,
            },
          }}
          onClose={() => setVencimientoEditando(null)}
          onGuardado={() => { setVencimientoEditando(null); void refetch() }}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-border shadow-nav px-4 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">
              NoVen <span className="text-brand">IA</span>
            </h1>
            <p className="text-xs text-muted-foreground capitalize">{formatFechaHoy()}</p>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={loading}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            aria-label="Actualizar datos"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 space-y-5 max-w-2xl mx-auto">

        {/* Error state */}
        {error && (
          <div role="alert" className="rounded-card bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 animate-fade-in">
            No pudimos cargar los datos. Revisá tu conexión e intentá de nuevo.
          </div>
        )}

        {/* Skeleton */}
        {loading && data.length === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-card bg-white shadow-card h-[108px] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* Banner crítico */}
            {hayCriticos && (
              <div className="bg-red-50 border border-red-200 rounded-card px-4 py-3.5 flex items-center gap-3 animate-fade-in">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <p className="text-sm font-semibold text-red-700">
                  {decomisados > 0
                    ? `${decomisados} producto${decomisados > 1 ? 's' : ''} en decomiso — acción inmediata requerida`
                    : 'Productos para donación detectados'}
                </p>
              </div>
            )}

            {/* Stat cards */}
            <section aria-label="Resumen de riesgos">
              <div className="grid grid-cols-2 gap-3">
                <RiesgoCard
                  titulo="En riesgo"
                  valor={enRiesgo}
                  nivel={enRiesgo > 0 ? 'urgente' : 'seguro'}
                  onClick={() => navigate('/vencimientos')}
                />
                <RiesgoCard
                  titulo="Unidades en riesgo"
                  valor={unidadesEnRiesgo}
                  nivel={unidadesEnRiesgo > 0 ? 'urgente' : 'seguro'}
                  IconoComponente={Package}
                  onClick={() => navigate('/vencimientos')}
                />
                <RiesgoCard
                  titulo="En radar"
                  valor={enRadar}
                  nivel={enRadar > 0 ? 'radar' : 'seguro'}
                  onClick={() => navigate('/vencimientos')}
                />
                <RiesgoCard
                  titulo="Decomiso"
                  valor={decomisados}
                  nivel={decomisados > 0 ? 'decomiso' : 'seguro'}
                  onClick={() => navigate('/vencimientos')}
                />
              </div>
            </section>

            {/* Lista de alertas */}
            <section aria-label="Alertas de vencimiento">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Alertas priorizadas
                </h2>
                {alertasOrdenadas.length > 0 && (
                  <span className="text-xs text-muted-foreground font-medium">
                    {alertasOrdenadas.length} registros
                  </span>
                )}
              </div>

              {alertasOrdenadas.length === 0 ? (
                <div className="rounded-card bg-white shadow-card px-6 py-12 flex flex-col items-center text-center gap-4">
                  <div className="p-4 bg-emerald-50 rounded-full">
                    <ScanLine className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-foreground font-semibold text-base">Sin productos registrados</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      Usá el Scanner para cargar el primer vencimiento.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/scanner')}
                    className="px-6 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-brand transition-all duration-150 active:scale-[0.97]"
                  >
                    Ir al Scanner
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {alertasOrdenadas.map((v) => (
                    <AlertaItem
                      key={v.id}
                      vencimiento={v}
                      onClick={() => setVencimientoEditando(v)}
                    />
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
