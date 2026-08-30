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
  unidades_recuperadas: number
  unidades_perdidas: number
  valor_recuperado_sin_iva: number | null
  valor_perdido_sin_iva: number | null
  valorizacion_metodo: string | null
  resultado_ciclo_completo: boolean
}

export interface ResultadoEconomico {
  unidades: number
  pesos: number
  accionesConCosto: number
  accionesSinCosto: number
}

interface UseAccionesOperativasReturn {
  vendidos: number
  donaciones: number
  decomisos: number
  recuperado: ResultadoEconomico
  perdido: ResultadoEconomico
  hayValorizacionRetrospectiva: boolean
  hayCiclosIncompletos: boolean
  loading: boolean
  error: string | null
  trimestreInfo: TrimestreInfo
  refetch: () => Promise<void>
}

const VACIO: ResultadoEconomico = { unidades: 0, pesos: 0, accionesConCosto: 0, accionesSinCosto: 0 }

function resumir(
  rows: AccionOperativaRow[],
  campoUnidades: 'unidades_recuperadas' | 'unidades_perdidas',
  campoValor: 'valor_recuperado_sin_iva' | 'valor_perdido_sin_iva',
): ResultadoEconomico {
  return rows.reduce<ResultadoEconomico>((acc, row) => {
    const cantidad = Number(row[campoUnidades]) || 0
    const valor = row[campoValor] == null ? null : Number(row[campoValor])
    acc.unidades += cantidad
    if (cantidad <= 0) return acc
    if (valor == null || !Number.isFinite(valor)) {
      acc.accionesSinCosto += 1
    } else {
      acc.pesos += valor
      acc.accionesConCosto += 1
    }
    return acc
  }, { ...VACIO })
}

export function useAccionesOperativas(): UseAccionesOperativasReturn {
  const [vendidos, setVendidos] = useState(0)
  const [donaciones, setDonaciones] = useState(0)
  const [decomisos, setDecomisos] = useState(0)
  const [recuperado, setRecuperado] = useState<ResultadoEconomico>({ ...VACIO })
  const [perdido, setPerdido] = useState<ResultadoEconomico>({ ...VACIO })
  const [hayValorizacionRetrospectiva, setHayValorizacionRetrospectiva] = useState(false)
  const [hayCiclosIncompletos, setHayCiclosIncompletos] = useState(false)
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
      setRecuperado({ ...VACIO })
      setPerdido({ ...VACIO })
      setHayValorizacionRetrospectiva(false)
      setHayCiclosIncompletos(false)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { trimestre, anio } = trimestreInfo
    const { data, error: fetchError } = await supabase
      .from('v_acciones_operativas_historial')
      .select('tipo, unidades_recuperadas, unidades_perdidas, valor_recuperado_sin_iva, valor_perdido_sin_iva, valorizacion_metodo, resultado_ciclo_completo')
      .eq('trimestre', trimestre)
      .eq('anio', anio)
      .eq('sucursal_id', sucursalId)

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as AccionOperativaRow[]
    const vendidosRows = rows.filter((a) => a.tipo === 'vendido')
    const donacionRows = rows.filter((a) => a.tipo === 'donacion')
    const decomisoRows = rows.filter((a) => a.tipo === 'decomiso')

    setVendidos(vendidosRows.reduce((sum, a) => sum + (Number(a.unidades_recuperadas) || 0), 0))
    setDonaciones(donacionRows.reduce((sum, a) => sum + (Number(a.unidades_perdidas) || 0), 0))
    setDecomisos(decomisoRows.reduce((sum, a) => sum + (Number(a.unidades_perdidas) || 0), 0))
    setRecuperado(resumir(rows, 'unidades_recuperadas', 'valor_recuperado_sin_iva'))
    setPerdido(resumir(rows, 'unidades_perdidas', 'valor_perdido_sin_iva'))
    setHayValorizacionRetrospectiva(rows.some((row) => row.valorizacion_metodo === 'retrospectiva_0258'))
    setHayCiclosIncompletos(rows.some((row) => !row.resultado_ciclo_completo))
    setLoading(false)
  }, [trimestreInfo, sucursalId, sucursalLoading])

  const refetch = useCallback((): Promise<void> => fetchData(), [fetchData])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return {
    vendidos,
    donaciones,
    decomisos,
    recuperado,
    perdido,
    hayValorizacionRetrospectiva,
    hayCiclosIncompletos,
    loading,
    error,
    trimestreInfo,
    refetch,
  }
}
