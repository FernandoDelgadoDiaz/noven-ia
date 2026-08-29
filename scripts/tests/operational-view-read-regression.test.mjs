import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrations = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
const sql = migrations.map((name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8')).join('\n').toLowerCase().replace(/--.*$/gm, '');

assert.match(sql, /grant\s+select\s+on\s+table\s+public\.productos\s+to\s+authenticated\s*;/, 'las vistas SECURITY INVOKER requieren SELECT protegido sobre productos');
assert.match(sql, /grant\s+execute\s+on\s+function\s+noven_private\.puede_leer_producto_sucursal\s*\(\s*uuid\s*,\s*uuid\s*\)\s+to\s+authenticated\s*;/, 'producto_sucursal requiere poder evaluar su helper RLS');

console.log('✓ dependencias de lectura de vistas operativas documentadas en migraciones');
