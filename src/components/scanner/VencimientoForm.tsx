import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcularRiesgo } from '@/lib/predictive'
import { RISK_VISUAL } from '@/lib/risk-config'
import ProductIdentity from '@/components/product/ProductIdentity'
import type { Producto, RiesgoNivel, Vencimiento } from '@/types/index'
import { AlertTriangle, CheckCircle, ShieldCheck, AlertCircle } from 'lucide-react'

export interface VencimientoExistente {
  id: string
  cantidad: number
  fecha_vencimiento: string
  lote: string | null
}

interface VencimientoFormProps {
  producto: Producto
  sucursalId: string
  onSuccess: () => void
  vencimientoExistente?: VencimientoExistente | null
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
  diasDonacion: number
  diasComerciales: number
  coberturaTexto: string
}

type ProductoConPolitica = Producto & { dias_donacion?: number | null }

function calcularPreview(
  cantidad: string,
  fechaVencimiento: string,
  producto: Producto,
  stockActual: string,
  diasDonacion: number | null,
): RiesgoPreview | null {
  if (!cantidad || !fechaVencimiento || diasDonacion == null) return null
  const cantNum = parseInt(cantidad, 10)
  if (isNaN(cantNum) || cantNum <= 0) return null
  const stockNum = parseInt(stockActual, 10)
  const stockParaPreview = !isNaN(stockNum) && stockNum >= 0 ? stockNum : producto.stock_actual
  const productoConStock: Producto = { ...producto, stock_actual: stockParaPreview }
  const vencimientoFake: Vencimiento = {
    id: '', producto_id: producto.id, sucursal_id: '', usuario_id: '',
    cantidad: cantNum, lote: null, fecha_vencimiento: fechaVencimiento,
    fecha_carga: new Date().toISOString(), activo: true, created_at: new Date().toISOString(),
    dias_donacion: diasDonacion,
  }
  const resultado = calcularRiesgo(vencimientoFake, productoConStock, new Date())
  const coberturaTexto = resultado.cobertura_dias === Infinity
    ? 'Sin rotación'
    : `${resultado.cobertura_dias.toFixed(1)} días necesarios`
  return {
    nivel: resultado.nivel_riesgo,
    diasRestantes: resultado.dias_restantes,
    diasDonacion: resultado.dias_donacion,
    diasComerciales: resultado.dias_comerciales_restantes,
    coberturaTexto,
  }
}

