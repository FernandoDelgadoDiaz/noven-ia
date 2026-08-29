import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrationName = '20260829033630_restore_rls_product_store_read_helper_v1.sql';
const migrationPath = path.join(migrationsDir, migrationName);

assert.ok(fs.existsSync(migrationPath), 'Debe existir la migración que restaura el helper RLS de lectura');

const executable = fs.readFileSync(migrationPath, 'utf8')
  .toLowerCase()
  .replace(/--.*$/gm, '');

assert.match(
  executable,
  /grant\s+execute\s+on\s+function\s+noven_private\.puede_leer_producto_sucursal\s*\(\s*uuid\s*,\s*uuid\s*\)\s+to\s+authenticated\s*;/,
  'authenticated debe poder evaluar el helper RLS de producto/sucursal',
);

const laterMigrations = fs.readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql') && name > migrationName)
  .sort();

for (const name of laterMigrations) {
  const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8')
    .toLowerCase()
    .replace(/--.*$/gm, '');
  assert.doesNotMatch(
    sql,
    /revoke[^;]*execute[^;]*noven_private\.puede_leer_producto_sucursal[^;]*from\s+authenticated/i,
    `${name}: no debe impedir la evaluación RLS legítima del estado local`,
  );
}

console.log('✓ helper RLS de producto/sucursal permanece ejecutable por authenticated');
