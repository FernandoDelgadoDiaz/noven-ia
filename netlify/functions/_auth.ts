/**
 * _auth.ts — helper HTTP compartido por Netlify Functions.
 *
 * IMPORTANTE: este archivo NO autoriza roles ni alcances de Noven.
 * La autorización operativa vive en PostgreSQL/RLS/RPC y cada endpoint debe
 * validar la sesión/identidad del actor antes de delegar ese control a la DB.
 * Se conserva este módulo únicamente para centralizar CORS mientras los
 * endpoints existentes mantienen su import estable.
 */

import type { HandlerEvent } from '@netlify/functions'

const ALLOWED_ORIGINS = [
  'https://noven-ia.netlify.app',
  'http://localhost:5173',
  'http://localhost:5174',
]

export function getCorsHeaders(event: HandlerEvent): Record<string, string> {
  const origin = event.headers['origin'] ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : 'https://noven-ia.netlify.app'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}
