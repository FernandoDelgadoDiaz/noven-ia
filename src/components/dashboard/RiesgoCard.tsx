import { RISK_VISUAL } from '@/lib/risk-config'
import type { RiesgoNivel } from '@/types/index'
import { Package } from 'lucide-react'

interface RiesgoCardProps {
  titulo: string
  valor: number | string
  nivel: RiesgoNivel
  icono?: string
  IconoComponente?: React.ComponentType<{ className?: string }>
  onClick?: () => void
  subtexto?: string
  subtextoColor?: string
}

export default function RiesgoCard({
  titulo,
  valor,
  nivel,
  icono,
  IconoComponente,
  onClick,
  subtexto,
  subtextoColor,
}: RiesgoCardProps) {
  const v = RISK_VISUAL[nivel]
  const isInteractive = Boolean(onClick)

  return (
    <div
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? (e) => { if (e.key === 'Enter') onClick?.() } : undefined}
      className={[
        'bg-white rounded-[20px] shadow-card p-3.5 flex flex-col',
        isInteractive
          ? 'cursor-pointer hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.97] active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'
          : '',
      ].join(' ')}
    >
      {/* Icon circular */}
      <div className={`h-9 w-9 rounded-full ${v.statIconBg} flex items-center justify-center shrink-0 mb-2.5`}>
        {IconoComponente ? (
          <IconoComponente className={`h-4 w-4 ${v.statIconColor}`} />
        ) : icono ? (
          <span className="text-base leading-none" aria-hidden="true">{icono}</span>
        ) : (
          <Package className={`h-4 w-4 ${v.statIconColor}`} />
        )}
      </div>

      {/* Dominant number */}
      <p className={`text-[2rem] font-black tracking-tight leading-none tabular-nums ${v.statValueText}`}>
        {valor}
      </p>

      {/* Label */}
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mt-1.5 leading-tight">
        {titulo}
      </p>

      {subtexto && (
        <p className={`text-[10px] font-medium mt-0.5 ${subtextoColor ?? 'text-muted-foreground'}`}>
          {subtexto}
        </p>
      )}
    </div>
  )
}
