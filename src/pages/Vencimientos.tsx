import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CalendarX, Search, SlidersHorizontal } from 'lucide-react'
import { useVencimientosLista } from '@/hooks/useVencimientosLista'
import type { VencimientoConProducto, FiltroNivel, NivelRiesgo } from '@/hooks/useVencimientosLista'
import { RISK_VISUAL } from '@/lib/risk-config'
import EditarVencimientoModal from '@/components/dashboard/EditarVencimientoModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function textoFecha(diasRestantes: number): { texto: string; cls: string } {
  if (diasRestantes < 0) {
    const d = Math.abs(diasRestantes)
    return { texto: `Vencido hace ${d} ${d === 1 ? 'día' : 'días'}`, cls: 'text-red-600' }
  }
  if (diasRestantes === 0) return { texto: 'Vence hoy', cls: 'text-red-600' }
  return { texto: `${diasRestantes} días`, cls: 'text-muted-foreground' }
}

function formatearFecha(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return <div className="bg-white rounded-card shadow-card h-24 animate-pulse" aria-hidden="true" />
}

// ── VencimientoCard ───────────────────────────────────────────────────────────

interface VencimientoCardProps {
  vencimiento: VencimientoConProducto
  onClick: () => void
}

function VencimientoCard({ vencimiento, onClick }: VencimientoCardProps) {
  const v = RISK_VISUAL[vencimiento.nivel_riesgo]
  const { texto: textoDias, cls: clsDias } = textoFecha(vencimiento.dias_restantes)
  const fechaFormateada = formatearFecha(vencimiento.fecha_vencimiento)

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left flex items-stretch rounded-card shadow-card overflow-hidden',
        'hover:shadow-elevated transition-all duration-150 active:scale-[0.99]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        v.rowBg,
      ].join(' ')}
    >
      {/* Left accent */}
      <div className={`w-1 shrink-0 ${v.accentBar}`} />

      {/* Content */}
      <div className="flex-1 px-4 py-3.5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {v.dotPulse ? (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${v.dot} opacity-60`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${v.dot}`} />
              </span>
            ) : (
              <span className={`shrink-0 h-2.5 w-2.5 rounded-full ${v.dot}`} aria-label={v.label} />
            )}
            <p className="text-foreground font-semibold text-sm leading-snug line-clamp-2 min-w-0">
              {vencimiento.productos.descripcion}
            </p>
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${v.badge}`}>
            {v.label.toUpperCase()}
          </span>
        </div>

        {(vencimiento.productos.marca || vencimiento.productos.categoria) && (
          <p className="text-muted-foreground text-xs mt-0.5 ml-[18px]">
            {[vencimiento.productos.marca, vencimiento.productos.categoria].filter(Boolean).join(' · ')}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-2 text-xs ml-[18px]">
          <span className="text-muted-foreground">{fechaFormateada}</span>
          <span className="text-border">·</span>
          <span className={clsDias}>{textoDias}</span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">Cant: {vencimiento.cantidad}</span>
        </div>
      </div>
    </button>
  )
}

// ── ChipFiltro ────────────────────────────────────────────────────────────────

interface ChipFiltroProps {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
  claseInactivo: string
  claseActivo: string
}

function ChipFiltro({ activo, onClick, children, claseInactivo, claseActivo }: ChipFiltroProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${activo ? claseActivo : claseInactivo}`}
    >
      {children}
    </button>
  )
}

// ── Niveles de filtro ─────────────────────────────────────────────────────────

const NIVELES_FILTRO: NivelRiesgo[] = ['decomiso', 'donacion', 'urgente', 'radar', 'seguro']

// ── Página principal ──────────────────────────────────────────────────────────

