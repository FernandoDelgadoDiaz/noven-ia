import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260908103000_intervenciones_explicitas_por_tipo_v1.sql',
)
const sql = fs.readFileSync(migrationPath, 'utf8')
const cuerpo = sql.replace(/^\s*--.*$/gm, '')

for (const firma of [
  /CREATE OR REPLACE FUNCTION public\.informar_oferta_central\(/,
  /CREATE OR REPLACE FUNCTION public\.finalizar_rag_vigente\(/,
  /CREATE OR REPLACE FUNCTION public\.finalizar_oferta_central\(/,
]) {
  assert.match(cuerpo, firma, 'cada transicion visible debe tener una RPC explicita')
}

assert.match(
  cuerpo,
  /INSERT INTO public\.intervenciones_rag\([\s\S]{0,500}?'oferta_central', NULL, v_cantidad, v_vmd/,
  'informar oferta central crea su propio tipo, sin inventar porcentaje y con stock conocido',
)
assert.match(
  cuerpo,
  /WHERE r\.vencimiento_id = p_vencimiento_id\s*\n\s*AND r\.tipo = 'oferta_central'\s*\n\s*AND r\.finalizado_at IS NULL\s*\n\s*FOR UPDATE;[\s\S]{0,100}?IF FOUND THEN\s*\n\s*RETURN v_intervencion_id;/,
  'informar oferta central es idempotente y no mueve el inicio ante doble click',
)

const finalizador = cuerpo.match(
  /CREATE OR REPLACE FUNCTION noven_private\.finalizar_intervencion_por_tipo_impl[\s\S]*?\$function\$;/,
)?.[0] ?? ''
assert.ok(finalizador, 'falta el finalizador interno acotado por tipo')
assert.match(finalizador, /actual\.tipo = p_tipo/)
assert.match(finalizador, /actual\.finalizado_at IS NULL/)
assert.doesNotMatch(
  finalizador,
  /UPDATE public\.intervenciones_rag[\s\S]*?WHERE vencimiento_id = p_vencimiento_id\s*;/,
  'una finalizacion nunca puede alcanzar todos los tipos del vencimiento',
)

assert.match(
  cuerpo,
  /public\.finalizar_rag_vigente[\s\S]{0,500}?p_vencimiento_id, 'rag', p_motivo, p_nota/,
  'Finalizar RAG fija tipo=rag del lado servidor',
)
assert.match(
  cuerpo,
  /public\.finalizar_oferta_central[\s\S]{0,500}?p_vencimiento_id, 'oferta_central', 'decision_comercial', p_nota/,
  'Finalizar oferta central fija su tipo del lado servidor',
)

const compatibilidad = cuerpo.match(
  /CREATE OR REPLACE FUNCTION public\.registrar_control_vencimiento_dashboard_invoker_v1[\s\S]*?\$function\$;/,
)?.[0] ?? ''
assert.ok(compatibilidad, 'falta asegurar el cliente anterior durante el despliegue')
assert.match(
  compatibilidad,
  /WHERE r\.vencimiento_id = p_vencimiento_id\s*\n\s*AND r\.tipo = 'rag'\s*\n\s*AND r\.finalizado_at IS NULL/,
  'el comando legacy Finalizar RAG tambien debe seleccionar solamente el RAG',
)

for (const rpc of [
  'informar_oferta_central',
  'finalizar_rag_vigente',
  'finalizar_oferta_central',
]) {
  assert.match(
    cuerpo,
    new RegExp(`REVOKE ALL ON FUNCTION public\\.${rpc}\\([\\s\\S]{0,120}?FROM PUBLIC, anon;`),
    `${rpc} no puede abrir superficie anonima`,
  )
  assert.match(
    cuerpo,
    new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\([\\s\\S]{0,120}?TO authenticated;`),
    `${rpc} debe ser utilizable por el cliente autenticado`,
  )
}

for (const prohibido of ['p_aplicado_at', 'p_finalizado_at', 'p_fecha_inicio', 'p_fecha_fin']) {
  assert.equal(
    cuerpo.includes(prohibido),
    false,
    `${prohibido} permitiria retrotraer una verdad que solo nace con el click`,
  )
}

console.log('✓ C2A abre y cierra RAG/oferta central por tipo, sin inferencia ni cierre cruzado')
