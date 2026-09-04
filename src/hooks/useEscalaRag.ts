import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { EscalonEscala } from '@/lib/ragCobertura'

/**
 * Escala de descuentos RAG autorizados de la organización del usuario.
 *
 * No se filtra por organización a mano: la política RLS de
 * `rag_escala_descuento` ya la acota por `tiene_acceso_organizacion`. Filtrar
 * además desde el cliente daría la impresión de que la seguridad depende de
 * este `select`, y no es así.
 *
 * Una organización sin escala cargada devuelve `[]`, y con eso el motor no
 * sugiere nada. Es el comportamiento correcto: sin escala no hay porcentaje
 * autorizado que proponer, y `RISK_AND_RAG_RULES_V1` §7 prohíbe inventar uno.
 */
export function useEscalaRag(): { escala: EscalonEscala[]; cargando: boolean } {
  const [escala, setEscala] = useState<EscalonEscala[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true

    void supabase
      .from('rag_escala_descuento')
      .select('escalon, porcentaje')
      .order('escalon', { ascending: true })
      .then(({ data, error }) => {
        if (!activo) return
        if (error) {
          // Sin escala no se sugiere; no es un error que deba romper la pantalla.
          console.error('[useEscalaRag] no se pudo leer la escala:', error)
          setEscala([])
        } else {
          setEscala((data ?? []).map((r) => ({
            escalon: Number(r.escalon),
            porcentaje: Number(r.porcentaje),
          })))
        }
        setCargando(false)
      })

    return () => { activo = false }
  }, [])

  return { escala, cargando }
}
