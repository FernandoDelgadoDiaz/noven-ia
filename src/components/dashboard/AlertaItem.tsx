import { Package, ChevronRight } from 'lucide-react'
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
        'bg-white rounded-[24px] shadow-card overflow-hidden',
        'transition-all duration-150',
        onClick
          ? 'cursor-pointer hover:shadow-elevated hover:-translate-y-0.5 active:scale-[0.99] active:translate-y-0'
          : '',
      ].join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      <div className="p-4 md:p-5 flex items-start gap-4">

        {/* Left: product thumbnail placeholder */}
        <div className={`relative h-14 w-14 rounded-2xl ${cfg.statIconBg} flex items-center justify-center shrink-0`}>
          <Package className={`h-6 w-6 ${cfg.statIconColor}`} aria-hidden="true" />
          {cfg.dotPulse && (
            <span className="absolute -top-1 -right-1">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${cfg.dot}`} />
              </span>
            </span>
          )}
        </div>

        {/* Center: product info */}
        <div className="flex-1 min-w-0">
          <p
            className={[
              'font-bold text-base leading-snug line-clamp-2',
              isDecomiso ? 'text-red-900' : 'text-foreground',
            ].join(' ')}
            title={titulo}
          >
            {titulo}
          </p>

          <p className={`text-sm font-semibold mt-1 ${cfg.daysText}`}>{diasLabel}</p>

          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
            <span>{stockLabel}</span>
            {producto.venta_media_diaria > 0 && (
              <>
                <span className="text-border">·</span>
                <span>{producto.venta_media_diaria} u/día</span>
              </>
            )}
            {producto.cod_art && (
              <>
                <span className="text-border">·</span>
                <span className="font-mono text-foreground/50">{producto.cod_art}</span>
              </>
            )}
          </div>
        </div>

        {/* Right: badge + arrow */}
        <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
            {cfg.label.toUpperCase()}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" aria-hidden="true" />
        </div>
      </div>

      {/* Bottom: smart action chips */}
      {vencimiento.acciones_sugeridas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 md:px-5 pb-4">
          {vencimiento.acciones_sugeridas.map((accion) => (
            <span
              key={accion}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors ${cfg.actionChipCls}`}
            >
              {accion}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
