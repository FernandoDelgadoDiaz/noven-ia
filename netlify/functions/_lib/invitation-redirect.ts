const ACTIVATION_REDIRECT_URL = 'https://noven-ia.netlify.app/activar'

export function activationRedirectUrl(): string {
  return ACTIVATION_REDIRECT_URL
}
export function validarRedirectInvitacion(actionLink: string): string {
  let redirectTo: string | null = null

  try {
    redirectTo = new URL(actionLink).searchParams.get('redirect_to')
  } catch {
    throw new Error('Supabase devolvió un enlace de invitación inválido')
  }

  if (redirectTo !== ACTIVATION_REDIRECT_URL) {
    throw new Error(
      'La configuración de Auth no autorizó el destino público de activación. No se entregó un enlace inseguro.',
    )
  }

  return actionLink
}
