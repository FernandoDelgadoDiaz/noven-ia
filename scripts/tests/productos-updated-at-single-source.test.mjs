import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const cleanupName = '20260828000270_cleanup_productos_updated_at_trigger_v1.sql';
const cleanupPath = path.join(migrationsDir, cleanupName);

assert.ok(fs.existsSync(cleanupPath), 'Debe existir la migración que elimina el trigger updated_at duplicado de productos');

const cleanupSql = fs.readFileSync(cleanupPath, 'utf8').toLowerCase();
assert.match(cleanupSql, /drop\s+trigger\s+if\s+exists\s+productos_updated_at\s+on\s+public\.productos\s*;/, 'Debe retirar únicamente el trigger legacy productos_updated_at');
assert.match(cleanupSql, /drop\s+function\s+if\s+exists\s+public\.handle_updated_at\s*\(\s*\)\s*;/, 'Debe retirar handle_updated_at al quedar sin consumidores');
assert.doesNotMatch(cleanupSql, /\bcascade\b/i, 'La limpieza no puede usar CASCADE');
assert.doesNotMatch(cleanupSql, /drop\s+trigger[^;]*productos_set_updated_at/i, 'Debe conservar productos_set_updated_at como fuente única');

const laterMigrations = fs.readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql') && name > cleanupName)
  .sort();

for (const name of laterMigrations) {
  const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8').toLowerCase();
  assert.doesNotMatch(sql, /create\s+trigger\s+productos_updated_at\b/, `${name}: no debe reintroducir el trigger legacy productos_updated_at`);
  assert.doesNotMatch(sql, /execute\s+function\s+(public\.)?handle_updated_at\s*\(/, `${name}: no debe volver a usar handle_updated_at`);
}

console.log('✓ productos usa una sola fuente updated_at y el helper legacy no puede reaparecer');
