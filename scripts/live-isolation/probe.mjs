import assert from 'node:assert/strict'

const apiUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

assert.ok(apiUrl, 'falta URL de Supabase local')
assert.ok(anonKey, 'falta anon key local')
assert.ok(serviceRoleKey, 'falta service role key local')

const res = await fetch(`${apiUrl}/rest/v1/`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
})
assert.ok(res.ok, `PostgREST local no respondió: ${res.status}`)

console.log('✓ Supabase local levantó y PostgREST responde después del replay')
