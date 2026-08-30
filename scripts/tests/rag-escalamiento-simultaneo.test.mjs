import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = process.cwd()
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260830130000_rag_escalamiento_simultaneo_v1.sql'),
  'utf8',
)
const push = fs.readFileSync(
  path.join(root, 'netlify/functions/enviar-push-rag-escalamiento.ts'),
  'utf8',
)

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.rag_escalamientos/, 'debe persistir el escalamiento')
assert.match(migration, /UNIQUE \(rag_id\)/, 'una misma intervención RAG no debe generar spam repetido')
assert.match(migration, /estado_seguimiento IN \('insuficiente', 'sin_movimiento'\)/, 'sólo fallos confirmados deben escalar')
assert.match(migration, /CREATE CONSTRAINT TRIGGER vencimiento_observaciones_escalamiento_rag_ct/, 'la evaluación debe estar ligada a evidencia física')
assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/, 'debe evaluar al final de la transacción para evitar falsos positivos')
assert.match(migration, /v_seguimiento_rag_actual/, 'debe reutilizar la fuente de verdad del seguimiento RAG')
assert.match(migration, /dinero_en_riesgo_sin_iva/, 'debe congelar el impacto económico del escalamiento')
assert.match(migration, /REVOKE ALL ON TABLE public\.rag_escalamientos FROM PUBLIC, anon, authenticated/, 'el ledger debe permanecer server-only')
assert.match(migration, /enviar-push-rag-escalamiento/, 'el evento debe solicitar el push específico')

assert.match(push, /WEBHOOK_SECRET/, 'el endpoint debe autenticar el webhook')
assert.match(push, /SUPABASE_SERVICE_ROLE_KEY/, 'el targeting debe resolverse server-side')
assert.match(push, /\.in\('rol', \['gerente_sucursal', 'operador'\]\)/, 'debe avisar simultáneamente a gerencia y operador')
assert.doesNotMatch(push, /\.in\('rol',[^\n]*supervisor/, 'el supervisor no fue incluido en esta decisión de producto')
assert.match(push, /usuario_familias_sucursal/, 'el operador debe ser responsable activo de la familia')
assert.match(push, /Promise\.all/, 'los envíos no deben esperar una cadena Operador -> Gerencia')
assert.match(push, /dinero_en_riesgo_sin_iva/, 'el mensaje debe poder mostrar dinero en riesgo a costo sin IVA')
assert.doesNotMatch(push, /RAG \d+% recomendado|recomendado.*RAG/i, 'el escalamiento no debe inventar un porcentaje recomendado')

console.log('✓ RAG insuficiente escala simultáneamente a operador + gerencia, sin secuencia ni porcentaje inventado')
