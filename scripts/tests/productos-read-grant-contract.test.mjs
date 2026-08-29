import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrationName = '20260829033526_restore_product_catalog_read_for_authenticated_v1.sql';
const migrationPath = path.join(migrationsDir, migrationName);

assert.ok(fs.existsSync(migrationPath), 'Debe existir la migración que restaura SELECT protegido sobre productos');

const executable = fs.readFileSync(migrationPath, 'utf8')
  .toLowerCase()
  .replace(/--.*$/gm, '');

assert.match(
  executable,
  /grant\s+select\s+on\s+table\s+public\.productos\s+to\s+authenticated\s*;/,
  'authenticated necesita SELECT sobre productos para las vistas SECURITY INVOKER',
);
assert.doesNotMatch(executable, /grant\s+(?:all|insert|update|delete)/i, 'La reparación no debe reabrir escrituras directas sobre productos');

const laterMigrations = fs.readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql') && name > migrationName)
  .sort();

for (const name of laterMigrations) {
  const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8')
    .toLowerCase()
    .replace(/--.*$/gm, '');
  assert.doesNotMatch(
    sql,
    /revoke[^;]*select[^;]*on\s+(?:table\s+)?public\.productos[^;]*from\s+authenticated/i,
    `${name}: no debe romper las vistas operativas revocando SELECT sobre productos`,
  );
}

console.log('✓ productos conserva SELECT autenticado protegido por RLS');
