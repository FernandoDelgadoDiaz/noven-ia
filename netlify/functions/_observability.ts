import type { HandlerEvent } from '@netlify/functions'

interface FunctionErrorLog {
  endpoint: string
  operation: string
  statusCode: number
  error: unknown
}

function redactLogText(value: unknown): string {
  const raw = typeof value === 'string' ? value : String(value ?? '')
  return raw
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[uuid]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[token]')
    .replace(/\b[A-Za-z0-9_-]{80,}\b/g, '[long-value]')
    .slice(0, 320)
}

function summarizeError(error: unknown): { name: string; code: string | null; message: string } {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: unknown }
    return {
      name: redactLogText(error.name || 'Error'),
      code: withCode.code == null ? null : redactLogText(withCode.code),
      message: redactLogText(error.message),
    }
  }

  if (error && typeof error === 'object') {
    const candidate = error as { name?: unknown; code?: unknown; message?: unknown }
    return {
      name: redactLogText(candidate.name ?? 'Error'),
      code: candidate.code == null ? null : redactLogText(candidate.code),
      message: redactLogText(candidate.message ?? 'Error sin mensaje'),
    }
  }

  return { name: 'Error', code: null, message: redactLogText(error) }
}

/**
 * Registra sólo fallos inesperados/server-side. No incluir body, Authorization,
 * email, nombres ni payloads del usuario en metadata: el helper redacta el error,
 * pero el contrato sigue siendo loggear el mínimo necesario para diagnosticar.
 */
export function logServerError(event: HandlerEvent, input: FunctionErrorLog): void {
  const rawRequestId = event.headers['x-nf-request-id'] ?? event.headers['x-request-id'] ?? null
  const requestId = rawRequestId == null ? null : redactLogText(rawRequestId)
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    service: 'noven-netlify-function',
    endpoint: input.endpoint,
    operation: input.operation,
    status: input.statusCode,
    request_id: requestId,
    error: summarizeError(input.error),
  }))
}
