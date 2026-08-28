import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSucursalActual } from '@/hooks/useSucursalActual'

const TZ_OPERATIVA = 'America/Argentina/Buenos_Aires'

export interface TrimestreInfo {
  trimestre: number
  anio: number
  desde: Date
  hasta: Date
  label: string
}

export function getTrimestreActual(): TrimestreInfo {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_OPERATIVA,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date())
  const mes = Number(partes.find((p) => p.type === 'month')?.value ?? 1)
  const anio = Number(partes.find((p) => p.type === 'year')?.value ?? new Date().getFullYear())
  const trimestre = Math.ceil(mes / 3)
  const mesInicio = (trimestre - 1) * 3 + 1
  const desde = new Date(anio, mesInicio - 1, 1)
  const hasta = new Date(anio, mesInicio + 2, 0, 23, 59, 59)

  const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const mesInicioLabel = MESES_CORTOS[mesInicio - 1]
  const mesFinLabel = MESES_CORTOS[mesInicio + 1]
  const label = `Q${trimestre} ${anio} · ${mesInicioLabel}-${mesFinLabel}`

  return { trimestre, anio, desde, hasta, label }
}

interface AccionOperativaRow {
  tipo: string
  cantidad: number
}

interface UseAccionesOperativasReturn {
  /** Cantidad de vencimientos cerrados por venta; no unidades inferidas. */
  vendidos: number
  donaciones: number
  decomisos: number
  loading: boolean
  error: string | null
  trimestreInfo: TrimestreInfo
  refetch: () => Promise<void>
}

export function useAccionesOperativas(): UseAccionesOperativasReturn {
  const [vendidos, setVendidos] = useState(0)
  const [donaciones, setDonaciones] = useState(0)
  const [decomisos, setDecomisos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { sucursalId, loading: sucursalLoading } = useSucursalActual()

  const trimestreInfo = useMemo(() => getTrimestreActual(), [])

  const fetchData = useCallback(async (): Promise<void> => {
    if (sucursalLoading) return

    if (!sucursalId) {
      setVendidos(0)
      setDonaciones(0)
      setDecomisos(0)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { trimestre, anio } = trimestreInfo
    const { data, error: fetchError } = await supabase
      .from('v_acciones_operativas_historial')
      .select('tipo, cantidad')
      .eq('trimestre', trimestre)
      .eq('anio', anio)
      .eq('sucursal_id', sucursalId)

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as AccionOperativaRow[]
    setVendidos(rows.filter((a) => a.tipo === 'vendido').length)
    setDonaciones(rows.filter((a) => a.tipo === 'donacion').reduce((sum, a) => sum + a.cantidad, 0))
    setDecomisos(rows.filter((a) => a.tipo === 'decomiso').reduce((sum, a) => sum + a.cantidad, 0))
    setLoading(false)
  }, [trimestreInfo, sucursalId, sucursalLoading])

  const refetch = useCallback((): Promise<void> => fetchData(), [fetchData])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { vendidos, donaciones, decomisos, loading, error, trimestreInfo, refetch }
}
