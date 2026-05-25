import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, ScanLine, RefreshCw, AlertTriangle, Bell } from 'lucide-react'
import { useVencimientos } from '@/hooks/useVencimientos'
import { useAuth } from '@/hooks/useAuth'
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

function formatFechaHeader(): string {
  const raw = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días 👋'
  if (h < 18) return 'Buenas tardes 👋'
  return 'Buenas noches 👋'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useVencimientos(SUCURSAL_ID)
  const { user } = useAuth()
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

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? 'U'

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
              imagen_url: vencimientoEditando.producto.imagen_url,
            },
          }}
          onClose={() => setVencimientoEditando(null)}
          onGuardado={() => { setVencimientoEditando(null); void refetch() }}
        />
      )}

      {/* ── Header premium ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center justify-between">

          {/* Left: greeting + context */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none">
              {getGreeting()}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatFechaHeader()}
            </p>
          </div>

          {/* Right: actions + avatar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={loading}
              className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground transition-colors duration-150 disabled:opacity-40 active:scale-[0.94]"
              aria-label="Actualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              className="relative h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground transition-colors duration-150 active:scale-[0.94]"
              aria-label="Notificaciones"
            >
              <Bell className="h-4 w-4" />
              {hayCriticos && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
              )}
            </button>

            <div
              className="h-9 w-9 rounded-full bg-brand flex items-center justify-center text-white font-bold text-sm shadow-brand shrink-0 select-none"
              aria-label="Perfil"
            >
              {avatarLetter}
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="px-4 md:px-8 py-5 md:py-6 space-y-5 md:space-y-6">

        {/* Error */}
        {error && (
          <div role="alert" className="rounded-[20px] bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 animate-fade-in">
            No pudimos cargar los datos. Revisá tu conexión e intentá de nuevo.
          </div>
        )}

        {/* Skeleton */}
        {loading && data.length === 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-[24px] bg-white shadow-card h-[136px] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* ── Critical hero banner ── */}
            {enRiesgo > 0 && (
              <div className="flex items-center gap-4 bg-red-50 border-l-4 border-red-600 rounded-r-2xl px-5 py-4 animate-fade-in">
                <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-red-800 text-sm leading-snug">Atención requerida</p>
                  <p className="text-red-600 text-xs mt-0.5">
                    {enRiesgo} producto{enRiesgo !== 1 ? 's' : ''} en estado crítico — Requieren acción inmediata para evitar pérdidas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/vencimientos')}
                  className="shrink-0 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition-colors duration-150 active:scale-[0.97] whitespace-nowrap"
                >
                  Ver vencimientos →
                </button>
              </div>
            )}

            {/* ── KPI command center ── */}
            <section aria-label="Resumen de riesgos">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <RiesgoCard
                  titulo="En riesgo"
                  valor={enRiesgo}
                  nivel={enRiesgo > 0 ? 'urgente' : 'seguro'}
                  onClick={() => navigate('/vencimientos')}
                  subtexto={enRiesgo > 0 ? 'Acción inmediata' : undefined}
                  subtextoColor="text-red-500"
                />
                <RiesgoCard
                  titulo="Unidades"
                  valor={unidadesEnRiesgo}
                  nivel={unidadesEnRiesgo > 0 ? 'urgente' : 'seguro'}
                  IconoComponente={Package}
                  onClick={() => navigate('/vencimientos')}
                  subtexto={`En ${enRiesgo} productos`}
                  subtextoColor="text-muted-foreground"
                />
                <RiesgoCard
                  titulo="En radar"
                  valor={enRadar}
                  nivel={enRadar > 0 ? 'radar' : 'seguro'}
                  onClick={() => navigate('/vencimientos')}
                  subtexto="Próximos 30 días"
                  subtextoColor="text-muted-foreground"
                />
                <RiesgoCard
                  titulo="Decomiso"
                  valor={decomisados}
                  nivel={decomisados > 0 ? 'decomiso' : 'seguro'}
                  onClick={() => navigate('/vencimientos')}
                  subtexto={decomisados === 0 ? 'Excelente' : `${decomisados} vencidos`}
                  subtextoColor={decomisados === 0 ? 'text-emerald-600' : 'text-red-500'}
                />
              </div>
            </section>

            {/* ── Alertas priorizadas ── */}
            <section aria-label="Alertas de vencimiento">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  Alertas priorizadas
                </h2>
                {alertasOrdenadas.length > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {alertasOrdenadas.length} registros
                  </span>
                )}
              </div>

              {alertasOrdenadas.length === 0 ? (
                <div className="rounded-[24px] bg-white shadow-card px-6 py-12 flex flex-col items-center text-center gap-4">
                  <div className="p-4 bg-emerald-50 rounded-full">
                    <ScanLine className="h-10 w-10 text-emerald-400" aria-hidden="true" />
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
                    className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-brand transition-all duration-150 active:scale-[0.97]"
                  >
                    Ir al Scanner
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
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
