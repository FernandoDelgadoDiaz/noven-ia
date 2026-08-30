import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, CalendarX, Search, SlidersHorizontal, FolderX, X } from 'lucide-react'
import { useVencimientosLista } from '@/hooks/useVencimientosLista'
import { usePuedeOperarSucursal } from '@/hooks/usePuedeOperarSucursal'
import type { VencimientoConProducto, FiltroNivel, NivelRiesgo } from '@/hooks/useVencimientosLista'
import { RISK_VISUAL } from '@/lib/risk-config'
import EditarVencimientoModal from '@/components/dashboard/EditarVencimientoModal'
import ProductIdentity from '@/components/product/ProductIdentity'

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

function SkeletonCard() {
  return <div className="bg-white rounded-card shadow-card h-32 animate-pulse" aria-hidden="true" />
}

interface VencimientoCardProps {
  vencimiento: VencimientoConProducto
  onClick?: () => void
}

function VencimientoCard({ vencimiento, onClick }: VencimientoCardProps) {
  const v = RISK_VISUAL[vencimiento.nivel_riesgo]
  const { texto: textoDias, cls: clsDias } = textoFecha(vencimiento.dias_restantes)
  const fechaFormateada = formatearFecha(vencimiento.fecha_vencimiento)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={[
        'w-full text-left flex items-stretch rounded-card shadow-card overflow-hidden',
        'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        onClick ? 'hover:shadow-elevated hover:-translate-y-px active:scale-[0.99] active:translate-y-0' : 'cursor-default',
        v.cardGradient,
      ].join(' ')}
    >
      <div className={`w-1.5 shrink-0 ${v.accentBar}`} />
      <div className="flex-1 px-4 py-3.5 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <ProductIdentity producto={vencimiento.productos} compact imageSize="sm" />
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full leading-tight ${v.badge}`}>
            {v.label.toUpperCase()}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-2 text-xs ml-[60px]">
          <span className="text-muted-foreground">{fechaFormateada}</span>
          <span className="text-border">·</span>
          <span className={clsDias}>{textoDias}</span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">Comprometido: {vencimiento.cantidad} un.</span>
        </div>
      </div>
    </button>
  )
}

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

const NIVELES_FILTRO: NivelRiesgo[] = ['decomiso', 'donacion', 'urgente', 'radar', 'seguro']
const NIVELES_ACCION_INMEDIATA: NivelRiesgo[] = ['urgente', 'donacion', 'decomiso']
const NIVELES_EN_RIESGO: NivelRiesgo[] = ['urgente', 'donacion', 'decomiso', 'radar']
type FiltroUrl = 'accion' | 'riesgo' | 'radar'
const FILTRO_URL_LABEL: Record<FiltroUrl, string> = {
  accion: 'productos con acción inmediata',
  riesgo: 'productos en riesgo',
  radar: 'productos en radar',
}

export default function Vencimientos() {
  const navigate = useNavigate()
  const { puedeOperar } = usePuedeOperarSucursal()
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
    sinFamilias,
  } = useVencimientosLista()

  const [searchParams, setSearchParams] = useSearchParams()
  const filtroUrlRaw = searchParams.get('filtro')
  const filtroUrl: FiltroUrl | null =
    filtroUrlRaw === 'accion' || filtroUrlRaw === 'riesgo' || filtroUrlRaw === 'radar' ? filtroUrlRaw : null

  const [vencimientoEditando, setVencimientoEditando] = useState<VencimientoConProducto | null>(null)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const hayFiltrosActivos = filtroNivel !== 'todos' || filtroCategoria !== '' || busqueda.trim() !== ''

  const vencimientosMostrados = useMemo(() => {
    if (filtroUrl === 'accion') return vencimientos.filter((v) => NIVELES_ACCION_INMEDIATA.includes(v.nivel_riesgo))
    if (filtroUrl === 'riesgo') return vencimientos.filter((v) => NIVELES_EN_RIESGO.includes(v.nivel_riesgo))
    if (filtroUrl === 'radar') return vencimientos.filter((v) => v.nivel_riesgo === 'radar')
    return vencimientos
  }, [vencimientos, filtroUrl])

  const resumenHeader = useMemo(() => {
    if (filtroUrl === 'accion') {
      const n = vencimientosMostrados.length
      return `${n} producto${n === 1 ? '' : 's'} con acción inmediata`
    }
    if (filtroUrl === 'riesgo') {
      const n = vencimientosMostrados.length
      return `${n} producto${n === 1 ? '' : 's'} en riesgo`
    }
    if (filtroUrl === 'radar') {
      const n = vencimientosMostrados.length
      return `${n} producto${n === 1 ? '' : 's'} en radar`
    }
    return `${vencimientosTodos.length} registros activos`
  }, [filtroUrl, vencimientosMostrados.length, vencimientosTodos.length])

  function limpiarFiltros() {
    setFiltroNivel('todos')
    setFiltroCategoria('')
    setBusqueda('')
  }

  function limpiarFiltroUrl() {
    searchParams.delete('filtro')
    setSearchParams(searchParams, { replace: true })
  }

  return (
    <div className="min-h-screen bg-surface-base">
      {puedeOperar && vencimientoEditando !== null && (
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
              imagen_url: vencimientoEditando.productos.imagen_url,
            },
          }}
          onClose={() => setVencimientoEditando(null)}
          onGuardado={() => { setVencimientoEditando(null); refetch() }}
          onImagenActualizada={() => refetch()}
        />
      )}

      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none">Vencimientos</h1>
            <p className="text-sm text-muted-foreground mt-1 leading-none">
              {loading ? 'Cargando...' : resumenHeader}
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
            {puedeOperar && (
              <button
                type="button"
                onClick={() => navigate('/scanner')}
                className="flex items-center justify-center h-9 w-9 rounded-lg bg-brand hover:bg-brand-hover text-white shadow-brand transition-all duration-150 active:scale-[0.95]"
                aria-label="Nuevo registro"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-5 md:py-6 space-y-4">
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

        {!loading && sinFamilias && (
          <div role="alert" className="rounded-card bg-amber-50 border border-amber-200 px-5 py-4 flex items-center gap-4 animate-fade-in">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <FolderX className="h-5 w-5 text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-amber-800 text-sm">Sin familias asignadas</p>
              <p className="text-amber-700 text-xs mt-0.5">No tenés familias asignadas. Contactá al administrador.</p>
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar descripción, interno o EAN..."
            className="w-full h-10 pl-9 pr-4 bg-white border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-card transition-all duration-150"
            aria-label="Buscar producto por descripción, código interno o EAN"
          />
        </div>

        {mostrarFiltros && (
          <div className="space-y-2.5 animate-fade-in">
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

        {hayFiltrosActivos && (
          <div className="flex items-center justify-between animate-fade-in">
            <span className="text-xs text-muted-foreground">{vencimientosMostrados.length} resultado{vencimientosMostrados.length !== 1 ? 's' : ''}</span>
            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-xs font-semibold text-brand hover:text-brand-hover transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {filtroUrl && (
          <div className="flex items-center justify-between gap-3 rounded-card bg-brand-light border border-brand-muted px-4 py-3 animate-fade-in">
            <p className="text-sm text-brand font-medium min-w-0">
              Mostrando: <span className="font-semibold">{FILTRO_URL_LABEL[filtroUrl]}</span>
            </p>
            <button
              type="button"
              onClick={limpiarFiltroUrl}
              className="shrink-0 flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-hover border border-brand/30 hover:border-brand/50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Ver todos
            </button>
          </div>
        )}

        {loading && (
          <div className="space-y-2.5">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        )}

        {!loading && !error && vencimientosMostrados.length > 0 && (
          <div className="space-y-2.5">
            {vencimientosMostrados.map((v) => (
              <VencimientoCard
                key={v.id}
                vencimiento={v}
                onClick={puedeOperar ? () => setVencimientoEditando(v) : undefined}
              />
            ))}
          </div>
        )}

        {!loading && !error && vencimientosMostrados.length === 0 && (
          <div className="rounded-card bg-white shadow-card px-6 py-12 flex flex-col items-center text-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              <CalendarX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="text-foreground font-semibold text-base">
                {hayFiltrosActivos || filtroUrl ? 'Sin resultados' : 'Sin vencimientos registrados'}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {hayFiltrosActivos || filtroUrl
                  ? 'Probá con otros filtros.'
                  : puedeOperar
                    ? 'Empezá escaneando un producto.'
                    : 'No hay vencimientos registrados en esta sucursal.'}
              </p>
            </div>
            {filtroUrl ? (
              <button
                type="button"
                onClick={limpiarFiltroUrl}
                className="px-5 py-2.5 rounded-lg bg-muted hover:bg-muted/70 text-foreground text-sm font-semibold transition-all active:scale-[0.97]"
              >
                Ver todos
              </button>
            ) : hayFiltrosActivos ? (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="px-5 py-2.5 rounded-lg bg-muted hover:bg-muted/70 text-foreground text-sm font-semibold transition-all active:scale-[0.97]"
              >
                Limpiar filtros
              </button>
            ) : puedeOperar ? (
              <button
                type="button"
                onClick={() => navigate('/scanner')}
                className="px-6 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-brand transition-all active:scale-[0.97]"
              >
                Ir al Scanner
              </button>
            ) : null}
          </div>
        )}
      </main>
    </div>
  )
}