interface AuthAdminError {
  code?: string
}

interface AuthAdminLookup {
  getUserById: (userId: string) => Promise<{
    data: { user?: { email?: string | null } | null }
    error: AuthAdminError | null
  }>
}

const AUTH_LOOKUP_CONCURRENCY = 8

function authErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

export function esEmailDuplicadoAuth(error: unknown): boolean {
  const code = authErrorCode(error)
  return code === 'email_exists' || code === 'user_already_exists'
}

function esUsuarioAuthInexistente(error: unknown): boolean {
  return authErrorCode(error) === 'user_not_found'
}

export async function resolverEmailsAuthPorIds(
  authAdmin: AuthAdminLookup,
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)))
  const emails = new Map<string, string>()

  for (let offset = 0; offset < ids.length; offset += AUTH_LOOKUP_CONCURRENCY) {
    const lote = ids.slice(offset, offset + AUTH_LOOKUP_CONCURRENCY)
    await Promise.all(lote.map(async (userId) => {
      const { data, error } = await authAdmin.getUserById(userId)
      if (error) {
        // Conserva el comportamiento anterior para identidades ya eliminadas:
        // el usuario local sigue visible, pero sin email de Auth.
        if (esUsuarioAuthInexistente(error)) {
          emails.set(userId, '')
          return
        }
        throw error
      }
      emails.set(userId, data.user?.email ?? '')
    }))
  }

  return emails
}
