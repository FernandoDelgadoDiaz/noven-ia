import { useState } from 'react'
import { useProductos } from '@/hooks/useProductos'
import { useSucursalActual } from '@/hooks/useSucursalActual'
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

/**
 * El scope explícito es opcional para mantener compatibilidad con el Scanner
 * actual. Si no se informa, se usa la sucursal operativa resuelta por el contexto.
 */
export function useScanner(sucursalId?: string): UseScannerReturn {
  const { searchByBarcode } = useProductos()
  const { sucursalId: sucursalActual } = useSucursalActual()
  const scope = (sucursalId ?? sucursalActual).trim()

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
    if (!scope) {
      setState((prev) => ({ ...prev, error: 'Seleccioná una sucursal antes de escanear.', lastResult: null }))
      return null
    }

    setState({ scanning: true, error: null, lastResult: null })

    try {
      const producto = await searchByBarcode(barcode, scope)
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