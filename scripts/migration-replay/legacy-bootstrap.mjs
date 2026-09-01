import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SHIM_RELATIVE_PATH =
  'supabase/migrations/20260827000285_local_replay_legacy_handle_updated_at.sql'

const SENTINEL = '-- NOVEN_EPHEMERAL_REPLAY_LEGACY_HANDLE_UPDATED_AT_V1'

export const SHIM_SQL = `${SENTINEL}
--
-- LOCAL / CI ONLY. This file must never be committed as a production migration.
-- It recreates a legacy object that existed in production before the tracked
-- migration chain but whose CREATE statement is absent from Git history.
--
-- Evidence in the repository states that productos_updated_at invoked
-- public.handle_updated_at() and that it was equivalent to set_updated_at().
-- The tracked cleanup migration later drops both objects.

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS productos_updated_at ON public.productos;
CREATE TRIGGER productos_updated_at
  BEFORE UPDATE ON public.productos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
`

function requireEphemeralReplay(env) {
  if (env.NOVEN_EPHEMERAL_REPLAY !== '1') {
    throw new Error(
      'Refusing legacy bootstrap outside an explicitly disposable replay. Set NOVEN_EPHEMERAL_REPLAY=1.',
    )
  }
}

export function prepareLegacyReplayBootstrap({ root = process.cwd(), env = process.env } = {}) {
  requireEphemeralReplay(env)

  const target = path.join(root, SHIM_RELATIVE_PATH)
  fs.mkdirSync(path.dirname(target), { recursive: true })

  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target, 'utf8')
    if (existing !== SHIM_SQL) {
      throw new Error(`Refusing to overwrite unexpected migration shim: ${target}`)
    }
    return target
  }

  fs.writeFileSync(target, SHIM_SQL, 'utf8')
  return target
}

export function cleanupLegacyReplayBootstrap({ root = process.cwd(), env = process.env } = {}) {
  requireEphemeralReplay(env)

  const target = path.join(root, SHIM_RELATIVE_PATH)
  if (!fs.existsSync(target)) return false

  const existing = fs.readFileSync(target, 'utf8')
  if (existing !== SHIM_SQL || !existing.startsWith(SENTINEL)) {
    throw new Error(`Refusing to delete unexpected migration file: ${target}`)
  }

  fs.unlinkSync(target)
  return true
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isCli) {
  const command = process.argv[2]

  if (command === 'prepare') {
    const target = prepareLegacyReplayBootstrap()
    console.log(`Prepared ephemeral replay shim: ${target}`)
  } else if (command === 'cleanup') {
    const removed = cleanupLegacyReplayBootstrap()
    console.log(removed ? 'Removed ephemeral replay shim.' : 'No ephemeral replay shim to remove.')
  } else {
    console.error('Usage: node scripts/migration-replay/legacy-bootstrap.mjs <prepare|cleanup>')
    process.exitCode = 2
  }
}
