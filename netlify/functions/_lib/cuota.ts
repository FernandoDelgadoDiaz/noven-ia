import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Cuota por actor, respaldada en Postgres.
 *
 * El actor es `auth.uid()`, no la IP: en un supermercado toda la sucursal sale
 * por una IP pública, así que un límite por IP trabaría a los operadores
 * legítimos sin frenar a quien cambie de red. La única capa que conoce al actor
 * real es la base, y por eso el contador vive ahí y no en el borde.
 *
 * El mecanismo es genérico a propósito: `analisis` es el primer consumidor, pero
 * quedan diez endpoints autenticados más sin límite (deuda D-1). Agregar uno
 * nuevo es declarar su política acá y llamar a `consumirCuota` después de
 * resolver el uid.
 */

export interface PoliticaCuota {
  endpoint: string
  limiteHora: number
  limiteDia: number
  /**
   * Qué hacer si el contador no se puede leer ni escribir.
   *
   * `cerrado` deniega la solicitud. Es el criterio correcto sólo cuando fallar
   * abierto es peor que no atender: hoy únicamente `analisis`, donde una
   * llamada sin techo significa costo ilimitado en un proveedor externo y datos
   * operativos saliendo del país.
   *
   * Para un endpoint operativo —Scanner, Dashboard— el criterio es el inverso:
   * fallar cerrado rompería la operación de la sucursal por un contador caído.
   * No copiar `cerrado` por analogía; es la excepción, no el patrón.
   */
  anteFalla: 'cerrado' | 'abierto'
}

export const CUOTA_ANALISIS: PoliticaCuota = {
  endpoint: 'analisis',
  limiteHora: 10,
  limiteDia: 20,
  anteFalla: 'cerrado',
}

export interface ResultadoCuota {
  permitido: boolean
  motivo: 'ok' | 'limite_hora' | 'limite_dia' | 'contador_no_disponible'
  consumoHora: number
  consumoDia: number
}

interface FilaCuota {
  permitido: boolean
  motivo: string
  consumo_hora: number
  consumo_dia: number
}

/**
 * Consume una unidad de cuota y decide.
 *
 * La atomicidad vive en la RPC: incremento condicional en una sola sentencia
 * por ventana. Acá no se lee para después escribir.
 */
export async function consumirCuota(
  supabase: SupabaseClient,
  politica: PoliticaCuota,
  actorId: string,
): Promise<ResultadoCuota> {
  const { data, error } = await supabase.rpc('consumir_cuota_actor_v1', {
    p_actor_id: actorId,
    p_endpoint: politica.endpoint,
    p_limite_hora: politica.limiteHora,
    p_limite_dia: politica.limiteDia,
  })

  const fila = (Array.isArray(data) ? data[0] : data) as FilaCuota | null | undefined

  if (error || !fila) {
    return {
      permitido: politica.anteFalla === 'abierto',
      motivo: 'contador_no_disponible',
      consumoHora: -1,
      consumoDia: -1,
    }
  }

  return {
    permitido: fila.permitido === true,
    motivo: (fila.motivo as ResultadoCuota['motivo']) ?? 'ok',
    consumoHora: fila.consumo_hora ?? -1,
    consumoDia: fila.consumo_dia ?? -1,
  }
}

export function mensajeCuota(resultado: ResultadoCuota): string {
  if (resultado.motivo === 'contador_no_disponible') {
    return 'No se pudo verificar el límite de uso. Reintentá en unos minutos.'
  }
  if (resultado.motivo === 'limite_dia') {
    return 'Alcanzaste el máximo de análisis por día. Volvé a intentar mañana.'
  }
  return 'Alcanzaste el máximo de análisis por hora. Volvé a intentar en un rato.'
}
