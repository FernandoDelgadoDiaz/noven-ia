interface RiesgoCardProps {
  titulo: string
  valor: number | string
  icono?: string
  IconoComponente?: React.ComponentType<{ className?: string }>
  color: 'green' | 'yellow' | 'red' | 'blue'
}

const colorMap: Record<RiesgoCardProps['color'], { border: string; bg: string; text: string; label: string }> = {
  green: {
    border: 'border-green-500/30',
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    label: 'text-green-300',
  },
  yellow: {
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    label: 'text-yellow-300',
  },
  red: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    label: 'text-red-300',
  },
  blue: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    label: 'text-blue-300',
  },
}

export default function RiesgoCard({ titulo, valor, icono, IconoComponente, color }: RiesgoCardProps) {
  const c = colorMap[color]

  return (
    <div
      className={`rounded-xl border ${c.border} ${c.bg} p-4 flex flex-col gap-2`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide leading-tight">
          {titulo}
        </span>
        {IconoComponente ? (
          <IconoComponente className={`h-5 w-5 ${c.text}`} aria-hidden="true" />
        ) : (
          <span className="text-xl leading-none" aria-hidden="true">
            {icono}
          </span>
        )}
      </div>
      <span className={`text-3xl font-bold ${c.text} leading-none`}>
        {valor}
      </span>
    </div>
  )
}
