import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrationName = '20260828000280_revoke_direct_server_table_grants_v1.sql';
const migrationPath = path.join(migrationsDir, migrationName);

assert.ok(fs.existsSync(migrationPath), 'Debe existir la migración que cierra grants directos de tablas server-only');

const executable = fs.readFileSync(migrationPath, 'utf8')
  .toLowerCase()
  .replace(/--.*$/gm, '');

for (const table of ['invitaciones_acceso', 'productos_familia_backup_20260806']) {
  assert.match(
    executable,
    new RegExp(`revoke\\s+all\\s+privileges\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+authenticated\\s*;`),
    `${table}: authenticated no debe conservar acceso directo`,
  );
}

assert.doesNotMatch(executable, /revoke[^;]+from\s+service_role/i, 'La migración no debe retirar el acceso server-side de service_role');
assert.doesNotMatch(executable, /create\s+policy|alter\s+table[^;]+disable\s+row\s+level\s+security/i, 'No debe abrir RLS ni crear policies para compensar la revocación');

const laterMigrations = fs.readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql') && name > migrationName)
  .sort();

for (const name of laterMigrations) {
  const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8')
    .toLowerCase()
    .replace(/--.*$/gm, '');
  for (const table of ['invitaciones_acceso', 'productos_familia_backup_20260806']) {
    assert.doesNotMatch(
      sql,
      new RegExp(`grant[^;]+on\\s+(?:table\\s+)?public\\.${table}[^;]+to\\s+authenticated`, 'i'),
      `${name}: no debe reabrir acceso directo authenticated a ${table}`,
    );
  }
}

console.log('✓ tablas server-only permanecen sin grants directos para authenticated');
