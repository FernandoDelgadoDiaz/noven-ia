/**
 * _auth.ts — helpers HTTP compartidos por Netlify Functions.
 *
 * IMPORTANTE: este archivo NO autoriza roles ni alcances de Noven.
 * La autorización operativa vive en PostgreSQL/RLS/RPC y cada endpoint debe
 * validar la sesión/identidad del actor antes de delegar ese control a la DB.
 * Se conserva este módulo para CORS y observabilidad HTTP sin convertirlo en
 * una frontera de autorización.
 */

import type { HandlerEvent } from '@netlify/functions'
import { randomUUID } from 'node:crypto'

const ALLOWED_ORIGINS = [
  'https://noven-ia.netlify.app',
  'http://localhost:5173',
  'http://localhost:5174',
]

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
const requestIds = new WeakMap<object, string>()

type LogScalar = string | number | boolean | null | undefined

function sanitizeText(value: string, max = 500): string {
  return value
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[jwt]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/([?&](?:token|apikey|key|secret|code)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) return sanitizeText(error.message)
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    if (typeof obj.message === 'string') return sanitizeText(obj.message)
  }
  return sanitizeText(String(error))
}

function errorInfo(error: unknown): Record<string, LogScalar> {
  if (error instanceof Error) {
    return { error_name: error.name, error_message: sanitizeText(error.message) }
  }
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    const message = typeof obj.message === 'string' ? sanitizeText(obj.message) : undefined
    const code = typeof obj.code === 'string' ? sanitizeText(obj.code, 80) : undefined
    const status = typeof obj.status === 'number'
      ? obj.status
      : typeof obj.statusCode === 'number'
        ? obj.statusCode
        : undefined
    return { error_message: message, error_code: code, error_status: status }
  }
  return { error_message: sanitizeText(String(error)) }
}

function safeContext(context: Record<string, LogScalar>): Record<string, LogScalar> {
  const out: Record<string, LogScalar> = {}
  for (const [key, value] of Object.entries(context)) {
    if (!/^[a-z0-9_]{1,64}$/i.test(key) || value === undefined) continue
    out[key] = typeof value === 'string' ? sanitizeText(value, 160) : value
  }
  return out
}

export function getRequestId(event: HandlerEvent): string {
  const cached = requestIds.get(event)
  if (cached) return cached

  const inbound = event.headers['x-nf-request-id'] ?? event.headers['x-request-id'] ?? ''
  const requestId = REQUEST_ID_PATTERN.test(inbound) ? inbound : randomUUID()
  requestIds.set(event, requestId)
  return requestId
}

export function logServerError(
  event: HandlerEvent,
  scope: string,
  code: string,
  error: unknown,
  context: Record<string, LogScalar> = {},
): void {
  console.error(JSON.stringify({
    level: 'error',
    scope: sanitizeText(scope, 80),
    event: sanitizeText(code, 80),
    request_id: getRequestId(event),
    ...errorInfo(error),
    ...safeContext(context),
  }))
}

export function serverErrorPayload(event: HandlerEvent, message: string) {
  return {
    success: false,
    error: message,
    request_id: getRequestId(event),
  }
}

export function publicRpcErrorPayload(
  event: HandlerEvent,
  scope: string,
  operation: string,
  error: unknown,
  statusCode: number,
  fallback: string,
) {
  if (statusCode >= 500) {
    logServerError(event, scope, operation, error, { status_code: statusCode })
    return serverErrorPayload(event, fallback)
  }
  return { success: false, error: messageFromError(error) || fallback }
}

export function getCorsHeaders(event: HandlerEvent): Record<string, string> {
  const origin = event.headers['origin'] ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : 'https://noven-ia.netlify.app'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Expose-Headers': 'X-Request-Id',
    'X-Request-Id': getRequestId(event),
    'Vary': 'Origin',
  }
}
