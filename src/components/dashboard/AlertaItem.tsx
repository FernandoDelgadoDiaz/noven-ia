import { useState } from 'react'
import { Package, ChevronRight, HandHeart, Trash2, X } from 'lucide-react'
import { RISK_VISUAL } from '@/lib/risk-config'
import { calcularDiasStock } from '@/lib/riesgo'
import type { VencimientoConRiesgo } from '@/types/index'

interface AlertaItemProps {
  vencimiento: VencimientoConRiesgo
  onClick?: () => void
  onRegistrarAccion?: (vencimiento: VencimientoConRiesgo, tipo: 'donacion' | 'decomiso') => void
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
  return `${calcularDiasStock(cantidadLote, ventaMediaDiaria)} días stock`
}

export default function AlertaItem({ vencimiento, onClick, onRegistrarAccion }: AlertaItemProps) {
  const cfg = RISK_VISUAL[vencimiento.nivel_riesgo]
  const { producto } = vencimiento
  const [lightboxAbierto, setLightboxAbierto] = useState(false)

  const titulo = formatTitulo(producto.descripcion, producto.gramaje, producto.marca)
  const diasLabel = formatDiasRestantes(vencimiento.dias_restantes)
  const stockLabel = formatDiasStock(vencimiento.cantidad, producto.venta_media_diaria)
  const isDecomiso = vencimiento.nivel_riesgo === 'decomiso'
  const isDonacion = vencimiento.nivel_riesgo === 'donacion'
  const showPulse = cfg.dotPulse
  const showAccionBtn = (isDecomiso || isDonacion) && Boolean(onRegistrarAccion)

  function handleAccionClick(e: React.MouseEvent): void {
    e.stopPropagation()
    if (!onRegistrarAccion) return
    const tipo = isDecomiso ? 'decomiso' : 'donacion'
    onRegistrarAccion(vencimiento, tipo)
  }

  return (
    <>
    {/* Lightbox */}
    {lightboxAbierto && producto.imagen_url && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        onClick={() => setLightboxAbierto(false)}
        role="dialog"
        aria-modal="true"
        aria-label={`Foto de ${producto.descripcion}`}
      >
        <button
          type="button"
          onClick={() => setLightboxAbierto(false)}
          className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          aria-label="Cerrar foto"
        >
          <X className="h-6 w-6" />
        </button>
        <img
          src={producto.imagen_url}
          alt={producto.descripcion}
          className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    <div
      className={[
        'bg-white rounded-[24px] shadow-card overflow-hidden',
        `border-l-4 ${cfg.borderLeft}`,
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

        {/* Left: product thumbnail 60x60 */}
        <div className="relative shrink-0">
          {producto.imagen_url ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxAbierto(true) }}
              className="block h-[60px] w-[60px] rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label={`Ver foto de ${producto.descripcion}`}
            >
              <img
                src={producto.imagen_url}
                alt={producto.descripcion}
                className="h-full w-full object-cover"
              />
            </button>
          ) : (
            <div className={`h-[60px] w-[60px] rounded-2xl ${cfg.statIconBg} flex items-center justify-center`}>
              <Package className={`h-6 w-6 ${cfg.statIconColor}`} aria-hidden="true" />
            </div>
          )}
          {showPulse && (
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
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${cfg.badgeSolid}`}>
            {cfg.label.toUpperCase()}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" aria-hidden="true" />
        </div>
      </div>

      {/* Bottom: smart action chips */}
      {vencimiento.acciones_sugeridas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 md:px-5 pb-3">
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

      {/* Accion operativa: donacion o decomiso */}
      {showAccionBtn && (
        <div className="px-4 md:px-5 pb-4 pt-0">
          <button
            type="button"
            onClick={handleAccionClick}
            className={[
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border-2 transition-all duration-150 active:scale-[0.97]',
              isDonacion
                ? 'border-orange-500 text-orange-600 hover:bg-orange-50'
                : 'border-red-600 text-red-600 hover:bg-red-50',
            ].join(' ')}
          >
            {isDonacion
              ? <><HandHeart className="h-4 w-4" aria-hidden="true" /> Registrar donación</>
              : <><Trash2 className="h-4 w-4" aria-hidden="true" /> Registrar decomiso</>
            }
          </button>
        </div>
      )}
    </div>
    </>
  )
}
