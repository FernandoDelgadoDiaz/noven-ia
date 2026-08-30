import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboard = fs.readFileSync(new URL('../../src/pages/Dashboard.tsx', import.meta.url), 'utf8')
const hook = fs.readFileSync(new URL('../../src/hooks/useAccionesOperativas.ts', import.meta.url), 'utf8')
const historial = fs.readFileSync(new URL('../../src/pages/HistorialSeguro.tsx', import.meta.url), 'utf8')
const migrationBase = fs.readFileSync(new URL('../../supabase/migrations/20260829233000_acciones_economicas_v1.sql', import.meta.url), 'utf8')
const migrationCiclo = fs.readFileSync(new URL('../../supabase/migrations/20260830004500_resultado_ciclo_observaciones_v2.sql', import.meta.url), 'utf8')
const migrationIndices = fs.readFileSync(new URL('../../supabase/migrations/20260830005000_resultado_ciclo_indices_v1.sql', import.meta.url), 'utf8')

assert.match(dashboard, /nivel_riesgo === 'radar'/, 'Radar debe formar parte del riesgo económico actual')
assert.match(dashboard, /Recuperadas por venta/, 'el Dashboard debe identificar venta como recuperación')
assert.match(dashboard, /Perdidas · donación \+ decomiso/, 'donación y decomiso deben consolidarse como pérdida')

assert.match(hook, /unidades_recuperadas/, 'el resumen debe leer unidades recuperadas derivadas del ciclo')
assert.match(hook, /unidades_perdidas/, 'el resumen debe leer unidades perdidas terminales')
assert.match(hook, /valor_recuperado_sin_iva/, 'el resumen debe leer valor recuperado sin IVA')
assert.doesNotMatch(hook, /valor_economico_sin_iva/, 'el resumen no debe confundir cantidad técnica terminal con resultado completo')

assert.match(migrationBase, /'congelado_al_cierre'/, 'los cierres nuevos deben congelar costo')
assert.match(migrationCiclo, /vencimiento_observaciones/, 'el ledger debe usar todas las observaciones del ciclo')
assert.match(migrationCiclo, /lag\(e\.cantidad\)/, 'cada tramo debe comparar observaciones consecutivas')
assert.match(migrationCiclo, /greatest\(o\.cantidad_anterior-o\.cantidad,0::numeric\)/, 'las subas no deben restar ventas recuperadas')
assert.match(migrationCiclo, /operador_id/, 'cada tramo debe conservar atribución operativa')
assert.match(migrationCiclo, /v_resultado_operador_rag/, 'debe existir análisis agrupable por sucursal, operador y RAG')
assert.match(migrationCiclo, /security_invoker = true/, 'las vistas nuevas deben respetar RLS del invocador')
assert.match(migrationCiclo, /revoke all on public\.v_resultado_operador_rag from public,anon/, 'la vista por operador no debe quedar abierta a anon/public')
assert.match(migrationIndices, /acciones_operativas_sucursal_periodo_idx/, 'debe existir índice para sucursal y período')
assert.match(migrationIndices, /venc_obs_vencimiento_fecha_id_idx/, 'el orden temporal del ledger debe quedar indexado')

assert.match(historial, /Cada fila sigue el ciclo completo del vencimiento/, 'la UI debe explicar la semántica correcta del resultado')
assert.match(historial, /RAG \$\{Number\(tramo\.rag_porcentaje\)\}%/, 'la UI debe mostrar recuperación por RAG')

console.log('✓ Resultado económico usa todas las observaciones, sucursal, operador y RAG')
