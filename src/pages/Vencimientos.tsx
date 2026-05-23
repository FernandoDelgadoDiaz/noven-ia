import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CalendarX, Calendar } from 'lucide-react'
import { useVencimientosLista } from '@/hooks/useVencimientosLista'
import type { VencimientoConProducto, FiltroNivel, NivelRiesgo } from '@/hooks/useVencimientosLista'
import EditarVencimientoModal from '@/components/dashboard/EditarVencimientoModal'

// ───────────────────────────────────────────────
// Helpers de color por nivel de riesgo (5 niveles)
// ───────────────────────────────────────────────

interface NivelConfig {
  semaforo: string
  chipInactivo: string
  chipActivo: string
  badge: string
  label: string
}

const NIVEL_CONFIG: Record<NivelRiesgo, NivelConfig> = {
  seguro: {
    semaforo: 'bg-green-500',
    chipInactivo: 'bg-green-500/20 text-green-400',
    chipActivo: 'bg-green-500 text-white',
    badge: 'bg-green-500/20 text-green-400 border border-green-500/40',
    label: 'Seguro',
  },
  radar: {
    semaforo: 'bg-yellow-500',
    chipInactivo: 'bg-yellow-500/20 text-yellow-400',
    chipActivo: 'bg-yellow-500 text-black',
    badge: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
    label: 'Radar',
  },
  urgente: {
    semaforo: 'bg-orange-500',
    chipInactivo: 'bg-orange-500/20 text-orange-400',
    chipActivo: 'bg-orange-500 text-white',
    badge: 'bg-orange-500/20 text-orange-400 border border-orange-500/40',
    label: 'Urgente',
  },
  donacion: {
    semaforo: 'bg-red-500',
    chipInactivo: 'bg-red-500/20 text-red-400',
    chipActivo: 'bg-red-500 text-white',
    badge: 'bg-red-500/20 text-red-400 border border-red-500/40',
    label: 'Donacion',
  },
  decomiso: {
    semaforo: 'bg-gray-700',
    chipInactivo: 'bg-gray-800 text-gray-300 border border-red-700/40',
    chipActivo: 'bg-gray-900 text-gray-200 border border-red-600',
    badge: 'bg-gray-900/80 text-gray-300 border border-red-600/60',
    label: 'Decomiso',
  },
}

// ───────────────────────────────────────────────
// Texto de días restantes
// ───────────────────────────────────────────────

function textoFecha(diasRestantes: number): { texto: string; claseTexto: string } {
  if (diasRestantes < 0) {
    const dias = Math.abs(diasRestantes)
    return {
      texto: `Vencido hace ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
      claseTexto: 'text-red-400',
    }
  }
  if (diasRestantes === 0) {
    return { texto: 'Vence hoy', claseTexto: 'text-red-400' }
  }
  return { texto: `${diasRestantes} dias`, claseTexto: 'text-gray-400' }
}

// ───────────────────────────────────────────────
// Formatear fecha YYYY-MM-DD → DD/MM/YYYY
// ───────────────────────────────────────────────

function formatearFecha(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

// ───────────────────────────────────────────────
// Skeleton card
// ───────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-gray-800 rounded-2xl h-24 animate-pulse" aria-hidden="true" />
  )
}

// ───────────────────────────────────────────────
// Card de vencimiento
// ───────────────────────────────────────────────

interface VencimientoCardProps {
  vencimiento: VencimientoConProducto
  onClick: () => void
}

function VencimientoCard({ vencimiento, onClick }: VencimientoCardProps) {
  const config = NIVEL_CONFIG[vencimiento.nivel_riesgo]
  const { texto: textoDias, claseTexto } = textoFecha(vencimiento.dias_restantes)
  const fechaFormateada = formatearFecha(vencimiento.fecha_vencimiento)

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Semaforo + info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span
            className={`mt-1 shrink-0 h-3 w-3 rounded-full ${config.semaforo}`}
            aria-label={`Nivel ${config.label}`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight line-clamp-2">
              {vencimiento.productos.descripcion}
            </p>
            {(vencimiento.productos.marca || vencimiento.productos.categoria) && (
              <p className="text-gray-500 text-xs mt-0.5">
                {[vencimiento.productos.marca, vencimiento.productos.categoria]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs">
              <span className="flex items-center gap-1 text-gray-400">
                <Calendar className="h-3 w-3 shrink-0" />
                {fechaFormateada}
              </span>
              <span className="text-gray-600">·</span>
              <span className={claseTexto}>{textoDias}</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-400">Cant: {vencimiento.cantidad}</span>
            </div>
          </div>
        </div>

        {/* Badge nivel */}
        <span
          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${config.badge}`}
        >
          {config.label.toUpperCase()}
        </span>
      </div>
    </button>
  )
}

