import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { X, CameraOff } from 'lucide-react'

interface ScannerModalProps {
  onScan: (codigo: string) => void
  onClose: () => void
}

type CameraStatus = 'iniciando' | 'activa' | 'error' | 'denegada'

const READER_ID = 'html5-qrcode-reader'

export default function ScannerModal({ onScan, onClose }: ScannerModalProps) {
  const [status, setStatus] = useState<CameraStatus>('iniciando')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const hasScanned = useRef(false)

  useEffect(() => {
    let scanner: Html5Qrcode | null = null

    async function iniciarCamara(): Promise<void> {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        setErrorMsg('Cámara no disponible en este navegador. Usá el ingreso manual.')
        return
      }

      try {
        scanner = new Html5Qrcode(READER_ID)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (hasScanned.current) return
            hasScanned.current = true
            onScan(decodedText)
          },
          // Error de frame ignorado (es continuo)
          () => undefined,
        )

        setStatus('activa')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (
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

    void iniciarCamara()

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-white font-semibold text-lg">Escanear código de barras</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          aria-label="Cerrar scanner"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Área de cámara */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {(status === 'error' || status === 'denegada') ? (
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="p-4 bg-gray-800 rounded-full">
              <CameraOff className="h-12 w-12 text-gray-400" />
            </div>
            <p className="text-white font-medium">
              {status === 'denegada' ? 'Cámara no disponible' : 'Error de cámara'}
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
        ) : (
          <div className="w-full max-w-sm">
            {status === 'iniciando' && (
              <div className="flex flex-col items-center gap-3 mb-4">
                <div className="h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Iniciando cámara...</p>
              </div>
            )}
            {/* Contenedor del scanner — debe existir en el DOM antes de inicializar */}
            <div
              id={READER_ID}
              className="w-full rounded-2xl overflow-hidden bg-gray-800"
            />
            {status === 'activa' && (
              <p className="text-center text-gray-400 text-sm mt-3">
                Apuntá la cámara al código de barras del producto
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
