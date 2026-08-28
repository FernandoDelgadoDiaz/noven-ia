import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const migration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260828000070_rag_policy_operational_date_v1.sql'),
  'utf8',
)
const sqlSinComentarios = migration.replace(/^\s*--.*$/gm, '')

assert.match(
  sqlSinComentarios,
  /CREATE OR REPLACE VIEW public\.v_seguimiento_rag_actual[\s\S]*?WITH \(security_invoker = true\)/,
  'la vista RAG debe conservar security_invoker',
)
assert.doesNotMatch(
  sqlSinComentarios,
  /COALESCE\(s\.dias_donacion\s*,\s*10\)/,
  'la vista RAG no puede inferir NULL -> 10',
)
assert.doesNotMatch(
  sqlSinComentarios,
  /CURRENT_DATE/i,
  'la vista RAG no debe depender de la fecha UTC de la sesión',
)
assert.match(
  sqlSinComentarios,
  /America\/Argentina\/Buenos_Aires/,
  'la fecha operativa debe resolverse en Argentina',
)
assert.match(
  sqlSinComentarios,
  /AND s\.dias_donacion IS NOT NULL/,
  'sectores sin política deben quedar fuera del seguimiento RAG',
)
assert.match(
  sqlSinComentarios,
  /\(v\.fecha_vencimiento - op\.hoy\) <= s\.dias_donacion/,
  'donación debe comparar contra la política explícita del sector',
)
assert.match(
  sqlSinComentarios,
  /GREATEST\(\(v\.fecha_vencimiento - op\.hoy\) - s\.dias_donacion, 0\)/,
  'la ventana comercial debe restar la política explícita',
)

console.log('✓ Vista RAG usa política autoritativa, security_invoker y fecha operacional Argentina')
