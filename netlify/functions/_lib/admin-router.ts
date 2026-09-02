import type { HandlerEvent, HandlerResponse } from '@netlify/functions'
import { handleAdminAccesos } from '../admin-accesos'
import { handleAdminInvitaciones } from '../admin-invitaciones'
import { handleAdminSucursal } from '../admin-sucursal'

type AdminHandler = (event: HandlerEvent) => Promise<HandlerResponse>

const handlers: Record<string, AdminHandler> = {
  '/api/admin/read/accesos': handleAdminAccesos,
  '/api/admin/write/accesos': handleAdminAccesos,
  '/api/admin/read/sucursal': handleAdminSucursal,
  '/api/admin/write/sucursal': handleAdminSucursal,
  '/api/admin/read/invitaciones': handleAdminInvitaciones,
  '/api/admin/write/invitaciones': handleAdminInvitaciones,
}

function queryParams(url: URL): {
  single: Record<string, string>
  multi: Record<string, string[]>
} {
  const single: Record<string, string> = {}
  const multi: Record<string, string[]> = {}

  for (const [key, value] of url.searchParams) {
    single[key] = value
    multi[key] = [...(multi[key] ?? []), value]
  }

  return { single, multi }
}

async function toLegacyEvent(request: Request, url: URL): Promise<HandlerEvent> {
  const headers = Object.fromEntries(request.headers.entries())
  const params = queryParams(url)

  return {
    rawUrl: request.url,
    rawQuery: url.search.slice(1),
    path: url.pathname,
    httpMethod: request.method,
    headers,
    multiValueHeaders: Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key, [value]]),
    ),
    queryStringParameters: Object.keys(params.single).length > 0 ? params.single : null,
    multiValueQueryStringParameters: Object.keys(params.multi).length > 0 ? params.multi : null,
    body: request.method === 'GET' || request.method === 'HEAD'
      ? null
      : await request.text(),
    isBase64Encoded: false,
  }
}

function toFetchResponse(response: HandlerResponse): Response {
  const headers = new Headers()
  for (const [key, value] of Object.entries(response.headers ?? {})) {
    headers.set(key, String(value))
  }
  for (const [key, values] of Object.entries(response.multiValueHeaders ?? {})) {
    for (const value of values) headers.append(key, String(value))
  }

  const body = response.statusCode === 204 ? null : (response.body ?? null)
  return new Response(body, { status: response.statusCode, headers })
}

export async function dispatchAdminRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const handler = handlers[url.pathname]
  if (!handler) {
    return Response.json(
      { success: false, error: 'Ruta administrativa inexistente' },
      { status: 404 },
    )
  }

  return toFetchResponse(await handler(await toLegacyEvent(request, url)))
}
