import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { X, CameraOff } from 'lucide-react'

// Declaraciones de tipos para BarcodeDetector (no incluida en todas las versiones de lib.dom.d.ts)
interface BarcodeDetectorOptions {
  formats?: string[]
}

interface DetectedBarcode {
  rawValue: string
  format: string
  boundingBox: DOMRectReadOnly
  cornerPoints: ReadonlyArray<{ x: number; y: number }>
}

interface BarcodeDetectorInstance {
  detect(image: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<DetectedBarcode[]>
}

interface BarcodeDetectorConstructor {
  new(options?: BarcodeDetectorOptions): BarcodeDetectorInstance
  getSupportedFormats(): Promise<string[]>
}

declare const BarcodeDetector: BarcodeDetectorConstructor

// --- Sub-componente fallback usando html5-qrcode ---

const HTML5_READER_ID = 'html5-qrcode-fallback-reader'

interface Html5QrcodeFallbackProps {
  onScan: (codigo: string) => void
  onClose: () => void
}

function Html5QrcodeFallback({ onScan, onClose }: Html5QrcodeFallbackProps) {
  const [fallbackStatus, setFallbackStatus] = useState<'iniciando' | 'activa' | 'error' | 'denegada'>('iniciando')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const hasScanned = useRef(false)

  useEffect(() => {
    let scanner: Html5Qrcode | null = null

    async function iniciar(): Promise<void> {
      try {
        scanner = new Html5Qrcode(HTML5_READER_ID)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (hasScanned.current) return
            hasScanned.current = true
            onScan(decodedText)
          },
          () => undefined,
        )

        setFallbackStatus('activa')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied') ||
          msg.toLowerCase().includes('notallowed')
        ) {
          setFallbackStatus('denegada')
          setErrorMsg('Permiso de cámara denegado. Habilitalo desde la configuración del navegador.')
        } else {
          setFallbackStatus('error')
          setErrorMsg('No se pudo iniciar la cámara. Intentá ingresar el código manualmente.')
        }
      }
    }

    void iniciar()

    return () => {
      const s = scannerRef.current
      if (!s) return
      const state = s.getState()
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        s.stop()
          .then(() => { try { s.clear() } catch { /* cleanup silencioso */ } })
          .catch(() => { try { s.clear() } catch { /* cleanup silencioso */ } })
      } else {
        try { s.clear() } catch { /* cleanup silencioso */ }
      }
      scannerRef.current = null
    }
  }, [onScan])

  if (fallbackStatus === 'error' || fallbackStatus === 'denegada') {
    return (
      <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
        <div className="p-4 bg-gray-800 rounded-full">
          <CameraOff className="h-12 w-12 text-gray-400" />
        </div>
        <p className="text-white font-medium">
          {fallbackStatus === 'denegada' ? 'Cámara no disponible' : 'Error de cámara'}
        </p>
        <p className="text-gray-400 text-sm">{errorMsg}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 px-6 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors"
        >
          Ingresar código manualmente
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm px-4">
      {fallbackStatus === 'iniciando' && (
        <div className="flex flex-col items-center gap-3 mb-4">
          <div className="h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Iniciando cámara...</p>
        </div>
      )}
      <div
        id={HTML5_READER_ID}
        className="w-full rounded-2xl overflow-hidden bg-gray-800"
      />
      {fallbackStatus === 'activa' && (
        <p className="text-center text-gray-400 text-sm mt-3">
          Apuntá la cámara al código de barras del producto
        </p>
      )}
    </div>
  )
}

// --- Componente principal ScannerModal ---

interface ScannerModalProps {
  onScan: (codigo: string) => void
  onClose: () => void
}

type ScannerStatus = 'iniciando' | 'activa' | 'error' | 'denegada' | 'no_soportado'

