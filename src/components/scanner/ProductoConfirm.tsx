import type { Producto } from '@/types/index'
import { Package, BarChart2, Tag, Layers } from 'lucide-react'

interface ProductoConfirmProps {
  producto: Producto
  onConfirm: () => void
  onCancel: () => void
}

interface InfoRowProps {
  label: string
  value: string
  Icon: React.ComponentType<{ className?: string }>
}

function InfoRow({ label, value, Icon }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="p-1.5 bg-muted rounded-lg shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground font-semibold truncate">{value}</p>
      </div>
    </div>
  )
}

export default function ProductoConfirm({ producto, onConfirm, onCancel }: ProductoConfirmProps) {
  const coberturaTexto =
    producto.venta_media_diaria > 0
      ? `${Math.round(producto.stock_actual / producto.venta_media_diaria)} días`
      : 'Sin rotación'

  return (
    <div className="flex flex-col gap-4">
      {/* Card del producto */}
      <div className="bg-white rounded-card shadow-card p-5">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Producto encontrado</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">✓ En sistema</span>
          </div>
          <h2 className="text-foreground font-bold text-lg leading-tight">{producto.descripcion}</h2>
          <p className="text-brand text-sm font-semibold font-mono mt-1">#{producto.cod_art}</p>
        </div>

        <div>
          <InfoRow label="Marca" value={producto.marca ?? '—'} Icon={Tag} />
          <InfoRow label="Categoría" value={producto.categoria ?? '—'} Icon={Layers} />
          <InfoRow label="Stock actual" value={`${producto.stock_actual} unidades`} Icon={Package} />
          <InfoRow label="Cobertura estimada" value={coberturaTexto} Icon={BarChart2} />
        </div>
      </div>

      <button
        type="button"
        onClick={onConfirm}
        className="w-full min-h-[56px] bg-brand hover:bg-brand-hover text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98]"
      >
        Sí, es este producto
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="w-full min-h-[56px] bg-muted hover:bg-muted/70 text-foreground font-medium text-base rounded-card transition-colors"
      >
        Escanear otro
      </button>
    </div>
  )
}
