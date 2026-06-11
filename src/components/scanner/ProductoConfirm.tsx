import { useRef, useState } from 'react'
import type { Producto } from '@/types/index'
import { Package, BarChart2, Tag, Layers, Camera, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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

async function subirFotoProducto(file: File, codArt: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${codArt}.${ext}`
  const { error } = await supabase.storage
    .from('productos-imagenes')
    .upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage
    .from('productos-imagenes')
    .getPublicUrl(path)
  return data.publicUrl
}

export default function ProductoConfirm({ producto, onConfirm, onCancel }: ProductoConfirmProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(producto.imagen_url)
  const [subiendo, setSubiendo] = useState(false)
  const [fotoGuardada, setFotoGuardada] = useState(false)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const coberturaTexto =
    producto.venta_media_diaria > 0
      ? `${Math.round(producto.stock_actual / producto.venta_media_diaria)} días`
      : 'Sin rotación'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorFoto(null)
    setFotoGuardada(false)

    // Preview inmediato
    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)
    setSubiendo(true)

    try {
      const publicUrl = await subirFotoProducto(file, producto.cod_art)
      const { error: updateError } = await supabase
        .from('productos')
        .update({ imagen_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', producto.id)
      if (updateError) throw updateError
      setPreviewUrl(publicUrl)
      setFotoGuardada(true)
    } catch (err) {
      console.error('[ProductoConfirm] Error al subir foto:', err)
      setErrorFoto('No se pudo guardar la foto. Intentá de nuevo.')
      setPreviewUrl(producto.imagen_url)
    } finally {
      setSubiendo(false)
      // Limpiar input para permitir re-seleccion del mismo archivo
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Card del producto */}
      <div className="bg-white rounded-card shadow-card p-5">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Producto encontrado</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">En sistema</span>
          </div>

          {/* Foto + título */}
          <div className="flex items-start gap-3 mb-3">
            {/* Thumbnail o botón de foto */}
            <div className="shrink-0">
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt={producto.descripcion}
                    className="h-[120px] w-[120px] rounded-2xl object-cover border border-border"
                  />
                  {subiendo && (
                    <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
                      <span className="h-6 w-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                  {fotoGuardada && !subiendo && (
                    <div className="absolute bottom-1.5 right-1.5 bg-emerald-500 rounded-full p-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={subiendo}
                    className="absolute -bottom-2 -right-2 h-7 w-7 bg-brand hover:bg-brand-hover text-white rounded-full flex items-center justify-center shadow-brand transition-colors disabled:opacity-50"
                    aria-label="Cambiar foto"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={subiendo}
                  className="h-[120px] w-[120px] rounded-2xl border-2 border-dashed border-brand/40 bg-brand-light flex flex-col items-center justify-center gap-1.5 text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
                  aria-label="Agregar foto del producto"
                >
                  <Camera className="h-7 w-7" />
                  <span className="text-[11px] font-semibold text-center leading-tight px-1">Agregar foto</span>
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-foreground font-bold text-base leading-tight">{producto.descripcion}</h2>
              <p className="text-brand text-sm font-semibold font-mono mt-1">#{producto.cod_art}</p>
              {fotoGuardada && (
                <p className="text-emerald-600 text-xs font-semibold mt-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Foto guardada
                </p>
              )}
              {errorFoto && (
                <p className="text-red-500 text-xs mt-2">{errorFoto}</p>
              )}
              {subiendo && (
                <p className="text-muted-foreground text-xs mt-2">Subiendo foto...</p>
              )}
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            {...(previewUrl ? {} : { capture: 'environment' as const })}
            className="hidden"
            onChange={(e) => void handleFileChange(e)}
          />
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
