import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { CameraOff } from 'lucide-react'

const HTML5_READER_ID = 'html5-qrcode-fallback-reader'

interface Html5QrcodeFallbackProps {
  onScan: (codigo: string) => void
  onClose: () => void
}

export default function Html5QrcodeFallback({ onScan, onClose }: Html5QrcodeFallbackProps) {
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
