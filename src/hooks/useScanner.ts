import { useState } from 'react'
import { useProductos } from '@/hooks/useProductos'
import { useSucursalActual } from '@/hooks/useSucursalActual'
import { consumirLecturaCamara } from '@/lib/scanner-source'
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
    const codigo = barcode.trim()
    if (!codigo) {
      setState((prev) => ({ ...prev, error: 'Código vacío', lastResult: null }))
      return null
    }
    if (!scope) {
      setState((prev) => ({ ...prev, error: 'Seleccioná una sucursal antes de escanear.', lastResult: null }))
      return null
    }

    const desdeCamara = consumirLecturaCamara(codigo)
    if (!desdeCamara && !/^\d{7}$/.test(codigo)) {
      setState((prev) => ({
        ...prev,
        error: 'La búsqueda manual acepta únicamente el código interno de 7 dígitos de Glaciar. El EAN se registra sólo escaneándolo con la cámara.',
        lastResult: null,
      }))
      return null
    }

    setState({ scanning: true, error: null, lastResult: null })

    try {
      const producto = await searchByBarcode(codigo, scope)
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
