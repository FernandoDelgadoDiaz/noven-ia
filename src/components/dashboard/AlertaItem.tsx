import { calcularDiasStock } from '@/lib/riesgo'
import type { RiesgoNivel, VencimientoConRiesgo } from '@/types/index'

interface AlertaItemProps {
  vencimiento: VencimientoConRiesgo
  onClick?: () => void
}

interface NivelConfig {
  label: string
  badgeCls: string
  dotCls: string
  pulsante: boolean
  diasCls: string
}

const nivelConfig: Record<RiesgoNivel, NivelConfig> = {
  seguro: {
    label: 'Seguro',
    badgeCls: 'bg-green-500/20 text-green-400 border border-green-500/40',
    dotCls: 'bg-green-500',
    pulsante: false,
    diasCls: 'text-green-400',
  },
  radar: {
    label: 'Radar',
    badgeCls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
    dotCls: 'bg-yellow-500',
    pulsante: false,
    diasCls: 'text-yellow-400',
  },
  urgente: {
    label: 'Urgente',
    badgeCls: 'bg-orange-500/20 text-orange-400 border border-orange-500/40',
    dotCls: 'bg-orange-500',
    pulsante: false,
    diasCls: 'text-orange-400',
  },
  donacion: {
    label: 'Donación',
    badgeCls: 'bg-red-500/20 text-red-400 border border-red-500/40',
    dotCls: 'bg-red-500',
    pulsante: true,
    diasCls: 'text-red-400',
  },
  decomiso: {
    label: 'Decomiso',
    badgeCls: 'bg-gray-900/80 text-gray-300 border border-red-600/60',
    dotCls: 'bg-gray-700',
    pulsante: true,
    diasCls: 'text-gray-400',
  },
}

function formatTitulo(descripcion: string, gramaje: string | null, marca: string | null): string {
  const partes: string[] = [descripcion]
  if (gramaje) partes.push(gramaje)
  const base = partes.join(' ')
  if (marca) return `${base} — ${marca}`
  return base
}

function formatDiasRestantes(dias: number): string {
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} días`
  if (dias === 0) return 'Vence HOY'
  return `Vence en ${dias} días`
}

function formatDiasStock(cantidadLote: number, ventaMediaDiaria: number): string {
  if (ventaMediaDiaria <= 0) return 'Sin rotación'
  const dias = calcularDiasStock(cantidadLote, ventaMediaDiaria)
  return `${dias} días`
}

export default function AlertaItem({ vencimiento, onClick }: AlertaItemProps) {
  const cfg = nivelConfig[vencimiento.nivel_riesgo]
  const { producto } = vencimiento

  const titulo = formatTitulo(producto.descripcion, producto.gramaje, producto.marca)
  const diasRestantesLabel = formatDiasRestantes(vencimiento.dias_restantes)
  const diasStockLabel = formatDiasStock(vencimiento.cantidad, producto.venta_media_diaria)

  return (
    <div
      className={`flex items-start gap-3 rounded-xl bg-zinc-900 border border-zinc-800 p-4 transition-colors ${onClick ? 'cursor-pointer hover:bg-gray-800 active:bg-gray-700' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      {/* Semaforo */}
      <div className="flex-shrink-0 mt-1">
        {cfg.pulsante ? (
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dotCls} opacity-75`}
            />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${cfg.dotCls}`} />
          </span>
        ) : (
          <span className={`inline-flex rounded-full h-3 w-3 ${cfg.dotCls}`} />
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">

        {/* Linea 1: titulo + badge */}
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-sm font-bold text-white leading-tight truncate"
            title={titulo}
          >
            {titulo}
          </p>
          <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badgeCls}`}>
            {cfg.label}
          </span>
        </div>

        {/* Linea 2: Cod. Art y EAN lado a lado */}
        <div className="mt-1 flex justify-between gap-2 text-xs text-gray-400">
          <span>
            Cod. Art: <span className="font-mono text-zinc-300">{producto.cod_art || '—'}</span>
          </span>
          <span>
            EAN: <span className="text-zinc-300">{producto.codigo_barras ?? 'Sin mapear'}</span>
          </span>
        </div>

        {/* Linea 3: venta media y dias de stock lado a lado */}
        <div className="mt-0.5 flex justify-between gap-2 text-xs text-gray-400">
          <span>
            Venta media: <span className="text-zinc-300">{producto.venta_media_diaria} unid/día</span>
          </span>
          <span>
            Días de stock (lote): <span className="text-zinc-300">{diasStockLabel}</span>
          </span>
        </div>

        {/* Linea 4: dias restantes con color segun nivel */}
        <div className="mt-1">
          <span className={`text-xs font-semibold ${cfg.diasCls}`}>
            {diasRestantesLabel}
          </span>
        </div>

        {/* Linea 5: acciones sugeridas */}
        {vencimiento.acciones_sugeridas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vencimiento.acciones_sugeridas.map((accion) => (
              <button
                key={accion}
                type="button"
                className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors active:scale-95"
              >
                {accion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
