import { useState } from 'react'
import { useProductos } from '@/hooks/useProductos'
import type { Producto } from '@/types/index'

interface ScannerState {
  scanning: boolean
  error: string | null
  lastResult: Producto | null
}

interface UseScannerReturn extends ScannerState {
  scanBarcode: (barcode: string) => Promise<Producto | null>
  reset: () => void
}

export function useScanner(): UseScannerReturn {
  const { searchByBarcode } = useProductos()
  const [state, setState] = useState<ScannerState>({
    scanning: false,
    error: null,
    lastResult: null,
  })

  async function scanBarcode(barcode: string): Promise<Producto | null> {
    if (!barcode.trim()) {
      setState((prev) => ({ ...prev, error: 'Código de barras vacío', lastResult: null }))
      return null
    }

    setState({ scanning: true, error: null, lastResult: null })

    try {
      const producto = await searchByBarcode(barcode)
      setState({ scanning: false, error: null, lastResult: producto })
      return producto
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al buscar producto'
      setState({ scanning: false, error: message, lastResult: null })
      return null
    }
  }

  function reset(): void {
    setState({ scanning: false, error: null, lastResult: null })
  }

  return {
    scanning: state.scanning,
    error: state.error,
    lastResult: state.lastResult,
    scanBarcode,
    reset,
  }
}
