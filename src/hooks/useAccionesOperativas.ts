import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSucursalActual } from '@/hooks/useSucursalActual'

export interface TrimestreInfo {
  trimestre: number
  anio: number
  desde: Date
  hasta: Date
  label: string
}

export function getTrimestreActual(): TrimestreInfo {
  const hoy = new Date()
  const mes = hoy.getMonth() + 1 // 1-12
  const trimestre = Math.ceil(mes / 3) // 1, 2, 3, 4
  const anio = hoy.getFullYear()
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
  donaciones: number
  decomisos: number
  loading: boolean
  error: string | null
  trimestreInfo: TrimestreInfo
  refetch: () => Promise<void>
}

export function useAccionesOperativas(): UseAccionesOperativasReturn {
  const [donaciones, setDonaciones] = useState(0)
  const [decomisos, setDecomisos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { sucursalId } = useSucursalActual()

  // useMemo garantiza referencia estable mientras trimestre/anio no cambien
  const trimestreInfo = useMemo(() => getTrimestreActual(), [])

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)

    const { trimestre, anio } = trimestreInfo

    const { data, error: fetchError } = await supabase
      .from('acciones_operativas')
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
    const totalDonaciones = rows
      .filter((a) => a.tipo === 'donacion')
      .reduce((sum, a) => sum + a.cantidad, 0)
    const totalDecomisos = rows
      .filter((a) => a.tipo === 'decomiso')
      .reduce((sum, a) => sum + a.cantidad, 0)

    setDonaciones(totalDonaciones)
    setDecomisos(totalDecomisos)
    setLoading(false)
  }, [trimestreInfo, sucursalId])

  const refetch = useCallback((): Promise<void> => {
    return fetchData()
  }, [fetchData])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return {
    donaciones,
    decomisos,
    loading,
    error,
    trimestreInfo,
    refetch,
  }
}
