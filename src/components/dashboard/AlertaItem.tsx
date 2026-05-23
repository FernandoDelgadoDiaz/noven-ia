import { RISK_VISUAL } from '@/lib/risk-config'
import { calcularDiasStock } from '@/lib/riesgo'
import type { VencimientoConRiesgo } from '@/types/index'

interface AlertaItemProps {
  vencimiento: VencimientoConRiesgo
  onClick?: () => void
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
  return `${calcularDiasStock(cantidadLote, ventaMediaDiaria)} días de stock`
}

export default function AlertaItem({ vencimiento, onClick }: AlertaItemProps) {
  const cfg = RISK_VISUAL[vencimiento.nivel_riesgo]
  const { producto } = vencimiento

  const titulo = formatTitulo(producto.descripcion, producto.gramaje, producto.marca)
  const diasLabel = formatDiasRestantes(vencimiento.dias_restantes)
  const stockLabel = formatDiasStock(vencimiento.cantidad, producto.venta_media_diaria)
  const isDecomiso = vencimiento.nivel_riesgo === 'decomiso'

  return (
    <div
      className={[
        'flex items-stretch rounded-card shadow-card overflow-hidden',
        'transition-all duration-150',
        onClick ? 'cursor-pointer hover:shadow-elevated active:scale-[0.99]' : '',
        cfg.rowBg,
      ].join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      {/* Left accent bar — visual urgency signal */}
      <div className={`w-1 shrink-0 ${cfg.accentBar}`} />

      {/* Content */}
      <div className="flex-1 px-4 py-3.5 min-w-0">
        {/* Row 1: title + badge */}
        <div className="flex items-start justify-between gap-2">
          <p
            className={[
              'text-sm leading-snug line-clamp-2 flex-1 min-w-0',
              isDecomiso ? 'font-bold text-red-900' : 'font-semibold text-foreground',
            ].join(' ')}
            title={titulo}
          >
            {titulo}
          </p>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
            {cfg.label.toUpperCase()}
          </span>
        </div>

        {/* Row 2: días restantes + días de stock */}
        <div className="flex items-center gap-3 mt-2">
          {/* Dot indicator */}
          <div className="shrink-0">
            {cfg.dotPulse ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.dot}`} />
              </span>
            ) : (
              <span className={`inline-flex rounded-full h-2.5 w-2.5 ${cfg.dot}`} />
            )}
          </div>
          <span className={`text-sm font-semibold ${cfg.daysText}`}>{diasLabel}</span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-muted-foreground text-xs">{stockLabel}</span>
        </div>

        {/* Row 3: metadata */}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span>{vencimiento.cantidad} unids</span>
          {producto.venta_media_diaria > 0 && (
            <>
              <span>·</span>
              <span>{producto.venta_media_diaria} unid/día</span>
            </>
          )}
          {producto.cod_art && (
            <>
              <span>·</span>
              <span className="font-mono">{producto.cod_art}</span>
            </>
          )}
        </div>

        {/* Row 4: acciones sugeridas */}
        {vencimiento.acciones_sugeridas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {vencimiento.acciones_sugeridas.map((accion) => (
              <span
                key={accion}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white/80 border border-border text-foreground/70 font-medium"
              >
                {accion}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