export default function Vencimientos() {
  const navigate = useNavigate()
  const {
    vencimientos,
    vencimientosTodos,
    loading,
    error,
    refetch,
    filtroNivel,
    setFiltroNivel,
    filtroCategoria,
    setFiltroCategoria,
    busqueda,
    setBusqueda,
    categorias,
  } = useVencimientosLista()

  const [vencimientoEditando, setVencimientoEditando] = useState<VencimientoConProducto | null>(null)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const hayFiltrosActivos = filtroNivel !== 'todos' || filtroCategoria !== '' || busqueda.trim() !== ''

  function limpiarFiltros() {
    setFiltroNivel('todos')
    setFiltroCategoria('')
    setBusqueda('')
  }

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
              descripcion: vencimientoEditando.productos.descripcion,
              cod_art: vencimientoEditando.productos.cod_art,
              codigo_barras: vencimientoEditando.productos.codigo_barras,
              gramaje: vencimientoEditando.productos.gramaje,
              marca: vencimientoEditando.productos.marca,
              stock_actual: vencimientoEditando.productos.stock_actual,
              venta_media_diaria: vencimientoEditando.productos.venta_media_diaria,
            },
          }}
          onClose={() => setVencimientoEditando(null)}
          onGuardado={() => { setVencimientoEditando(null); refetch() }}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-border shadow-nav px-4 py-3.5">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">Vencimientos</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? 'Cargando...' : `${vencimientosTodos.length} registros activos`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className={`flex items-center justify-center h-9 w-9 rounded-lg transition-colors ${
                hayFiltrosActivos
                  ? 'bg-brand/10 text-brand'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              aria-label="Filtros"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/scanner')}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-brand hover:bg-brand-hover text-white shadow-brand transition-all duration-150 active:scale-[0.95]"
              aria-label="Nuevo registro"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-3.5 max-w-2xl mx-auto">

        {/* Error */}
        {error && (
          <div role="alert" className="rounded-card bg-red-50 border border-red-200 px-4 py-3 flex items-center justify-between gap-3 animate-fade-in">
            <p className="text-sm text-red-600">No pudimos cargar los datos. Revisá tu conexión.</p>
            <button
              type="button"
              onClick={refetch}
              className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800 border border-red-300 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full h-10 pl-9 pr-4 bg-white border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-card transition-all duration-150"
            aria-label="Buscar por descripción"
          />
        </div>

        {/* Filtros expandibles */}
        {mostrarFiltros && (
          <div className="space-y-2.5 animate-fade-in">
            {/* Chips de nivel */}
            <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
              <ChipFiltro
                activo={filtroNivel === 'todos'}
                onClick={() => setFiltroNivel('todos')}
                claseInactivo="bg-white border border-border text-muted-foreground hover:text-foreground shadow-card"
                claseActivo="bg-foreground text-white shadow-card"
              >
                Todos
              </ChipFiltro>
              {NIVELES_FILTRO.map((nivel) => {
                const v = RISK_VISUAL[nivel]
                return (
                  <ChipFiltro
                    key={nivel}
                    activo={filtroNivel === nivel}
                    onClick={() => setFiltroNivel(nivel as FiltroNivel)}
                    claseInactivo={`${v.badge} hover:opacity-80`}
                    claseActivo={`${v.accentBar.replace('bg-', 'bg-')} text-white border-transparent`}
                  >
                    {v.label}
                  </ChipFiltro>
                )
              })}
            </div>

            {/* Selector categoría */}
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-brand shadow-card transition-colors"
              aria-label="Filtrar por categoría"
            >
              <option value="">Todas las categorías</option>
              {categorias.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        )}

        {/* Filtros activos: limpiar */}
        {hayFiltrosActivos && (
          <div className="flex items-center justify-between animate-fade-in">
            <span className="text-xs text-muted-foreground">{vencimientos.length} resultado{vencimientos.length !== 1 ? 's' : ''}</span>
            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-xs font-semibold text-brand hover:text-brand-hover transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Skeletons */}
        {loading && (
          <div className="space-y-2.5">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        )}

        {/* Lista */}
        {!loading && !error && vencimientos.length > 0 && (
          <div className="space-y-2.5">
            {vencimientos.map((v) => (
              <VencimientoCard key={v.id} vencimiento={v} onClick={() => setVencimientoEditando(v)} />
            ))}
          </div>
        )}

        {/* Vacío */}
        {!loading && !error && vencimientos.length === 0 && (
          <div className="rounded-card bg-white shadow-card px-6 py-12 flex flex-col items-center text-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              <CalendarX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="text-foreground font-semibold text-base">
                {hayFiltrosActivos ? 'Sin resultados' : 'Sin vencimientos registrados'}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {hayFiltrosActivos ? 'Probá con otros filtros.' : 'Empezá escaneando un producto.'}
              </p>
            </div>
            {hayFiltrosActivos ? (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="px-5 py-2.5 rounded-lg bg-muted hover:bg-muted/70 text-foreground text-sm font-semibold transition-all active:scale-[0.97]"
              >
                Limpiar filtros
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/scanner')}
                className="px-6 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-brand transition-all active:scale-[0.97]"
              >
                Ir al Scanner
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
