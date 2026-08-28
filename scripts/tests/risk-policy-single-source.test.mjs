import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const riesgo = read('src/lib/riesgo.ts')
const predictive = read('src/lib/predictive.ts')
const lista = read('src/hooks/useVencimientosLista.ts')
const form = read('src/components/scanner/VencimientoForm.tsx')
const wrapper = read('src/components/dashboard/EditarVencimientoModal.tsx')
const migration = read('supabase/migrations/20260828000060_risk_policy_single_source_v1.sql')

assert.doesNotMatch(riesgo, /UMBRAL_DONACION_LEGACY|diasDonacionLegacyPorSector/, 'riesgo.ts no debe inferir política legacy')
assert.match(riesgo, /No se puede calcular riesgo sin una política de vencimientos configurada/, 'el motor debe fallar cerrado si falta política')
assert.doesNotMatch(riesgo, /diasDonacion\s*:\s*number\s*=\s*10/, 'el motor no debe reintroducir un default de 10 días')
assert.doesNotMatch(predictive, /diasDonacionLegacyPorSector|\?\?\s*10/, 'predictive.ts no debe usar fallback de 10 días')
assert.match(predictive, /v\.dias_donacion == null/, 'predictive debe rechazar cálculo sin política')
assert.match(lista, /if \(row\.dias_donacion == null\) return null/, 'la lista debe excluir sectores fuera del circuito')
assert.match(form, /dias_donacion: diasDonacion/, 'el preview de Scanner debe usar la política recibida del backend')
assert.match(form, /Fuera del circuito de vencimientos/, 'Scanner debe explicar sectores sin política')
assert.match(wrapper, /v_seguimiento_rag_actual/, 'el modal debe resolver la política real si el caller no la transportó')
assert.match(migration, /'dias_donacion', sec\.dias_donacion/, 'Scanner RPC debe devolver la política del sector')
assert.match(migration, /sector fuera del circuito de vencimientos configurado/g, 'PostgreSQL debe bloquear escritura sin política')
assert.doesNotMatch(migration, /COALESCE\(sec\.dias_donacion,\s*10\)/, 'PostgreSQL no debe reintroducir NULL→10')

console.log('✓ Política de riesgo: DB es fuente única, NULL queda fuera y la UI falla cerrada')
