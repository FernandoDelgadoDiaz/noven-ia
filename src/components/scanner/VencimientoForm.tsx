import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcularRiesgo } from '@/lib/predictive'
import type { Producto, RiesgoNivel, Vencimiento } from '@/types/index'
import { AlertTriangle, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react'

interface VencimientoFormProps {
  producto: Producto
  sucursalId: string
  usuarioId: string
  onSuccess: () => void
}

interface FormData {
  cantidad: string
  fechaVencimiento: string
  lote: string
  stockActual: string
}

interface RiesgoPreview {
  nivel: RiesgoNivel
  diasRestantes: number
  coberturaTexto: string
}

function calcularPreview(
  cantidad: string,
  fechaVencimiento: string,
  producto: Producto,
  stockActual: string,
): RiesgoPreview | null {
  if (!cantidad || !fechaVencimiento) return null
  const cantNum = parseInt(cantidad, 10)
  if (isNaN(cantNum) || cantNum <= 0) return null

  const stockNum = parseInt(stockActual, 10)
  const stockParaPreview = !isNaN(stockNum) && stockNum >= 0 ? stockNum : producto.stock_actual

  const productoConStock: Producto = { ...producto, stock_actual: stockParaPreview }

  const vencimientoFake: Vencimiento = {
    id: '',
    producto_id: producto.id,
    sucursal_id: '',
    usuario_id: '',
    cantidad: cantNum,
    lote: null,
    fecha_vencimiento: fechaVencimiento,
    fecha_carga: new Date().toISOString(),
    activo: true,
    created_at: new Date().toISOString(),
  }

  const resultado = calcularRiesgo(vencimientoFake, productoConStock, new Date())

  const coberturaTexto =
    resultado.cobertura_dias === Infinity
      ? 'Sin rotación'
      : `${Math.round(resultado.cobertura_dias)} días de cobertura`

  return {
    nivel: resultado.nivel_riesgo,
    diasRestantes: resultado.dias_restantes,
    coberturaTexto,
  }
}

interface NivelConfig {
  bg: string
  border: string
  text: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

function getNivelConfig(nivel: RiesgoNivel): NivelConfig {
  switch (nivel) {
    case 'critico':
      return {
        bg: 'bg-red-900/40',
        border: 'border-red-700',
        text: 'text-red-400',
        label: 'Riesgo critico',
        Icon: AlertCircle,
      }
    case 'alto':
      return {
        bg: 'bg-orange-900/40',
        border: 'border-orange-700',
        text: 'text-orange-400',
        label: 'Riesgo alto',
        Icon: AlertTriangle,
      }
    case 'moderado':
      return {
        bg: 'bg-yellow-900/40',
        border: 'border-yellow-700',
        text: 'text-yellow-400',
        label: 'Riesgo moderado',
        Icon: AlertTriangle,
      }
    case 'seguro':
      return {
        bg: 'bg-green-900/40',
        border: 'border-green-700',
        text: 'text-green-400',
        label: 'Sin riesgo',
        Icon: ShieldCheck,
      }
  }
}

// Devuelve la fecha mínima aceptable: hoy en formato YYYY-MM-DD
function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function VencimientoForm({
  producto,
  sucursalId,
  usuarioId,
  onSuccess,
}: VencimientoFormProps) {
  const [form, setForm] = useState<FormData>({
    cantidad: '',
    fechaVencimiento: '',
    lote: '',
    stockActual: String(producto.stock_actual),
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = calcularPreview(form.cantidad, form.fechaVencimiento, producto, form.stockActual)
  const nivelConfig = preview ? getNivelConfig(preview.nivel) : null

  function handleChange(field: keyof FormData, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  function validar(): string | null {
    const cantNum = parseInt(form.cantidad, 10)
    if (!form.cantidad || isNaN(cantNum) || cantNum <= 0) {
      return 'Ingresá una cantidad válida (mayor a 0).'
    }
    if (!form.fechaVencimiento) {
      return 'Seleccioná la fecha de vencimiento.'
    }
    const stockNum = parseInt(form.stockActual, 10)
    if (form.stockActual !== '' && (isNaN(stockNum) || stockNum < 0)) {
      return 'El stock actual debe ser un número mayor o igual a 0.'
    }
    return null
  }

  async function handleGuardar(): Promise<void> {
    const validationError = validar()
    if (validationError) {
      setError(validationError)
      return
    }

    setGuardando(true)
    setError(null)

    const { error: supabaseError } = await supabase.from('vencimientos').insert({
      producto_id: producto.id,
      sucursal_id: sucursalId,
      usuario_id: usuarioId,
      cantidad: parseInt(form.cantidad, 10),
      lote: form.lote.trim() || null,
      fecha_vencimiento: form.fechaVencimiento,
      fecha_carga: todayIso(),
      activo: true,
    })

    if (supabaseError) {
      setGuardando(false)
      setError(`Error al guardar: ${supabaseError.message}`)
      return
    }

    // Si el stock cambió respecto al valor original, actualizar en productos
    const nuevoStock = parseInt(form.stockActual, 10)
    const stockOriginal = producto.stock_actual
    if (!isNaN(nuevoStock) && nuevoStock !== stockOriginal) {
      const { error: stockError } = await supabase
        .from('productos')
        .update({ stock_actual: nuevoStock, updated_at: new Date().toISOString() })
        .eq('id', producto.id)

      if (stockError) {
        setGuardando(false)
        setError(`Vencimiento guardado, pero no se pudo actualizar el stock: ${stockError.message}`)
        return
      }
    }

    setGuardando(false)
    onSuccess()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Nombre del producto */}
      <div className="bg-gray-800 rounded-2xl px-4 py-3">
        <p className="text-xs text-gray-400 mb-0.5">Cargando vencimiento para</p>
        <p className="text-white font-bold text-base leading-tight">{producto.descripcion}</p>
        {producto.marca && (
          <p className="text-gray-400 text-sm">{producto.marca}</p>
        )}
      </div>

      {/* Formulario */}
      <div className="bg-gray-800 rounded-2xl p-4 flex flex-col gap-4">
        {/* Stock actual */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="stockActual"
            className="text-sm font-medium text-gray-300"
          >
            Stock actual
          </label>
          <input
            id="stockActual"
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min="0"
            value={form.stockActual}
            onChange={(e) => handleChange('stockActual', e.target.value)}
            placeholder="Ej: 48"
            className="w-full h-14 px-4 bg-gray-700 border border-gray-600 rounded-xl text-white text-lg font-medium placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
          />
        </div>

        {/* Cantidad */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="cantidad"
            className="text-sm font-medium text-gray-300"
          >
            Cantidad <span className="text-red-400">*</span>
          </label>
          <input
            id="cantidad"
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min="1"
            value={form.cantidad}
            onChange={(e) => handleChange('cantidad', e.target.value)}
            placeholder="Ej: 24"
            className="w-full h-14 px-4 bg-gray-700 border border-gray-600 rounded-xl text-white text-lg font-medium placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
          />
        </div>

        {/* Fecha de vencimiento */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="fechaVencimiento"
            className="text-sm font-medium text-gray-300"
          >
            Fecha de vencimiento <span className="text-red-400">*</span>
          </label>
          <input
            id="fechaVencimiento"
            type="date"
            min={todayIso()}
            value={form.fechaVencimiento}
            onChange={(e) => handleChange('fechaVencimiento', e.target.value)}
            className="w-full h-14 px-4 bg-gray-700 border border-gray-600 rounded-xl text-white text-base focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors [color-scheme:dark]"
          />
        </div>

        {/* Lote (opcional) */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="lote"
            className="text-sm font-medium text-gray-300"
          >
            Lote <span className="text-gray-500 font-normal">(opcional)</span>
          </label>
          <input
            id="lote"
            type="text"
            value={form.lote}
            onChange={(e) => handleChange('lote', e.target.value)}
            placeholder="Ej: L2024-001"
            className="w-full h-12 px-4 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
          />
        </div>
      </div>

      {/* Preview de riesgo en tiempo real */}
      {preview && nivelConfig && (
        <div
          className={`rounded-2xl border p-4 flex items-start gap-3 ${nivelConfig.bg} ${nivelConfig.border}`}
        >
          <nivelConfig.Icon className={`h-5 w-5 mt-0.5 shrink-0 ${nivelConfig.text}`} />
          <div>
            <p className={`font-semibold text-sm ${nivelConfig.text}`}>{nivelConfig.label}</p>
            <p className="text-gray-300 text-sm mt-0.5">
              {preview.diasRestantes >= 0
                ? `Vence en ${preview.diasRestantes} días`
                : `Venció hace ${Math.abs(preview.diasRestantes)} días`}
              {' — '}
              {preview.coberturaTexto}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/40 border border-red-700 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Botón guardar */}
      <button
        type="button"
        onClick={() => void handleGuardar()}
        disabled={guardando}
        className="w-full min-h-14 bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-2xl transition-colors flex items-center justify-center gap-2"
      >
        {guardando ? (
          <>
            <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <CheckCircle className="h-5 w-5" />
            Guardar vencimiento
          </>
        )}
      </button>
    </div>
  )
}
