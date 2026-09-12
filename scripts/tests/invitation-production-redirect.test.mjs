import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8')

const helperSource = read('netlify/functions/_lib/invitation-redirect.ts')
const helperJavaScript = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const helper = await import(
  `data:text/javascript;base64,${Buffer.from(helperJavaScript).toString('base64')}`
)

const destino = 'https://noven-ia.netlify.app/activar'
assert.equal(helper.activationRedirectUrl(), destino)

const linkValido = `https://proyecto.supabase.co/auth/v1/verify?token=ficticio&type=invite&redirect_to=${encodeURIComponent(destino)}`
assert.equal(helper.validarRedirectInvitacion(linkValido), linkValido)

for (const link of [
  'https://proyecto.supabase.co/auth/v1/verify?token=ficticio&type=invite&redirect_to=http%3A%2F%2Flocalhost%3A3000',
  'https://proyecto.supabase.co/auth/v1/verify?token=ficticio&type=invite',
  'enlace-invalido',
]) {
  assert.throws(() => helper.validarRedirectInvitacion(link), /invitación inválido|no autorizó el destino público/)
}

for (const file of [
  'netlify/functions/admin-accesos.ts',
  'netlify/functions/admin-sucursal.ts',
  'netlify/functions/admin-invitaciones.ts',
]) {
  const source = read(file)
  assert.match(source, /activationRedirectUrl/)
  assert.match(source, /validarRedirectInvitacion/)
  assert.doesNotMatch(source, /process\.env\.URL/,
    `${file} no debe derivar la activación de una variable que puede apuntar a localhost`)
}

assert.match(read('netlify/functions/admin-accesos.ts'), /cleanup_invalid_invitation_redirect/)
assert.match(read('netlify/functions/admin-sucursal.ts'), /if \(usuarioId\) await eliminarAuthUser/)
assert.match(read('netlify/functions/admin-invitaciones.ts'), /validarRedirectInvitacion[\s\S]*?deleteUser\(data\.user\.id\)/)

console.log('✓ las invitaciones sólo se entregan con activación pública y nunca hacia localhost')
