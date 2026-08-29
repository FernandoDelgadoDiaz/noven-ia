import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')

const migration = read('supabase/migrations/20260829222000_scanner_ean_global_multi_v1.sql')
const hook = read('src/hooks/useScanner.ts')
const modal = read('src/components/scanner/ScannerModal.tsx')
const source = read('src/lib/scanner-source.ts')

assert.match(migration, /producto_codigos/, 'los EAN deben vivir en el padrón global normalizado')
assert.match(migration, /NOT v_tiene_codigo_activo/, 'un alias posterior no debe reemplazar el principal')
assert.match(migration, /btrim\(COALESCE\(v_codigo_actual, ''\)\) = v_ean/, 'reescanear el mismo EAN debe ser idempotente')
assert.match(migration, /buscar_conflicto_codigos_scanner/, 'debe bloquear EAN ocupado por otro producto')
assert.doesNotMatch(migration, /^\s*ON CONFLICT\b/m, 'la carrera de unicidad no debe absorberse silenciosamente')
assert.match(migration, /IF NULLIF\(btrim\(COALESCE\(v_codigo_actual, ''\)\), ''\) IS NULL/, 'sólo el primer EAN debe espejarse al campo legacy')

assert.match(hook, /consumirLecturaCamara/, 'la búsqueda debe distinguir lectura física de texto escrito')
assert.match(hook, /!desdeCamara && !\/\^\\d\{7\}\$\//, 'la carga manual debe aceptar sólo el código interno de siete dígitos')
assert.match(hook, /El EAN se registra sólo escaneándolo con la cámara/, 'el rechazo manual debe explicar la regla')

assert.match(modal, /marcarLecturaCamara/, 'la cámara debe marcar el origen de la lectura')
assert.match(modal, /Html5QrcodeFallback onScan=\{entregarLectura\}/, 'el fallback también debe marcar la lectura de cámara')
assert.doesNotMatch(modal, /Ingresar (?:código )?manualmente/i, 'el modal de cámara no debe ofrecer escribir el EAN')
assert.match(source, /VENTANA_LECTURA_MS/, 'la marca de cámara debe caducar')
assert.match(source, /ultimaLecturaCamara = null/, 'la marca de cámara debe consumirse una sola vez')

console.log('✓ EAN global: manual sólo Cod.Art. y EAN exclusivamente desde cámara')