export default function ScannerModal({ onScan, onClose }: ScannerModalProps) {
  const [status, setStatus] = useState<ScannerStatus>('iniciando')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [useFallback, setUseFallback] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const hasScanned = useRef(false)

  const stopCamera = (): void => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  useEffect(() => {
    // Verificar soporte básico de getUserMedia
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('no_soportado')
      setErrorMsg('Tu navegador no soporta acceso a la cámara. Usá el ingreso manual.')
      return
    }

    const tieneBarcodeDetector = 'BarcodeDetector' in window

    // Si no hay BarcodeDetector, usar fallback html5-qrcode
    if (!tieneBarcodeDetector) {
      setUseFallback(true)
      setStatus('activa')
      return
    }

    async function iniciarNativa(): Promise<void> {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })

        streamRef.current = stream

        if (!videoRef.current) return

        videoRef.current.srcObject = stream
        await videoRef.current.play()

        setStatus('activa')

        const detector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'],
        })

        const detectLoop = async (): Promise<void> => {
          if (!videoRef.current || hasScanned.current) return
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0 && !hasScanned.current) {
              hasScanned.current = true
              stopCamera()
              onScan(barcodes[0].rawValue)
              return
            }
          } catch {
            // Frame no disponible todavía, continuar
          }
          animFrameRef.current = requestAnimationFrame(() => { void detectLoop() })
        }

        animFrameRef.current = requestAnimationFrame(() => { void detectLoop() })
      } catch (err) {
        const nombre = err instanceof Error ? err.name : ''
        const msg = err instanceof Error ? err.message : String(err)

        if (
          nombre === 'NotAllowedError' ||
          nombre === 'PermissionDeniedError' ||
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied') ||
          msg.toLowerCase().includes('notallowed')
        ) {
          setStatus('denegada')
          setErrorMsg('Permiso de cámara denegado. Habilitalo desde la configuración del navegador.')
        } else {
          setStatus('error')
          setErrorMsg('No se pudo iniciar la cámara. Intentá ingresar el código manualmente.')
        }
      }
    }

    void iniciarNativa()

    return () => {
      stopCamera()
    }
  }, [onScan])

  // Estados de error: no_soportado, denegada, error
  const hayError = status === 'no_soportado' || status === 'denegada' || status === 'error'

  if (hayError) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar scanner"
          className="absolute top-4 right-4 p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
          <div className="p-4 bg-gray-800 rounded-full">
            <CameraOff className="h-12 w-12 text-gray-400" />
          </div>
          <p className="text-white font-medium text-lg">
            {status === 'denegada' ? 'Cámara no disponible' : 'Error de cámara'}
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">{errorMsg}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 px-6 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors"
          >
            Ingresar código manualmente
          </button>
        </div>
      </div>
    )
  }

  // Fallback html5-qrcode (cuando BarcodeDetector no está disponible)
  if (useFallback) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-white font-semibold text-lg">Escanear código de barras</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar scanner"
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <Html5QrcodeFallback onScan={onScan} onClose={onClose} />
        </div>
      </div>
    )
  }

  // Vista nativa con BarcodeDetector
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Video fullscreen como fondo */}
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay encima del video */}
      <div className="absolute inset-0 flex flex-col">
        {/* Botón cerrar top-right */}
        <div className="flex justify-end p-4">
          <button
            type="button"
            onClick={() => { stopCamera(); onClose() }}
            aria-label="Cerrar scanner"
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Centro: recuadro de escaneo */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
          {status === 'iniciando' && (
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm">Iniciando cámara...</p>
            </div>
          )}

          {status === 'activa' && (
            <>
              {/* Recuadro con esquinas y línea de escaneo */}
              <div className="relative w-64 h-64">
                {/* Esquinas decorativas */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg" />

                {/* Línea de escaneo animada */}
                <div className="absolute inset-x-2 overflow-hidden" style={{ top: '4px', bottom: '4px' }}>
                  <div className="scan-line absolute left-0 right-0 h-0.5 bg-green-400/80 shadow-[0_0_8px_2px_rgba(74,222,128,0.6)]" />
                </div>
              </div>

              <p className="text-white text-sm text-center drop-shadow-lg">
                Apuntá la cámara al código de barras
              </p>
            </>
          )}
        </div>

        {/* Botón inferior */}
        <div className="flex justify-center pb-10">
          <button
            type="button"
            onClick={() => { stopCamera(); onClose() }}
            className="px-6 py-3 bg-black/50 text-white text-sm font-medium rounded-full hover:bg-black/70 transition-colors border border-white/20"
          >
            Ingresar manualmente
          </button>
        </div>
      </div>

      {/* Animación de la línea de escaneo */}
      <style>{`
        @keyframes scan {
          0% { top: 4px; }
          50% { top: calc(100% - 6px); }
          100% { top: 4px; }
        }
        .scan-line {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
