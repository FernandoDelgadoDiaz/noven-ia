import { useState, useRef, useEffect } from 'react'
import { ScanLine, Search, CheckCircle, Package, Barcode, ChevronLeft, ShieldAlert } from 'lucide-react'
import { useScanner } from '@/hooks/useScanner'
import { useAuth } from '@/hooks/useAuth'
import { useUsuarioFamilias } from '@/hooks/useUsuarioFamilias'
import { supabase } from '@/lib/supabase'
import ScannerModal from '@/components/scanner/ScannerModal'
import ProductoConfirm from '@/components/scanner/ProductoConfirm'
import VencimientoForm from '@/components/scanner/VencimientoForm'
import type { Producto, Familia } from '@/types/index'

const SUCURSAL_ID = '00000000-0000-0000-0000-000000000001'

type Paso = 'inicio' | 'confirmando' | 'capturar_ean' | 'formulario' | 'exito' | 'nuevo_producto' | 'familia_bloqueada'
type CategoriaProducto = 'CHOCOLATES' | 'CARAMELOS' | 'SNACKS' | 'CHICLES' | 'CEREALES' | 'OTRO'
const CATEGORIAS: CategoriaProducto[] = ['CHOCOLATES', 'CARAMELOS', 'SNACKS', 'CHICLES', 'CEREALES', 'OTRO']

const inputCls = 'w-full h-12 px-4 bg-surface-base border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-150 text-sm'

