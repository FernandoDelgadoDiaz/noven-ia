import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'

/**
 * Capacidad de conducción: el análisis gerencial es para gerente zonal, gerente
 * de sucursal y supervisor. El operador no genera análisis.
 *
 * Esto es UX, no seguridad. La barrera real es `netlify/functions/analisis.ts`,
 * que verifica el alcance contra `usuario_accesos` server-side y responde 403.
 * Acá alcanza con saber si el usuario tiene alguno de esos roles en algún lado:
 * la validación por sucursal exacta —y la zona, para el rol zonal— la hace el
 * servidor sobre la sucursal que se pida.
 */
export function usePuedeVerAnalisis(): { puedeVerAnalisis: boolean; loading: boolean } {
  const { tieneRol, loading, legacyMode } = useAccesosMultitenant()

  return {
    puedeVerAnalisis: legacyMode
      ? true
      : tieneRol(['gerente_zonal', 'gerente_sucursal', 'supervisor']),
    loading,
  }
}
