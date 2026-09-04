import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useEscalaRag } from '@/hooks/useEscalaRag'
import { coberturaComoPorcentaje, evaluarSugerencia } from '@/lib/ragCobertura'

interface SeguimientoRagRow {
  vencimiento_id: string
  rag_porcentaje: number | null
  cantidad_base_rag: number | null
  cantidad_observada: number | null
  unidades_vendidas_observadas: number | null
  dias_observados: number | null
  velocidad_observada: number | null
  velocidad_necesaria: number | null
  dias_comerciales_restantes: number | null
  dias_desde_ultimo_rag: number | null
  estado_seguimiento_rag: string | null
}

interface RagSeguimientoBadgeProps {
  vencimientoId: string
  activo: boolean
}

interface Presentacion {
  titulo: string
  detalle: string
  className: string
  Icono: typeof Activity
}

function numero(value: number | null, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('es-AR', { maximumFractionDigits: decimals })
}

function presentacion(row: SeguimientoRagRow): Presentacion {
  const recuperadas = numero(row.unidades_vendidas_observadas)
  const velocidad = numero(row.velocidad_observada)
  const necesaria = numero(row.velocidad_necesaria)

  switch (row.estado_seguimiento_rag) {
    case 'efectivo':
    case 'efectivo_por_vmd':
      return {
        titulo: 'Intervención funcionando',
        detalle: `${recuperadas} un recuperadas · salida ${velocidad} un/día · requerida ${necesaria}`,
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        Icono: CheckCircle2,
      }
    case 'insuficiente':
    case 'sin_movimiento':
      return {
        titulo: 'Revisar intervención',
        detalle: row.estado_seguimiento_rag === 'sin_movimiento'
          ? 'Sin reducción observada. Revisar o escalar la decisión comercial.'
          : `Salida ${velocidad} un/día · requerida ${necesaria}. Revisar o escalar.`,
        className: 'bg-amber-50 text-amber-900 border-amber-200',
        Icono: AlertTriangle,
      }
    case 'pendiente_control_operador':
      return {
        titulo: 'Control pendiente',
        detalle: 'Todavía no hay evidencia posterior suficiente. Registrar un control para medir la respuesta.',
        className: 'bg-sky-50 text-sky-800 border-sky-200',
        Icono: Clock3,
      }
    case 'dato_a_revisar':
      return {
        titulo: 'Dato a revisar',
        detalle: 'La cantidad observada aumentó respecto del inicio del RAG. Verificar el lote antes de decidir.',
        className: 'bg-rose-50 text-rose-800 border-rose-200',
        Icono: AlertTriangle,
      }
    case 'donacion':
    case 'decomiso':
      return {
        titulo: 'Ventana comercial cerrada',
        detalle: 'El RAG ya no debe evaluarse como intervención comercial. Resolver el estado operativo correspondiente.',
        className: 'bg-rose-50 text-rose-800 border-rose-200',
        Icono: AlertTriangle,
      }
    default:
      return {
        titulo: 'Seguimiento RAG',
        detalle: 'Noven todavía no tiene evidencia suficiente para evaluar esta intervención.',
        className: 'bg-slate-50 text-slate-700 border-slate-200',
        Icono: Activity,
      }
  }
}

export default function RagSeguimientoBadge({ vencimientoId, activo }: RagSeguimientoBadgeProps) {
  const [row, setRow] = useState<SeguimientoRagRow | null>(null)
  const { escala } = useEscalaRag()

  useEffect(() => {
    let cancelado = false

    if (!activo) {
      setRow(null)
      return () => { cancelado = true }
    }

    void supabase
      .from('v_seguimiento_rag_actual')
      .select('vencimiento_id, rag_porcentaje, cantidad_base_rag, cantidad_observada, unidades_vendidas_observadas, dias_observados, velocidad_observada, velocidad_necesaria, dias_comerciales_restantes, dias_desde_ultimo_rag, estado_seguimiento_rag')
      .eq('vencimiento_id', vencimientoId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado || error || !data) return
        setRow(data as unknown as SeguimientoRagRow)
      })

    return () => { cancelado = true }
  }, [activo, vencimientoId])

  const info = useMemo(() => row ? presentacion(row) : null, [row])

  // La sugerencia se calcula con el mismo motor determinístico que usa la
  // pantalla de Control: una sola fuente para el número que ve el operador.
  const sugerencia = useMemo(() => {
    if (!row) return null
    return evaluarSugerencia({
      estado: row.estado_seguimiento_rag,
      velocidadObservada: row.velocidad_observada,
      velocidadNecesaria: row.velocidad_necesaria,
      diasComercialesRestantes: row.dias_comerciales_restantes,
      diasObservados: row.dias_observados,
      diasDesdeUltimoRag: row.dias_desde_ultimo_rag,
      ragPorcentaje: row.rag_porcentaje,
    }, escala)
  }, [row, escala])

  if (!activo || !info) return null

  const { Icono } = info
  const muestraCobertura = sugerencia?.cobertura != null

  return (
    <div className={`mx-3.5 md:mx-4 mb-2 rounded-xl border px-2.5 py-2 ${info.className}`}>
      <div className="flex items-start gap-2">
        <Icono className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold leading-tight">{info.titulo}</p>
          <p className="text-[10px] leading-snug mt-0.5 opacity-90">
            {info.detalle}
            {muestraCobertura && ` · cobertura ${coberturaComoPorcentaje(sugerencia.cobertura)}`}
          </p>
          {sugerencia?.hay && (
            <p className="text-[10px] leading-snug mt-1 font-semibold">
              Sugerencia por urgencia: {sugerencia.desde}% → {sugerencia.hasta}%
              {sugerencia.topeInsuficiente
                ? ' · tope de escala, puede no alcanzar'
                : sugerencia.saltoPuedeNoAlcanzar && ' · el déficit es grande, este escalón puede no alcanzar'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
