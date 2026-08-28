import { useEffect, useState, type ComponentProps } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import EditarVencimientoModalSeguro from './EditarVencimientoModalSeguro'

type Props = ComponentProps<typeof EditarVencimientoModalSeguro>

/**
 * Gate de política para el modal operativo.
 *
 * Los callers más nuevos ya entregan `dias_donacion`; los antiguos pueden no
 * hacerlo. En ese caso resolvemos el valor autoritativo desde la vista de
 * seguimiento antes de montar el modal interno. Nunca se inventa 10 días.
 */
export default function EditarVencimientoModal(props: Props) {
  const recibido = props.vencimiento.dias_donacion
  const [diasDonacion, setDiasDonacion] = useState<number | null>(recibido ?? null)
  const [loading, setLoading] = useState(recibido == null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (recibido != null) {
      setDiasDonacion(recibido)
      setLoading(false)
      setError(null)
      return
    }

    let activo = true
    setLoading(true)
    setError(null)

    void supabase
      .from('v_seguimiento_rag_actual')
      .select('dias_donacion')
      .eq('vencimiento_id', props.vencimiento.id)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!activo) return
        if (queryError) {
          setDiasDonacion(null)
          setError('No se pudo resolver la política de vencimiento del producto.')
        } else if (data?.dias_donacion == null) {
          setDiasDonacion(null)
          setError('Este producto está fuera del circuito de vencimientos configurado.')
        } else {
          setDiasDonacion(Number(data.dias_donacion))
        }
        setLoading(false)
      })

    return () => { activo = false }
  }, [props.vencimiento.id, recibido])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Cargando control de vencimiento">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-modal flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
          <p className="text-sm text-muted-foreground">Cargando política del producto…</p>
        </div>
      </div>
    )
  }

  if (diasDonacion == null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Producto fuera del circuito de vencimientos">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-modal">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Sin política de vencimiento</p>
              <p className="text-sm text-muted-foreground mt-1">{error ?? 'Este producto no participa del circuito de vencimientos.'}</p>
            </div>
          </div>
          <button type="button" onClick={props.onClose} className="mt-5 w-full h-11 rounded-xl bg-brand text-white font-semibold text-sm">Cerrar</button>
        </div>
      </div>
    )
  }

  return (
    <EditarVencimientoModalSeguro
      {...props}
      vencimiento={{ ...props.vencimiento, dias_donacion: diasDonacion }}
    />
  )
}