function getPreviewIcon(nivel: RiesgoNivel): React.ComponentType<{ className?: string }> {
  if (nivel === 'seguro') return ShieldCheck
  if (nivel === 'decomiso' || nivel === 'donacion') return AlertCircle
  return AlertTriangle
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const inputCls = 'w-full h-14 px-4 bg-surface-base border border-border rounded-lg text-foreground text-base font-medium placeholder:text-muted-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-150'

export default function VencimientoForm({ producto, sucursalId, onSuccess, vencimientoExistente }: VencimientoFormProps) {
  const esEdicion = Boolean(vencimientoExistente)
  const diasDonacion = (producto as ProductoConPolitica).dias_donacion ?? null
  const [form, setForm] = useState<FormData>({
    cantidad: vencimientoExistente ? String(vencimientoExistente.cantidad) : '',
    fechaVencimiento: vencimientoExistente ? vencimientoExistente.fecha_vencimiento.slice(0, 10) : '',
    lote: vencimientoExistente?.lote ?? '',
    stockActual: String(producto.stock_actual),
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = calcularPreview(form.cantidad, form.fechaVencimiento, producto, form.stockActual, diasDonacion)
  const riskViz = preview ? RISK_VISUAL[preview.nivel] : null
  const PreviewIcon = preview ? getPreviewIcon(preview.nivel) : null

  function handleChange(field: keyof FormData, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  function validar(): string | null {
    if (diasDonacion == null) return 'Este producto está fuera del circuito de vencimientos configurado.'
    const cantNum = parseInt(form.cantidad, 10)
    if (!form.cantidad || isNaN(cantNum) || cantNum <= 0) return 'Ingresá una cantidad válida (mayor a 0).'
    if (!form.fechaVencimiento) return 'Seleccioná la fecha de vencimiento.'
    const stockNum = parseInt(form.stockActual, 10)
    if (form.stockActual !== '' && (isNaN(stockNum) || stockNum < 0)) return 'El stock debe ser un número mayor o igual a 0.'
    return null
  }

  async function handleGuardar(): Promise<void> {
    const validationError = validar()
    if (validationError) { setError(validationError); return }

    setGuardando(true)
    setError(null)

    const cantidadNum = parseInt(form.cantidad, 10)
    const stockNum = form.stockActual === '' ? null : parseInt(form.stockActual, 10)
    const lote = form.lote.trim() || null

    const { error: saveError } = await supabase.rpc('guardar_vencimiento_y_stock_scanner_v1', {
      p_producto_id: producto.id,
      p_sucursal_id: sucursalId,
      p_cantidad: cantidadNum,
      p_fecha_vencimiento: form.fechaVencimiento,
      p_lote: lote,
      p_stock_actual: stockNum,
      p_vencimiento_id: vencimientoExistente?.id ?? null,
    })

    if (saveError) {
      setGuardando(false)
      if (saveError.code === '23505') {
        setError('Este producto ya tiene un vencimiento activo. Volvé a escanearlo para actualizarlo.')
      } else {
        setError(`No se pudo guardar el control: ${saveError.message}`)
      }
      return
    }

    setGuardando(false)
    onSuccess()
  }

  if (diasDonacion == null) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-card shadow-card px-4 py-3.5">
          <ProductIdentity producto={producto} label="Producto encontrado" imageSize="sm" compact />
        </div>
        <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">Fuera del circuito de vencimientos</p>
            <p className="text-sm text-amber-800 mt-1">Este sector no tiene una política de vencimiento/donación configurada en Noven. No corresponde crear un control.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-card shadow-card px-4 py-3.5">
        <ProductIdentity
          producto={producto}
          label={esEdicion ? 'Actualizando vencimiento de' : 'Cargando vencimiento para'}
          imageSize="sm"
          compact
        />
      </div>

      <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vf-stock" className="text-xs font-semibold text-foreground uppercase tracking-wide">Stock total Glaciar</label>
          <input id="vf-stock" type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={form.stockActual} onChange={(e) => handleChange('stockActual', e.target.value)} placeholder="Ej: 48" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vf-cantidad" className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Cantidad comprometida <span className="text-red-400 font-normal normal-case">*</span>
          </label>
          <input id="vf-cantidad" type="number" inputMode="numeric" pattern="[0-9]*" min="1" value={form.cantidad} onChange={(e) => handleChange('cantidad', e.target.value)} placeholder="Ej: 24" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vf-fecha" className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Fecha de vencimiento <span className="text-red-400 font-normal normal-case">*</span>
          </label>
          <input id="vf-fecha" type="date" min={todayIso()} value={form.fechaVencimiento} onChange={(e) => handleChange('fechaVencimiento', e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vf-lote" className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Lote <span className="text-muted-foreground font-normal normal-case text-xs">(opcional)</span>
          </label>
          <input id="vf-lote" type="text" value={form.lote} onChange={(e) => handleChange('lote', e.target.value)} placeholder="Ej: L2024-001" className="w-full h-12 px-4 bg-surface-base border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-150 text-sm" />
        </div>
      </div>

      {preview && riskViz && PreviewIcon && (
        <div className={`rounded-card border p-4 flex items-start gap-3 ${riskViz.rowBg} ${riskViz.badge.split(' ').find(c => c.startsWith('border')) ?? 'border-border'} animate-fade-in`}>
          <PreviewIcon className={`h-5 w-5 mt-0.5 shrink-0 ${riskViz.daysText}`} />
          <div>
            <p className={`font-bold text-sm ${riskViz.daysText}`}>{riskViz.label}</p>
            <p className="text-muted-foreground text-sm mt-0.5">
              {preview.diasRestantes >= 0
                ? `Vence en ${preview.diasRestantes} días`
                : `Venció hace ${Math.abs(preview.diasRestantes)} días`}
              {' — '}
              {preview.coberturaTexto}
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              {preview.diasComerciales} días comerciales antes del retiro para donación ({preview.diasDonacion} días).
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 animate-fade-in">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleGuardar()}
        disabled={guardando}
        className="w-full min-h-[56px] bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2"
      >
        {guardando ? (
          <><span className="h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
        ) : (
          <><CheckCircle className="h-5 w-5" />{esEdicion ? 'Registrar nuevo control' : 'Guardar vencimiento'}</>
        )}
      </button>
    </div>
  )
}
