import { useEffect, useState } from 'react'
import { X, HandHeart, Trash2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { getTrimestreActual } from '@/hooks/useAccionesOperativas'
import { useSucursalActual } from '@/hooks/useSucursalActual'
import type { VencimientoConRiesgo } from '@/types/index'

type TipoAccion = 'donacion' | 'decomiso'

interface AccionOperativaModalProps {
  vencimiento: VencimientoConRiesgo
  tipo: TipoAccion
  onClose: () => void
  onSuccess: () => void
}

function formatTituloProducto(descripcion: string, gramaje: string | null): string {
  if (gramaje) return `${descripcion} ${gramaje}`
  return descripcion
}

export default function AccionOperativaModal({
  vencimiento,
  tipo,
  onClose,
  onSuccess,
}: AccionOperativaModalProps) {
  const { user } = useAuth()
  const { sucursalId } = useSucursalActual()
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [loading, onClose])

  const esDonacion = tipo === 'donacion'
  const titulo = esDonacion ? 'Confirmar donación' : 'Confirmar decomiso'
  const nombreProducto = formatTituloProducto(
    vencimiento.producto.descripcion,
    vencimiento.producto.gramaje,
  )

  const mensaje = esDonacion
    ? `Estás por retirar ${vencimiento.cantidad} unidad${vencimiento.cantidad !== 1 ? 'es' : ''} de ${nombreProducto} para donación. Esta acción no se puede deshacer.`
    : `Estás por registrar el decomiso de ${vencimiento.cantidad} unidad${vencimiento.cantidad !== 1 ? 'es' : ''} de ${nombreProducto} vencidas.`

  const placeholderObs = esDonacion
    ? 'Ej: Donado a comedor municipal'
    : 'Ej: Producto encontrado en góndola vencido'

  const btnColor = esDonacion
    ? 'bg-orange-600 hover:bg-orange-500 focus-visible:ring-orange-500'
    : 'bg-red-600 hover:bg-red-500 focus-visible:ring-red-500'

  const iconBg = esDonacion ? 'bg-orange-100' : 'bg-red-100'
  const iconColor = esDonacion ? 'text-orange-600' : 'text-red-600'

  async function handleConfirmar(): Promise<void> {
    if (!user) {
      setError('No hay sesión activa. Recargá la página.')
      return
    }

    setLoading(true)
    setError(null)

    const { trimestre, anio } = getTrimestreActual()

    // 1. INSERT en acciones_operativas
    const { error: insertError } = await supabase.from('acciones_operativas').insert({
      tipo,
      cantidad: vencimiento.cantidad,
      producto_id: vencimiento.producto_id,
      vencimiento_id: vencimiento.id,
      sucursal_id: sucursalId,
      usuario_id: user.id,
      trimestre,
      anio,
      observaciones: observaciones.trim() || null,
    })

    if (insertError) {
      setError(`No se pudo registrar la acción: ${insertError.message}`)
      setLoading(false)
      return
    }

    // 2. Soft delete del vencimiento
    const { error: updateError } = await supabase
      .from('vencimientos')
      .update({ activo: false })
      .eq('id', vencimiento.id)

    if (updateError) {
      setError(`Acción registrada pero no se pudo cerrar el vencimiento: ${updateError.message}`)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
    onClose()
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4 animate-fade-in"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
              {esDonacion
                ? <HandHeart className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
                : <Trash2 className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
              }
            </div>
            <h2 id="modal-titulo" className="text-base font-bold text-foreground">
              {titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors disabled:opacity-40"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">

          {/* Producto info */}
          <div className="rounded-2xl bg-muted/50 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Producto
            </p>
            <p className="font-bold text-foreground text-sm leading-snug">{nombreProducto}</p>
            {vencimiento.producto.marca && (
              <p className="text-xs text-muted-foreground">{vencimiento.producto.marca}</p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${esDonacion ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                {vencimiento.cantidad} unidad{vencimiento.cantidad !== 1 ? 'es' : ''}
              </span>
            </div>
          </div>

          {/* Mensaje de advertencia */}
          <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-amber-800 leading-snug">{mensaje}</p>
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <label htmlFor="obs-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Observaciones <span className="font-normal normal-case">(opcional)</span>
            </label>
            <textarea
              id="obs-input"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder={placeholderObs}
              disabled={loading}
              rows={2}
              maxLength={300}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand resize-none disabled:opacity-50 transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-6 pt-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-11 rounded-xl border border-border bg-white text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-40 active:scale-[0.97]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleConfirmar()}
            disabled={loading}
            className={`flex-1 h-11 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 ${btnColor}`}
          >
            {loading ? 'Registrando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
