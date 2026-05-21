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
    <div className="flex items-center gap-3 py-3 border-b border-gray-700 last:border-0">
      <Icon className="h-4 w-4 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-white font-medium truncate">{value}</p>
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
      <div className="bg-gray-800 rounded-2xl p-4">
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-0.5">Producto encontrado</p>
          <h2 className="text-white font-bold text-lg leading-tight">{producto.descripcion}</h2>
          <p className="text-green-400 text-sm font-mono mt-0.5">#{producto.cod_art}</p>
        </div>

        <div className="divide-y divide-gray-700">
          <InfoRow
            label="Marca"
            value={producto.marca ?? '—'}
            Icon={Tag}
          />
          <InfoRow
            label="Categoría"
            value={producto.categoria ?? '—'}
            Icon={Layers}
          />
          <InfoRow
            label="Stock actual"
            value={`${producto.stock_actual} unidades`}
            Icon={Package}
          />
          <InfoRow
            label="Cobertura estimada"
            value={coberturaTexto}
            Icon={BarChart2}
          />
        </div>
      </div>

      {/* Acciones */}
      <button
        type="button"
        onClick={onConfirm}
        className="w-full min-h-14 bg-green-500 hover:bg-green-400 active:bg-green-600 text-white font-bold text-base rounded-2xl transition-colors"
      >
        Es este producto
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="w-full min-h-14 bg-gray-800 hover:bg-gray-700 active:bg-gray-900 text-white font-medium text-base rounded-2xl transition-colors"
      >
        Escanear otro
      </button>
    </div>
  )
}
