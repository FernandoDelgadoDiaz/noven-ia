import { useState, useRef } from 'react'
import { ScanLine, Search, CheckCircle, Package, Barcode } from 'lucide-react'
import { useScanner } from '@/hooks/useScanner'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import ScannerModal from '@/components/scanner/ScannerModal'
import ProductoConfirm from '@/components/scanner/ProductoConfirm'
import VencimientoForm from '@/components/scanner/VencimientoForm'
import type { Producto } from '@/types/index'

// ID de sucursal hardcodeado hasta implementar selector de sucursal
const SUCURSAL_ID = '00000000-0000-0000-0000-000000000001'

type Paso = 'inicio' | 'confirmando' | 'capturar_ean' | 'formulario' | 'exito' | 'nuevo_producto'

type CategoriaProducto = 'CHOCOLATES' | 'CARAMELOS' | 'SNACKS' | 'CHICLES' | 'CEREALES' | 'OTRO'

const CATEGORIAS: CategoriaProducto[] = ['CHOCOLATES', 'CARAMELOS', 'SNACKS', 'CHICLES', 'CEREALES', 'OTRO']

export default function Scanner() {
  const { scanBarcode, scanning, error: scanError, reset } = useScanner()
  const { user } = useAuth()

  const [paso, setPaso] = useState<Paso>('inicio')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalEanAbierto, setModalEanAbierto] = useState(false)
  const [codigoManual, setCodigoManual] = useState('')
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [productoEncontrado, setProductoEncontrado] = useState<Producto | null>(null)
  const [encontradoPorCodArt, setEncontradoPorCodArt] = useState(false)
  const [, setGuardadoExitoso] = useState(false)

  // Estados del paso 2.5 (captura de EAN)
  const [guardandoEan, setGuardandoEan] = useState(false)
  const [errorEan, setErrorEan] = useState<string | null>(null)

  // Estados del paso nuevo_producto
  const [nuevoProductoCodArt, setNuevoProductoCodArt] = useState('')
  const [nuevoProductoDesc, setNuevoProductoDesc] = useState('')
  const [nuevoProductoMarca, setNuevoProductoMarca] = useState('')
  const [nuevoProductoCategoria, setNuevoProductoCategoria] = useState<CategoriaProducto>('OTRO')
  const [nuevoProductoStock, setNuevoProductoStock] = useState(0)
  const [nuevoProductoVenta, setNuevoProductoVenta] = useState(0)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)

  const inputManualRef = useRef<HTMLInputElement>(null)

  async function buscarProducto(codigo: string, esBarcode: boolean): Promise<void> {
    setErrorBusqueda(null)
    const resultado = await scanBarcode(codigo)
    if (resultado) {
      setProductoEncontrado(resultado)
      // Detectar si se encontró por cod_art (fallback) vs codigo_barras
      // Si el código escaneado/ingresado coincide con codigo_barras del producto → encontrado por barcode
      // Si no → encontrado por cod_art
      const fueBarcode = esBarcode || resultado.codigo_barras === codigo.trim()
      setEncontradoPorCodArt(!fueBarcode)
      setPaso('confirmando')
    } else if (!scanError) {
      // Producto no encontrado: pre-cargar el cod_art y mostrar mensaje con opción de alta
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
    if (!codigo) {
      setErrorBusqueda('Ingresá un código para buscar.')
      return
    }
    // El ingreso manual siempre trata de buscar por barcode primero, luego cod_art
    // Detectamos si el resultado viene por cod_art en buscarProducto comparando el campo
    void buscarProducto(codigo, false)
  }

  function handleConfirmarProducto(): void {
    // Si el producto se encontró por cod_art y NO tiene código de barras registrado,
    // ir al paso 2.5 para capturar EAN
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
    setErrorNuevo(null)
  }

  function handleGuardadoExitoso(): void {
    setGuardadoExitoso(true)
    setPaso('exito')

    // Volver al inicio automáticamente después de 2 segundos
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

  // Paso 2.5: el usuario capturó un EAN con la cámara
  async function handleEanCapturado(ean: string): Promise<void> {
    setModalEanAbierto(false)
    if (!productoEncontrado) return

    setGuardandoEan(true)
    setErrorEan(null)

    // Verificar que el EAN no esté registrado en otro producto
    const { data: duplicado, error: errCheck } = await supabase
      .from('productos')
      .select('id')
      .eq('codigo_barras', ean.trim())
      .neq('id', productoEncontrado.id)
      .maybeSingle()

    if (errCheck) {
      setGuardandoEan(false)
      setErrorEan(`Error al verificar el código: ${errCheck.message}`)
      return
    }

    if (duplicado) {
      setGuardandoEan(false)
      setErrorEan('Este código ya está registrado en otro producto. Escaneá otro o saltea este paso.')
      return
    }

    // Guardar el EAN en el producto
    const { error: errUpdate } = await supabase
      .from('productos')
      .update({ codigo_barras: ean.trim(), updated_at: new Date().toISOString() })
      .eq('id', productoEncontrado.id)

    setGuardandoEan(false)

    if (errUpdate) {
      setErrorEan(`Error al guardar el código: ${errUpdate.message}`)
      return
    }

    // Actualizar el producto en memoria
    setProductoEncontrado((prev) => prev ? { ...prev, codigo_barras: ean.trim() } : prev)
    setPaso('formulario')
  }

  function handleOmitirEan(): void {
    setErrorEan(null)
    setPaso('formulario')
  }

  async function handleAgregarNuevoProducto(): Promise<void> {
    if (!nuevoProductoDesc.trim()) {
      setErrorNuevo('La descripcion es obligatoria.')
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
        activo: true,
      })
      .select()
      .single()

    setGuardandoNuevo(false)

    if (error) {
      setErrorNuevo(`Error al agregar el producto: ${error.message}`)
      return
    }

    if (data) {
      setProductoEncontrado(data as Producto)
      setErrorBusqueda(null)
      setPaso('formulario')
    }
  }

  // Pantalla de éxito
  if (paso === 'exito') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 gap-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="p-5 bg-green-500/20 rounded-full animate-pulse">
            <CheckCircle className="h-16 w-16 text-green-400" />
          </div>
          <h2 className="text-white text-2xl font-bold">Vencimiento guardado</h2>
          <p className="text-gray-400 text-base">
            {productoEncontrado?.descripcion}
          </p>
          <p className="text-gray-500 text-sm">Volviendo al scanner...</p>
        </div>
      </div>
    )
  }

  // Pantalla de formulario (Paso 3)
  if (paso === 'formulario' && productoEncontrado) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-6 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <StepIndicator current={3} total={3} />
          </div>
          <h1 className="text-white text-xl font-bold">Cargar vencimiento</h1>
          <p className="text-gray-400 text-sm mt-0.5">Completá los datos del vencimiento</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <VencimientoForm
            producto={productoEncontrado}
            sucursalId={SUCURSAL_ID}
            usuarioId={user?.id ?? ''}
            onSuccess={handleGuardadoExitoso}
          />

          <button
            type="button"
            onClick={handleCancelarConfirmacion}
            className="w-full mt-3 min-h-12 text-gray-400 hover:text-white text-sm font-medium transition-colors"
          >
            Cancelar y empezar de nuevo
          </button>
        </div>
      </div>
    )
  }

  // Paso 2.5: Capturar EAN
  if (paso === 'capturar_ean' && productoEncontrado) {
    return (
      <>
        {modalEanAbierto && (
          <ScannerModal
            onScan={handleEanCapturado}
            onClose={() => setModalEanAbierto(false)}
          />
        )}
        <div className="min-h-screen bg-gray-900 flex flex-col">
          {/* Header */}
          <div className="px-4 pt-6 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <StepIndicator current={2} total={3} />
            </div>
            <h1 className="text-white text-xl font-bold">Vincular código de barras</h1>
            <p className="text-gray-400 text-sm mt-0.5">Paso opcional para registrar el EAN del producto</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 flex flex-col gap-4">
            {/* Info del producto */}
            <div className="bg-gray-800 rounded-2xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Producto seleccionado</p>
              <p className="text-white font-bold text-base leading-tight">{productoEncontrado.descripcion}</p>
              {productoEncontrado.marca && (
                <p className="text-gray-400 text-sm">{productoEncontrado.marca}</p>
              )}
            </div>

            {/* Mensaje informativo */}
            <div className="bg-blue-900/30 border border-blue-700/50 rounded-2xl p-4 flex gap-3 items-start">
              <Barcode className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-200 font-medium text-sm">
                  ¿Tenés el código de barras del producto a mano?
                </p>
                <p className="text-blue-300/70 text-xs mt-1">
                  Escanealo para vincularlo al sistema. Así la próxima vez lo vas a encontrar más rápido.
                </p>
              </div>
            </div>

            {/* Error EAN */}
            {errorEan && (
              <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 flex items-start gap-2">
                <Package className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{errorEan}</p>
              </div>
            )}

            {/* Botón escanear EAN */}
            <button
              type="button"
              onClick={() => {
                setErrorEan(null)
                setModalEanAbierto(true)
              }}
              disabled={guardandoEan}
              className="w-full min-h-14 flex items-center justify-center gap-3 bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-2xl transition-colors"
            >
              {guardandoEan ? (
                <>
                  <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <ScanLine className="h-5 w-5" />
                  Escanear EAN
                </>
              )}
            </button>

            {/* Botón omitir */}
            <button
              type="button"
              onClick={handleOmitirEan}
              disabled={guardandoEan}
              className="w-full min-h-14 bg-gray-800 hover:bg-gray-700 active:bg-gray-900 disabled:opacity-50 text-gray-300 font-medium text-base rounded-2xl transition-colors"
            >
              Omitir por ahora
            </button>

            <button
              type="button"
              onClick={handleCancelarConfirmacion}
              className="w-full min-h-12 text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
              Cancelar y empezar de nuevo
            </button>
          </div>
        </div>
      </>
    )
  }

  // Pantalla de confirmación de producto (Paso 2)
  if (paso === 'confirmando' && productoEncontrado) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-6 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <StepIndicator current={2} total={3} />
          </div>
          <h1 className="text-white text-xl font-bold">Confirmar producto</h1>
          <p className="text-gray-400 text-sm mt-0.5">¿Es este el producto que querés registrar?</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <ProductoConfirm
            producto={productoEncontrado}
            onConfirm={handleConfirmarProducto}
            onCancel={handleCancelarConfirmacion}
          />
        </div>
      </div>
    )
  }

  // Paso nuevo_producto: formulario de alta
  if (paso === 'nuevo_producto') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-6 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <StepIndicator current={1} total={3} />
          </div>
          <h1 className="text-white text-xl font-bold">Agregar producto</h1>
          <p className="text-gray-400 text-sm mt-0.5">Completá los datos del nuevo producto</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 flex flex-col gap-4">
          {/* Error */}
          {errorNuevo && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3">
              <p className="text-red-300 text-sm">{errorNuevo}</p>
            </div>
          )}

          {/* Cod. Art */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400">Cod. Art.</label>
            <input
              type="text"
              value={nuevoProductoCodArt}
              onChange={(e) => setNuevoProductoCodArt(e.target.value)}
              placeholder="Ej: 1234567"
              className="w-full h-12 px-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm"
            />
          </div>

          {/* Descripcion */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400">
              Descripcion <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={nuevoProductoDesc}
              onChange={(e) => setNuevoProductoDesc(e.target.value)}
              placeholder="Ej: Chocolate con leche 100g"
              className="w-full h-12 px-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm"
            />
          </div>

          {/* Marca */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400">Marca (opcional)</label>
            <input
              type="text"
              value={nuevoProductoMarca}
              onChange={(e) => setNuevoProductoMarca(e.target.value)}
              placeholder="Ej: Milka"
              className="w-full h-12 px-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm"
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400">Categoria</label>
            <select
              value={nuevoProductoCategoria}
              onChange={(e) => setNuevoProductoCategoria(e.target.value as CategoriaProducto)}
              className="w-full h-12 px-4 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm"
            >
              {CATEGORIAS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Stock actual */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400">Stock actual</label>
            <input
              type="number"
              min={0}
              value={nuevoProductoStock}
              onChange={(e) => setNuevoProductoStock(Number(e.target.value))}
              className="w-full h-12 px-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm"
            />
          </div>

          {/* Venta media diaria */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400">Venta media diaria</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={nuevoProductoVenta}
              onChange={(e) => setNuevoProductoVenta(parseFloat(e.target.value) || 0)}
              className="w-full h-12 px-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm"
            />
          </div>

          {/* Botones */}
          <button
            type="button"
            onClick={() => void handleAgregarNuevoProducto()}
            disabled={guardandoNuevo}
            className="w-full min-h-14 flex items-center justify-center gap-3 bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-2xl transition-colors mt-2"
          >
            {guardandoNuevo ? (
              <>
                <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Agregando...
              </>
            ) : (
              'Agregar y continuar'
            )}
          </button>

          <button
            type="button"
            onClick={handleCancelarConfirmacion}
            className="w-full min-h-12 text-gray-400 hover:text-white text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // Pantalla principal — Paso 1: Escanear
  const errorVisible = scanError ?? errorBusqueda

  return (
    <>
      {/* Modal de cámara */}
      {modalAbierto && (
        <ScannerModal
          onScan={handleScanFromCamera}
          onClose={() => setModalAbierto(false)}
        />
      )}

      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-6 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <StepIndicator current={1} total={3} />
          </div>
          <h1 className="text-white text-xl font-bold">Registrar vencimiento</h1>
          <p className="text-gray-400 text-sm mt-0.5">Escaneá el código de barras del producto</p>
        </div>

        <div className="flex-1 flex flex-col px-4 pb-24 pt-6 gap-6">
          {/* Botón principal de escaneo */}
          <button
            type="button"
            onClick={() => {
              setErrorBusqueda(null)
              setModalAbierto(true)
            }}
            disabled={scanning}
            className="w-full min-h-[160px] flex flex-col items-center justify-center gap-4 bg-gray-800 hover:bg-gray-700 active:bg-gray-900 border-2 border-dashed border-gray-600 hover:border-green-500 rounded-2xl transition-all text-center px-4 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="p-4 bg-green-500/10 group-hover:bg-green-500/20 rounded-2xl transition-colors">
              <ScanLine className="h-10 w-10 text-green-400" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">Escanear producto</p>
              <p className="text-gray-400 text-sm mt-0.5">Abre la cámara para leer el código de barras</p>
            </div>
          </button>

          {/* Divisor */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-gray-500 text-sm">o ingresá el código</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {/* Búsqueda manual */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                ref={inputManualRef}
                type="text"
                inputMode="numeric"
                value={codigoManual}
                onChange={(e) => {
                  setCodigoManual(e.target.value)
                  setErrorBusqueda(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleBuscarManual()
                }}
                placeholder="Código de barras o cod. artículo"
                className="flex-1 h-12 px-4 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={handleBuscarManual}
                disabled={scanning}
                className="h-12 px-4 bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-50 rounded-xl text-white transition-colors flex items-center gap-2 font-medium text-sm whitespace-nowrap"
              >
                {scanning ? (
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </button>
            </div>

            {/* Producto no encontrado */}
            {errorBusqueda === 'no_encontrado' && (
              <div className="flex flex-col gap-3 bg-gray-800 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <Package className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                  <p className="text-gray-300 text-sm">
                    Este producto no esta en el sistema. ¿Queres agregarlo al surtido?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaso('nuevo_producto')}
                  className="w-full py-2.5 text-center bg-green-500 hover:bg-green-400 active:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Agregar producto
                </button>
                <button
                  type="button"
                  onClick={handleCancelarConfirmacion}
                  className="w-full py-2.5 text-center bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Otros errores de búsqueda */}
            {errorVisible && errorBusqueda !== 'no_encontrado' && (
              <div className="flex flex-col gap-3 bg-gray-800 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <Package className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                  <p className="text-gray-300 text-sm">{errorVisible}</p>
                </div>
              </div>
            )}
          </div>

          {/* Tip de uso */}
          {!errorVisible && errorBusqueda !== 'no_encontrado' && (
            <div className="bg-gray-800/50 rounded-xl px-4 py-3 flex gap-3 items-start">
              <ScanLine className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
              <p className="text-gray-400 text-xs leading-relaxed">
                Usá la cámara para escanear el código de barras de la etiqueta del producto. Si el código no se lee bien, ingresalo manualmente.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Componente auxiliar: indicador de paso
interface StepIndicatorProps {
  current: number
  total: number
}

function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i + 1 <= current
              ? 'bg-green-500 w-6'
              : 'bg-gray-700 w-3'
          }`}
        />
      ))}
      <span className="text-gray-500 text-xs ml-1">
        {current}/{total}
      </span>
    </div>
  )
}