export default function Scanner() {
  const { scanBarcode, scanning, error: scanError, reset } = useScanner()
  const { user } = useAuth()
  const { esAdmin, familiaIds, loading: famLoading } = useUsuarioFamilias()

  const [paso, setPaso] = useState<Paso>('inicio')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalEanAbierto, setModalEanAbierto] = useState(false)
  const [codigoManual, setCodigoManual] = useState('')
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [productoEncontrado, setProductoEncontrado] = useState<Producto | null>(null)
  const [encontradoPorCodArt, setEncontradoPorCodArt] = useState(false)
  const [, setGuardadoExitoso] = useState(false)

  const [guardandoEan, setGuardandoEan] = useState(false)
  const [errorEan, setErrorEan] = useState<string | null>(null)

  const [nuevoProductoCodArt, setNuevoProductoCodArt] = useState('')
  const [nuevoProductoDesc, setNuevoProductoDesc] = useState('')
  const [nuevoProductoMarca, setNuevoProductoMarca] = useState('')
  const [nuevoProductoCategoria, setNuevoProductoCategoria] = useState<CategoriaProducto>('OTRO')
  const [nuevoProductoStock, setNuevoProductoStock] = useState(0)
  const [nuevoProductoVenta, setNuevoProductoVenta] = useState(0)
  const [nuevoProductoFamiliaId, setNuevoProductoFamiliaId] = useState<string>('')
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)

  // Nombres de familias para mostrar en mensajes y selector
  const [familiasUsuario, setFamiliasUsuario] = useState<Familia[]>([])

  const inputManualRef = useRef<HTMLInputElement>(null)

  // Cargar datos de las familias del usuario para mostrar nombres
  useEffect(() => {
    if (famLoading || familiaIds.length === 0) return
    supabase
      .from('familias')
      .select('id, nombre, codigo, sector_id')
      .in('id', familiaIds)
      .then(({ data }) => {
        if (data) setFamiliasUsuario(data as Familia[])
      })
  }, [familiaIds, famLoading])

  // Inicializar familia seleccionada para nuevo producto cuando carguen las familias
  useEffect(() => {
    if (familiaIds.length > 0 && !nuevoProductoFamiliaId) {
      setNuevoProductoFamiliaId(familiaIds[0])
    }
  }, [familiaIds, nuevoProductoFamiliaId])

  function verificarFamiliaProducto(producto: Producto): boolean {
    if (esAdmin) return true
    if (!producto.familia_id) return false
    return familiaIds.includes(producto.familia_id)
  }

  async function buscarProducto(codigo: string, esBarcode: boolean): Promise<void> {
    setErrorBusqueda(null)
    const resultado = await scanBarcode(codigo)
    if (resultado) {
      // Verificar si el producto pertenece a las familias del usuario
      if (!verificarFamiliaProducto(resultado)) {
        setProductoEncontrado(resultado)
        setPaso('familia_bloqueada')
        return
      }
      setProductoEncontrado(resultado)
      const fueBarcode = esBarcode || resultado.codigo_barras === codigo.trim()
      setEncontradoPorCodArt(!fueBarcode)
      setPaso('confirmando')
    } else if (!scanError) {
      setNuevoProductoCodArt(codigo.trim())
      setErrorBusqueda('no_encontrado')
    }
  }

  function handleScanFromCamera(codigo: string): void {
    setModalAbierto(false)
    void buscarProducto(codigo, true)
  }

  function handleBuscarManual(): void {
    const codigo = codigoManual.trim()
    if (!codigo) { setErrorBusqueda('Ingresá un código para buscar.'); return }
    void buscarProducto(codigo, false)
  }

  function handleConfirmarProducto(): void {
    if (encontradoPorCodArt && !productoEncontrado?.codigo_barras) {
      setPaso('capturar_ean')
    } else {
      setPaso('formulario')
    }
  }

  function handleCancelarConfirmacion(): void {
    setProductoEncontrado(null)
    setEncontradoPorCodArt(false)
    reset()
    setPaso('inicio')
    setCodigoManual('')
    setErrorBusqueda(null)
    setErrorEan(null)
    setNuevoProductoCodArt('')
    setNuevoProductoDesc('')
    setNuevoProductoMarca('')
    setNuevoProductoCategoria('OTRO')
    setNuevoProductoStock(0)
    setNuevoProductoVenta(0)
    setNuevoProductoFamiliaId(familiaIds[0] ?? '')
    setErrorNuevo(null)
  }

  function handleGuardadoExitoso(): void {
    setGuardadoExitoso(true)
    setPaso('exito')
    setTimeout(() => {
      setProductoEncontrado(null)
      setCodigoManual('')
      setErrorBusqueda(null)
      setGuardadoExitoso(false)
      setEncontradoPorCodArt(false)
      setErrorEan(null)
      reset()
      setPaso('inicio')
    }, 2000)
  }

  async function handleEanCapturado(ean: string): Promise<void> {
    setModalEanAbierto(false)
    if (!productoEncontrado) return
    setGuardandoEan(true)
    setErrorEan(null)
    const { data: duplicado, error: errCheck } = await supabase
      .from('productos').select('id').eq('codigo_barras', ean.trim()).neq('id', productoEncontrado.id).maybeSingle()
    if (errCheck) { setGuardandoEan(false); setErrorEan(`Error al verificar: ${errCheck.message}`); return }
    if (duplicado) { setGuardandoEan(false); setErrorEan('Este código ya está registrado en otro producto.'); return }
    const { error: errUpdate } = await supabase
      .from('productos').update({ codigo_barras: ean.trim(), updated_at: new Date().toISOString() }).eq('id', productoEncontrado.id)
    setGuardandoEan(false)
    if (errUpdate) { setErrorEan(`Error al guardar: ${errUpdate.message}`); return }
    setProductoEncontrado((prev) => prev ? { ...prev, codigo_barras: ean.trim() } : prev)
    setPaso('formulario')
  }

  function handleOmitirEan(): void { setErrorEan(null); setPaso('formulario') }

  async function handleAgregarNuevoProducto(): Promise<void> {
    if (!nuevoProductoDesc.trim()) { setErrorNuevo('La descripción es obligatoria.'); return }

    // Validar que se seleccionó familia (solo para no-admin)
    const familiaIdParaInsertar = esAdmin ? (nuevoProductoFamiliaId || null) : (nuevoProductoFamiliaId || familiaIds[0] || null)
    if (!esAdmin && !familiaIdParaInsertar) {
      setErrorNuevo('No tenés familias asignadas. Contactá al administrador.')
      return
    }

    setErrorNuevo(null)
    setGuardandoNuevo(true)
    const { data, error } = await supabase
      .from('productos')
      .insert({
        cod_art: nuevoProductoCodArt.trim(),
        descripcion: nuevoProductoDesc.trim(),
        marca: nuevoProductoMarca.trim() || null,
        categoria: nuevoProductoCategoria,
        stock_actual: nuevoProductoStock,
        venta_media_diaria: nuevoProductoVenta,
        familia_id: familiaIdParaInsertar,
        activo: true,
      })
      .select().single()
    setGuardandoNuevo(false)
    if (error) { setErrorNuevo(`Error al agregar: ${error.message}`); return }
    if (data) { setProductoEncontrado(data as Producto); setErrorBusqueda(null); setPaso('formulario') }
  }

  // ── Pantalla bloqueada por familia ─────────────────────────────────────────
  if (paso === 'familia_bloqueada' && productoEncontrado) {
    const nombresFamilias = familiasUsuario.map((f) => f.nombre).join(', ')
    return (
      <div className="min-h-screen bg-surface-base flex flex-col">
        <SubHeader paso={1} titulo="Producto fuera de tu sector" subtitulo="Este producto no pertenece a tu sector" onBack={handleCancelarConfirmacion} />
        <div className="flex-1 flex flex-col px-4 pb-nav pt-6 gap-5">
          {/* Icono de advertencia */}
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <div className="p-4 bg-amber-50 rounded-full">
              <ShieldAlert className="h-12 w-12 text-amber-500" />
            </div>
          </div>

          {/* Info del producto bloqueado */}
          <div className="bg-white rounded-card shadow-card px-4 py-3.5">
            <p className="text-xs text-muted-foreground mb-0.5">Producto escaneado</p>
            <p className="text-foreground font-bold text-base leading-tight">{productoEncontrado.descripcion}</p>
            {productoEncontrado.marca && <p className="text-muted-foreground text-sm mt-0.5">{productoEncontrado.marca}</p>}
          </div>

          {/* Mensaje de restricción */}
          <div className="bg-amber-50 border border-amber-200 rounded-card p-4 flex gap-3 items-start">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 font-semibold text-sm">Este producto no pertenece a tu sector</p>
              <p className="text-amber-700 text-sm mt-1">
                Solo podés cargar productos de:{' '}
                <span className="font-semibold">
                  {nombresFamilias || 'tus familias asignadas'}
                </span>
              </p>
            </div>
          </div>

          {/* Botón para volver a escanear */}
          <button
            type="button"
            onClick={handleCancelarConfirmacion}
            className="w-full min-h-[56px] flex items-center justify-center gap-3 bg-brand hover:bg-brand-hover text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98]"
          >
            <ScanLine className="h-5 w-5" />
            Escanear otro
          </button>
        </div>
      </div>
    )
  }

  // ── Pantalla éxito ──────────────────────────────────────────────────────────
  if (paso === 'exito') {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center px-4 gap-6 animate-scale-in">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="p-5 bg-emerald-50 rounded-full">
            <CheckCircle className="h-16 w-16 text-emerald-500" />
          </div>
          <h2 className="text-foreground text-2xl font-bold">¡Guardado!</h2>
          <p className="text-muted-foreground text-base">{productoEncontrado?.descripcion}</p>
          <p className="text-muted-foreground/60 text-sm">Volviendo al scanner...</p>
        </div>
      </div>
    )
  }

  // ── Formulario (paso 3) ─────────────────────────────────────────────────────
  if (paso === 'formulario' && productoEncontrado) {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col">
        <SubHeader paso={3} titulo="Cargar vencimiento" subtitulo="Completá los datos del vencimiento" onBack={handleCancelarConfirmacion} />
        <div className="flex-1 overflow-y-auto px-4 pb-nav pt-4">
          <VencimientoForm
            producto={productoEncontrado}
            sucursalId={SUCURSAL_ID}
            usuarioId={user?.id ?? ''}
            onSuccess={handleGuardadoExitoso}
          />
          <button type="button" onClick={handleCancelarConfirmacion} className="w-full mt-3 py-3 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
            Cancelar y empezar de nuevo
          </button>
        </div>
      </div>
    )
  }

  // ── Capturar EAN (paso 2.5) ─────────────────────────────────────────────────
  if (paso === 'capturar_ean' && productoEncontrado) {
    return (
      <>
        {modalEanAbierto && <ScannerModal onScan={handleEanCapturado} onClose={() => setModalEanAbierto(false)} />}
        <div className="min-h-screen bg-surface-base flex flex-col">
          <SubHeader paso={2} titulo="Vincular código de barras" subtitulo="Paso opcional para registrar el EAN" onBack={handleCancelarConfirmacion} />
          <div className="flex-1 overflow-y-auto px-4 pb-nav pt-4 flex flex-col gap-4">
            <div className="bg-white rounded-card shadow-card px-4 py-3.5">
              <p className="text-xs text-muted-foreground mb-0.5">Producto seleccionado</p>
              <p className="text-foreground font-bold text-base leading-tight">{productoEncontrado.descripcion}</p>
              {productoEncontrado.marca && <p className="text-muted-foreground text-sm mt-0.5">{productoEncontrado.marca}</p>}
            </div>
            <div className="bg-brand-light border border-brand-muted rounded-card p-4 flex gap-3 items-start">
              <Barcode className="h-5 w-5 text-brand shrink-0 mt-0.5" />
              <div>
                <p className="text-brand font-semibold text-sm">¿Tenés el código de barras a mano?</p>
                <p className="text-brand/70 text-xs mt-1">Escanealo para vincularlo. La próxima vez lo vas a encontrar más rápido.</p>
              </div>
            </div>
            {errorEan && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2 animate-fade-in">
                <Package className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-600 text-sm">{errorEan}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setErrorEan(null); setModalEanAbierto(true) }}
              disabled={guardandoEan}
              className="w-full min-h-[56px] flex items-center justify-center gap-3 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98]"
            >
              {guardandoEan ? (
                <><span className="h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
              ) : (
                <><ScanLine className="h-5 w-5" />Escanear EAN</>
              )}
            </button>
            <button
              type="button"
              onClick={handleOmitirEan}
              disabled={guardandoEan}
              className="w-full min-h-[56px] bg-muted hover:bg-muted/70 disabled:opacity-50 text-foreground font-medium text-base rounded-card transition-colors"
            >
              Omitir por ahora
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Confirmar producto (paso 2) ─────────────────────────────────────────────
  if (paso === 'confirmando' && productoEncontrado) {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col">
        <SubHeader paso={2} titulo="Confirmar producto" subtitulo="¿Es este el producto que querés registrar?" onBack={handleCancelarConfirmacion} />
        <div className="flex-1 overflow-y-auto px-4 pb-nav pt-4">
          <ProductoConfirm
            producto={productoEncontrado}
            onConfirm={handleConfirmarProducto}
            onCancel={handleCancelarConfirmacion}
          />
        </div>
      </div>
    )
  }

  // ── Nuevo producto ──────────────────────────────────────────────────────────
  if (paso === 'nuevo_producto') {
    const mostrarSelectorFamilia = !esAdmin && familiasUsuario.length > 1
    const familiaUnica = !esAdmin && familiasUsuario.length === 1 ? familiasUsuario[0] : null

    return (
      <div className="min-h-screen bg-surface-base flex flex-col">
        <SubHeader paso={1} titulo="Agregar producto" subtitulo="Completá los datos del nuevo producto" onBack={handleCancelarConfirmacion} />
        <div className="flex-1 overflow-y-auto px-4 pb-nav pt-4 flex flex-col gap-4">
          {errorNuevo && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 animate-fade-in">
              <p className="text-red-600 text-sm">{errorNuevo}</p>
            </div>
          )}
          <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-4">
            {[
              { id: 'np-codart', label: 'Cod. Art.', value: nuevoProductoCodArt, onChange: setNuevoProductoCodArt, placeholder: 'Ej: 1234567', type: 'text' },
              { id: 'np-desc', label: 'Descripción *', value: nuevoProductoDesc, onChange: setNuevoProductoDesc, placeholder: 'Ej: Chocolate con leche 100g', type: 'text' },
              { id: 'np-marca', label: 'Marca (opcional)', value: nuevoProductoMarca, onChange: setNuevoProductoMarca, placeholder: 'Ej: Milka', type: 'text' },
            ].map((f) => (
              <div key={f.id} className="space-y-1.5">
                <label htmlFor={f.id} className="block text-xs font-semibold text-foreground uppercase tracking-wide">{f.label}</label>
                <input id={f.id} type={f.type} value={f.value} onChange={(e) => f.onChange(e.target.value)} placeholder={f.placeholder} className={inputCls} />
              </div>
            ))}
            <div className="space-y-1.5">
              <label htmlFor="np-cat" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Categoría</label>
              <select id="np-cat" value={nuevoProductoCategoria} onChange={(e) => setNuevoProductoCategoria(e.target.value as CategoriaProducto)} className={inputCls}>
                {CATEGORIAS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="np-stock" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Stock actual</label>
                <input id="np-stock" type="number" min={0} value={nuevoProductoStock} onChange={(e) => setNuevoProductoStock(Number(e.target.value))} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="np-venta" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Venta/día</label>
                <input id="np-venta" type="number" min={0} step={0.1} value={nuevoProductoVenta} onChange={(e) => setNuevoProductoVenta(parseFloat(e.target.value) || 0)} className={inputCls} />
              </div>
            </div>

            {/* Selector de familia — solo si el usuario tiene múltiples familias */}
            {mostrarSelectorFamilia && (
              <div className="space-y-1.5">
                <label htmlFor="np-familia" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Sector / Familia *</label>
                <select
                  id="np-familia"
                  value={nuevoProductoFamiliaId}
                  onChange={(e) => setNuevoProductoFamiliaId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Seleccioná una familia</option>
                  {familiasUsuario.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Info de familia única — solo lectura */}
            {familiaUnica && (
              <div className="bg-brand-light border border-brand-muted rounded-lg px-3 py-2.5 flex items-center gap-2">
                <Package className="h-4 w-4 text-brand shrink-0" />
                <p className="text-brand text-sm">
                  Se va a asignar a tu sector: <span className="font-semibold">{familiaUnica.nombre}</span>
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleAgregarNuevoProducto()}
            disabled={guardandoNuevo}
            className="w-full min-h-[56px] flex items-center justify-center gap-3 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98]"
          >
            {guardandoNuevo ? (
              <><span className="h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Agregando...</>
            ) : 'Agregar y continuar'}
          </button>
          <button type="button" onClick={handleCancelarConfirmacion} className="w-full py-3 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // ── Pantalla principal — Paso 1: Hero Scanner ───────────────────────────────
  const errorVisible = scanError ?? errorBusqueda

  return (
    <>
      {modalAbierto && <ScannerModal onScan={handleScanFromCamera} onClose={() => setModalAbierto(false)} />}

      <div className="min-h-screen bg-surface-base flex flex-col">
        {/* Header */}
        <div className="px-4 pt-5 pb-4">
          <StepIndicator current={1} total={3} />
          <h1 className="text-foreground text-xl font-bold mt-3 tracking-tight">Registrar vencimiento</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Escaneá o ingresá el código del producto</p>
        </div>

        <div className="flex-1 flex flex-col px-4 pb-nav gap-5">

          {/* ── HERO scan button ── */}
          <button
            type="button"
            onClick={() => { setErrorBusqueda(null); setModalAbierto(true) }}
            disabled={scanning}
            className={[
              'relative overflow-hidden w-full',
              'flex flex-col items-center justify-center gap-5',
              'bg-brand hover:bg-brand-hover',
              'rounded-card py-14',
              'shadow-brand-lg hover:shadow-[0_12px_48px_rgba(13,148,136,0.52)]',
              'transition-all duration-200',
              'active:scale-[0.97] active:shadow-brand',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/40',
            ].join(' ')}
          >
            {/* Decorative rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-52 w-52 rounded-full border-2 border-white/10" />
              <div className="absolute h-36 w-36 rounded-full border border-white/8" />
            </div>

            {/* Icon container */}
            <div className="relative bg-white/20 p-5 rounded-[18px]">
              <ScanLine className="h-12 w-12 text-white" />
            </div>

            {/* Text */}
            <div className="relative text-center px-4">
              <p className="text-white font-bold text-xl tracking-tight">Escanear producto</p>
              <p className="text-white/70 text-sm mt-1">Tocá para abrir la cámara</p>
            </div>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-xs font-medium">o ingresá el código</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Manual input */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                ref={inputManualRef}
                type="text"
                inputMode="numeric"
                value={codigoManual}
                onChange={(e) => { setCodigoManual(e.target.value); setErrorBusqueda(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarManual() }}
                placeholder="Código de barras o cod. artículo"
                className={`flex-1 ${inputCls}`}
              />
              <button
                type="button"
                onClick={handleBuscarManual}
                disabled={scanning}
                className="h-12 px-4 bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-lg text-white transition-colors flex items-center gap-2 font-semibold text-sm whitespace-nowrap"
              >
                {scanning ? (
                  <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </button>
            </div>

            {/* No encontrado */}
            {errorBusqueda === 'no_encontrado' && (
              <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-3 animate-fade-in">
                <div className="flex items-start gap-2">
                  <Package className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-foreground text-sm">Producto no encontrado en el sistema. ¿Querés agregarlo al surtido?</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaso('nuevo_producto')}
                  className="w-full py-2.5 text-center bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Agregar producto
                </button>
                <button
                  type="button"
                  onClick={handleCancelarConfirmacion}
                  className="w-full py-2.5 text-center bg-muted hover:bg-muted/70 text-foreground text-sm font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Otro error */}
            {errorVisible && errorBusqueda !== 'no_encontrado' && (
              <div className="bg-white rounded-card shadow-card p-4 flex items-start gap-2 animate-fade-in">
                <Package className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-foreground text-sm">{errorVisible}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

interface SubHeaderProps {
  paso: number
  titulo: string
  subtitulo: string
  onBack: () => void
}

function SubHeader({ paso, titulo, subtitulo, onBack }: SubHeaderProps) {
  return (
    <div className="sticky top-0 z-10 px-4 md:px-8 pt-4 pb-3 bg-white border-b border-border/40">
      <div className="flex items-center gap-3 mb-2.5">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 active:scale-[0.94]"
          aria-label="Volver"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <StepIndicator current={paso} total={3} />
      </div>
      <h1 className="text-foreground text-lg font-bold tracking-tight">{titulo}</h1>
      <p className="text-muted-foreground text-sm mt-0.5">{subtitulo}</p>
    </div>
  )
}

interface StepIndicatorProps { current: number; total: number }

function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i + 1 <= current ? 'bg-brand w-6' : 'bg-border w-3'
          }`}
        />
      ))}
      <span className="text-muted-foreground text-xs ml-1 font-medium">{current}/{total}</span>
    </div>
  )
}
