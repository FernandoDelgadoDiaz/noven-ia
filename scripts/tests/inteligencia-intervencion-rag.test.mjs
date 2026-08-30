import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const migrationPath = path.resolve('supabase/migrations/20260830013000_inteligencia_intervencion_rag_v1.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

assert.match(sql, /create or replace view public\.v_efectividad_intervencion_rag/i);
assert.match(sql, /create or replace view public\.v_efectividad_rag_resumen/i);
assert.match(sql, /create or replace view public\.v_efectividad_rag_operador/i);
assert.match(sql, /with \(security_invoker = true\)/i);
assert.match(sql, /greatest\(anterior\.cantidad_comprometida - ultima\.cantidad_comprometida, 0::numeric\)/i);
assert.match(sql, /variacion_velocidad_vs_pre/i);
assert.match(sql, /atribucion operativa, no causalidad econometrica/i);
assert.match(sql, /when count\(\*\) < 5 then 'insuficiente'/i);
assert.match(sql, /when count\(\*\) < 15 then 'inicial'/i);
assert.match(sql, /when count\(\*\) < 30 then 'moderada'/i);
assert.match(sql, /else 'alta'/i);
assert.match(sql, /count\(\*\) >= 15/i);
assert.match(sql, />= 8/i);
assert.match(sql, /revoke all on public\.v_efectividad_intervencion_rag from public, anon/i);
assert.match(sql, /revoke all on public\.v_efectividad_rag_resumen from public, anon/i);
assert.match(sql, /revoke all on public\.v_efectividad_rag_operador from public, anon/i);
assert.doesNotMatch(sql, /create\s+(or\s+replace\s+)?function\s+public\./i, 'No debe ampliar superficie RPC/browser');

console.log('inteligencia-intervencion-rag: OK');
