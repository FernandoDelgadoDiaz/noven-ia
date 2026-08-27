import { Package } from 'lucide-react'

export interface ProductIdentityData {
  descripcion: string
  marca?: string | null
  gramaje?: string | null
  cod_art?: string | null
  codigo_barras?: string | null
  imagen_url?: string | null
  imagen_thumb_url?: string | null
}

interface ProductIdentityProps {
  producto: ProductIdentityData
  label?: string
  showImage?: boolean
  imageSize?: 'sm' | 'md' | 'lg'
  compact?: boolean
  className?: string
  imageUrl?: string | null
  children?: React.ReactNode
}

const IMAGE_SIZE = {
  sm: 'h-12 w-12 rounded-xl',
  md: 'h-16 w-16 rounded-2xl',
  lg: 'h-20 w-20 rounded-2xl',
}

function dato(valor: string | null | undefined): string {
  const limpio = valor?.trim()
  return limpio ? limpio : 'Sin dato'
}

export function ProductIdentityMeta({ producto, compact = false }: Pick<ProductIdentityProps, 'producto' | 'compact'>) {
  const base = compact ? 'text-[10px]' : 'text-xs'
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${base} text-muted-foreground`}>
      <span><span className="font-semibold text-foreground/70">Gramaje:</span> {dato(producto.gramaje)}</span>
      <span aria-hidden="true" className="text-border">·</span>
      <span><span className="font-semibold text-foreground/70">Interno:</span> <span className="font-mono">{dato(producto.cod_art)}</span></span>
      <span aria-hidden="true" className="text-border">·</span>
      <span><span className="font-semibold text-foreground/70">EAN:</span> <span className="font-mono">{dato(producto.codigo_barras)}</span></span>
    </div>
  )
}

export default function ProductIdentity({
  producto,
  label,
  showImage = true,
  imageSize = 'md',
  compact = false,
  className = '',
  imageUrl,
  children,
}: ProductIdentityProps) {
  const src = imageUrl ?? producto.imagen_thumb_url ?? producto.imagen_url ?? null

  return (
    <div className={`flex items-start gap-3 min-w-0 ${className}`}>
      {showImage && (
        <div className={`${IMAGE_SIZE[imageSize]} shrink-0 overflow-hidden bg-muted flex items-center justify-center`}>
          {src ? (
            <img src={src} alt={producto.descripcion} className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <Package className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        {label && <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-muted-foreground font-medium`}>{label}</p>}
        <p className={`${compact ? 'text-sm' : 'text-sm md:text-base'} font-bold text-foreground leading-snug ${label ? 'mt-0.5' : ''}`}>
          {producto.descripcion}
        </p>
        <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-muted-foreground mt-0.5`}>
          <span className="font-semibold text-foreground/70">Marca:</span> {dato(producto.marca)}
        </p>
        <div className="mt-1">
          <ProductIdentityMeta producto={producto} compact={compact} />
        </div>
        {children}
      </div>
    </div>
  )
}
