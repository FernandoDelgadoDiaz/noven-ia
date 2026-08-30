import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboard = fs.readFileSync(new URL('../../src/pages/Dashboard.tsx', import.meta.url), 'utf8')
const hook = fs.readFileSync(new URL('../../src/hooks/useAccionesOperativas.ts', import.meta.url), 'utf8')
const historial = fs.readFileSync(new URL('../../src/pages/HistorialSeguro.tsx', import.meta.url), 'utf8')
const migrationBase = fs.readFileSync(new URL('../../supabase/migrations/20260829233000_acciones_economicas_v1.sql', import.meta.url), 'utf8')
const migrationCiclo = fs.readFileSync(new URL('../../supabase/migrations/20260830001500_resultado_ciclo_tramos_rag_v1.sql', import.meta.url), 'utf8')

assert.match(dashboard, /nivel_riesgo === 'radar'/, 'Radar debe formar parte del riesgo económico actual')
assert.match(dashboard, /const itemsAccionInmediata = data\.filter/, 'riesgo total y acción inmediata deben ser contadores separados')
assert.match(dashboard, /Recuperadas por venta/, 'el Dashboard debe identificar venta como recuperación')
assert.match(dashboard, /Perdidas · donación \+ decomiso/, 'donación y decomiso deben consolidarse como pérdida')

assert.match(hook, /unidades_recuperadas/, 'el resumen debe leer unidades recuperadas derivadas del ciclo')
assert.match(hook, /unidades_perdidas/, 'el resumen debe leer unidades perdidas terminales')
assert.match(hook, /valor_recuperado_sin_iva/, 'el resumen debe leer valor recuperado sin IVA')
assert.match(hook, /valor_perdido_sin_iva/, 'el resumen debe leer valor perdido sin IVA')
assert.doesNotMatch(hook, /valor_economico_sin_iva/, 'el resumen nuevo no debe confundir cantidad técnica terminal con resultado completo')

assert.match(migrationBase, /'congelado_al_cierre'/, 'los nuevos cierres deben congelar el costo disponible')
assert.match(migrationBase, /'retrospectiva_0258'/, 'los cierres históricos deben distinguir valorización retrospectiva')
assert.match(migrationCiclo, /v_resultado_vencimiento_tramos/, 'debe existir un ledger derivado por tramos')
assert.match(migrationCiclo, /rag_porcentaje/, 'cada tramo RAG debe conservar el porcentaje aplicado')
assert.match(migrationCiclo, /greatest\(r\.cantidad_inicio - coalesce\(r\.cantidad_siguiente, r\.cantidad_terminal\), 0::numeric\)/i, 'las ventas de cada tramo deben surgir de la disminución de cantidad')
assert.match(migrationCiclo, /case when a\.tipo = 'vendido' then 0::numeric else a\.cantidad::numeric end/i, 'vendido debe terminar en saldo cero mientras donación/decomiso conservan la pérdida terminal')
assert.match(migrationCiclo, /resultado_ciclo_completo/, 'el modelo debe marcar históricos que no pueden reconstruirse sin inventar datos')
assert.match(migrationCiclo, /tramos_resultado/, 'el historial debe exponer los tramos para aprender qué RAG funcionó')

assert.match(historial, /Cada fila sigue el ciclo completo del vencimiento/, 'la UI debe explicar la semántica correcta del resultado')
assert.match(historial, /RAG \$\{Number\(tramo\.rag_porcentaje\)\}%/, 'la UI debe mostrar unidades recuperadas por porcentaje RAG')
assert.match(historial, /Ciclo histórico incompleto/, 'la UI debe advertir cuando no hay evidencia suficiente')

console.log('✓ Resultado económico usa ciclo completo y atribución por tramos RAG')
