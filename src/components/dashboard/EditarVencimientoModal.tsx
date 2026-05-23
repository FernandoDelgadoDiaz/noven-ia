import { useState, useEffect } from 'react'
import { X, Trash2, Save, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BADGE_CONFIG, calcularDiasRestantes, calcularNivelRiesgo } from '@/lib/riesgo'
import type { NivelRiesgo } from '@/lib/riesgo'

interface VencimientoParaEditar {
  id: string
  producto_id: string
  fecha_vencimiento: string
  cantidad: number
  nivel_riesgo: string
  productos: {
    descripcion: string
    cod_art: string | null
    codigo_barras: string | null
    gramaje: string | null
    stock_actual: number
    venta_media_diaria: number
  }
}

interface Props {
  vencimiento: VencimientoParaEditar
  onClose: () => void
  onGuardado: () => void
}


export default function EditarVencimientoModal({ vencimiento, onClose, onGuardado }: Props) {
  const [stockActual, setStockActual] = useState(vencimiento.productos.stock_actual)
  const [fechaVencimiento, setFechaVencimiento] = useState(vencimiento.fecha_vencimiento)
  const [cantidad, setCantidad] = useState(vencimiento.cantidad)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nivelCalculado, setNivelCalculado] = useState<NivelRiesgo>(() =>
    calcularNivelRiesgo(
      calcularDiasRestantes(vencimiento.fecha_vencimiento),
      vencimiento.productos.stock_actual,
      vencimiento.productos.venta_media_diaria,
    ),
  )

  useEffect(() => {
    setNivelCalculado(
      calcularNivelRiesgo(
        calcularDiasRestantes(fechaVencimiento),
        stockActual,
        vencimiento.productos.venta_media_diaria,
      ),
    )
  }, [fechaVencimiento, stockActual, vencimiento.productos.venta_media_diaria])

  async function handleGuardar(): Promise<void> {
    setError(null)
    setGuardando(true)

    const { error: errVenc } = await supabase
      .from('vencimientos')
      .update({
        fecha_vencimiento: fechaVencimiento,
        cantidad,
      })
      .eq('id', vencimiento.id)

    if (errVenc) {
      setError(`Error al guardar vencimiento: ${errVenc.message}`)
      setGuardando(false)
      return
    }

    if (stockActual !== vencimiento.productos.stock_actual) {
      const { error: errProd } = await supabase
        .from('productos')
        .update({
          stock_actual: stockActual,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vencimiento.producto_id)

      if (errProd) {
        setError(`Error al actualizar stock: ${errProd.message}`)
        setGuardando(false)
        return
      }
    }

    setGuardando(false)
    onGuardado()
    onClose()
  }

  async function handleEliminar(): Promise<void> {
    setError(null)
    setEliminando(true)

    const { error: errDel } = await supabase
      .from('vencimientos')
      .update({ activo: false })
      .eq('id', vencimiento.id)

    if (errDel) {
      setError(`Error al eliminar: ${errDel.message}`)
      setEliminando(false)
      return
    }

    setEliminando(false)
    onGuardado()
    onClose()
  }

  const badge = BADGE_CONFIG[nivelCalculado]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Editar vencimiento"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-800">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-0.5">Editando registro</p>
            <h2 className="text-white font-bold text-base leading-tight line-clamp-2">
              {vencimiento.productos.descripcion}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              <span className="text-gray-400">Cod. Art: {vencimiento.productos.cod_art ?? '—'}</span>
              {'  '}
              <span className="text-gray-400">EAN: {vencimiento.productos.codigo_barras ?? 'Sin mapear'}</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="text-gray-400">Gramaje: {vencimiento.productos.gramaje ?? '—'}</span>
              {'  '}
              <span className="text-gray-400">Venta media: {vencimiento.productos.venta_media_diaria} unid/día</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Campos */}
        <div className="px-5 py-4 space-y-4">
          {/* Preview de riesgo */}
          <div className="flex items-center justify-between bg-gray-800/60 rounded-xl px-4 py-3">
            <span className="text-xs text-gray-400 font-medium">Riesgo calculado</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>
              {badge.label}
            </span>
          </div>

          {/* Stock actual */}
          <div className="space-y-1.5">
            <label htmlFor="stock-actual" className="block text-xs font-medium text-gray-400">
              Stock actual
            </label>
            <input
              id="stock-actual"
              type="number"
              min={0}
              value={stockActual}
              onChange={(e) => setStockActual(Number(e.target.value))}
              className="w-full h-11 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm"
            />
          </div>

          {/* Fecha de vencimiento */}
          <div className="space-y-1.5">
            <label htmlFor="fecha-vencimiento" className="block text-xs font-medium text-gray-400">
              Fecha de vencimiento
            </label>
            <input
              id="fecha-vencimiento"
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className="w-full h-11 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm"
            />
          </div>

          {/* Cantidad */}
          <div className="space-y-1.5">
            <label htmlFor="cantidad" className="block text-xs font-medium text-gray-400">
              Cantidad
            </label>
            <input
              id="cantidad"
              type="number"
              min={0}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className="w-full h-11 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 rounded-xl px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs">{error}</p>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="px-5 pb-5 space-y-2">
          <button
            type="button"
            onClick={() => void handleGuardar()}
            disabled={guardando || eliminando}
            className="w-full h-11 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors"
          >
            {guardando ? (
              <>
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar cambios
              </>
            )}
          </button>

          {!confirmarEliminar ? (
            <button
              type="button"
              onClick={() => setConfirmarEliminar(true)}
              disabled={guardando || eliminando}
              className="w-full h-11 flex items-center justify-center gap-2 bg-transparent hover:bg-red-950/40 border border-red-800/60 text-red-400 hover:text-red-300 font-medium text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar registro
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-center text-gray-400">
                Esta accion no se puede deshacer. Confirmas la eliminacion?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmarEliminar(false)}
                  disabled={eliminando}
                  className="flex-1 h-11 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-sm rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleEliminar()}
                  disabled={eliminando}
                  className="flex-1 h-11 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors"
                >
                  {eliminando ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    'Si, eliminar'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