// ───────────────────────────────────────────────
// Chips de filtro por nivel
// ───────────────────────────────────────────────

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
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activo ? claseActivo : claseInactivo}`}
    >
      {children}
    </button>
  )
}

// ───────────────────────────────────────────────
// Página principal
// ───────────────────────────────────────────────

// Orden de los niveles en los chips de filtro
const NIVELES_FILTRO: NivelRiesgo[] = ['decomiso', 'donacion', 'urgente', 'radar', 'seguro']

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

  const [vencimientoEditando, setVencimientoEditando] =
    useState<VencimientoConProducto | null>(null)

  const hayFiltrosActivos =
    filtroNivel !== 'todos' || filtroCategoria !== '' || busqueda.trim() !== ''

  function limpiarFiltros() {
    setFiltroNivel('todos')
    setFiltroCategoria('')
    setBusqueda('')
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Modal edicion */}
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
              stock_actual: vencimientoEditando.productos.stock_actual,
              venta_media_diaria: vencimientoEditando.productos.venta_media_diaria,
            },
          }}
          onClose={() => setVencimientoEditando(null)}
          onGuardado={() => {
            setVencimientoEditando(null)
            refetch()
          }}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Vencimientos</h1>
            <p className="text-xs text-gray-500">
              {loading ? 'Cargando...' : `${vencimientosTodos.length} registros activos`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/scanner')}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-green-500 hover:bg-green-400 active:bg-green-600 text-white transition-colors"
            aria-label="Ir al Scanner"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {/* Error state */}
        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-950/60 border border-red-800/60 px-4 py-3 flex items-center justify-between gap-3"
          >
            <p className="text-sm text-red-400">
              No pudimos cargar los datos. Revisa tu conexion e intenta de nuevo.
            </p>
            <button
              type="button"
              onClick={refetch}
              className="shrink-0 text-xs font-semibold text-red-300 hover:text-white border border-red-700/60 hover:border-red-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="space-y-3">
          {/* Chips de nivel: Todos + 5 niveles */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <ChipFiltro
              activo={filtroNivel === 'todos'}
              onClick={() => setFiltroNivel('todos')}
              claseInactivo="bg-gray-800 text-gray-300"
              claseActivo="bg-gray-600 text-white"
            >
              Todos
            </ChipFiltro>
            {NIVELES_FILTRO.map((nivel) => {
              const cfg = NIVEL_CONFIG[nivel]
              return (
                <ChipFiltro
                  key={nivel}
                  activo={filtroNivel === nivel}
                  onClick={() => setFiltroNivel(nivel as FiltroNivel)}
                  claseInactivo={cfg.chipInactivo}
                  claseActivo={cfg.chipActivo}
                >
                  {cfg.label}
                </ChipFiltro>
              )
            })}
          </div>

          {/* Select categoria + buscador */}
          <div className="flex gap-2">
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="flex-1 h-9 px-3 bg-gray-900 border border-gray-800 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas las categorias</option>
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto..."
              className="flex-1 h-9 px-3 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
              aria-label="Buscar por descripcion"
            />
          </div>
        </div>

        {/* Loading: skeletons */}
        {loading && (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Lista de cards */}
        {!loading && !error && vencimientos.length > 0 && (
          <div className="space-y-3">
            {vencimientos.map((v) => (
              <VencimientoCard
                key={v.id}
                vencimiento={v}
                onClick={() => setVencimientoEditando(v)}
              />
            ))}
          </div>
        )}

        {/* Estado vacio */}
        {!loading && !error && vencimientos.length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-6 py-12 flex flex-col items-center text-center gap-4">
            <CalendarX className="h-12 w-12 text-gray-600" aria-hidden="true" />
            <div>
              <p className="text-white font-semibold text-base">
                No hay vencimientos registrados
              </p>
              {hayFiltrosActivos ? (
                <p className="text-gray-400 text-sm mt-1">Proba con otros filtros</p>
              ) : (
                <p className="text-gray-400 text-sm mt-1">
                  Empieza escaneando un producto para registrar vencimientos.
                </p>
              )}
            </div>
            {hayFiltrosActivos ? (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 active:scale-95 text-white text-sm font-semibold transition-all"
              >
                Limpiar filtros
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/scanner')}
                className="px-5 py-2.5 rounded-lg bg-green-500 hover:bg-green-400 active:scale-95 text-black text-sm font-semibold transition-all"
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
