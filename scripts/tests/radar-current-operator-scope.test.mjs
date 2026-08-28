import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260828000170_radar_operator_current_scope_v1.sql'),
  'utf8',
)

const listarInicio = migration.indexOf('CREATE OR REPLACE FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl')
const responderInicio = migration.indexOf('CREATE OR REPLACE FUNCTION noven_private.responder_alerta_zonal_v1_impl')
assert.ok(listarInicio >= 0 && responderInicio > listarInicio, 'Deben existir ambas implementaciones endurecidas')

const listar = migration.slice(listarInicio, responderInicio)
const responder = migration.slice(responderInicio)

assert.match(listar, /FROM public\.usuarios u/, 'La bandeja debe consultar el perfil actual')
assert.match(listar, /ua\.rol = 'operador'/, 'La bandeja debe exigir rol operador')
assert.match(listar, /ua\.activo = true/, 'La bandeja debe exigir acceso operador activo')
assert.match(listar, /ufs\.familia_id = a\.familia_id/, 'La bandeja debe exigir la familia de la alerta')
assert.match(listar, /ufs\.activo = true/, 'La bandeja debe exigir familia activa')
assert.match(listar, /u\.activo = true/, 'La bandeja debe exigir perfil global activo')

assert.match(responder, /v_dest\.usuario_id IS DISTINCT FROM v_uid/, 'La alerta debe seguir perteneciendo al UID que responde')
assert.match(responder, /IF NOT EXISTS \(/, 'Responder debe tener un gate explícito de alcance actual')
assert.match(responder, /FROM public\.usuarios u/, 'Responder debe consultar el perfil actual')
assert.match(responder, /ua\.rol = 'operador'/, 'Responder debe exigir rol operador')
assert.match(responder, /ua\.activo = true/, 'Responder debe exigir acceso operador activo')
assert.match(responder, /ufs\.familia_id = v_alerta\.familia_id/, 'Responder debe exigir la familia de la alerta')
assert.match(responder, /ufs\.activo = true/, 'Responder debe exigir familia activa')
assert.match(responder, /u\.activo = true/, 'Responder debe exigir perfil global activo')

const gateIndex = responder.indexOf('IF NOT EXISTS (')
const revisarIndex = responder.indexOf("IF p_respuesta = 'revisar_despues'", gateIndex)
const noTengoIndex = responder.indexOf("IF p_respuesta = 'no_lo_tengo'", gateIndex)
assert.ok(gateIndex >= 0 && revisarIndex > gateIndex && noTengoIndex > gateIndex, 'El gate debe ocurrir antes de cualquier respuesta que escriba estado')

assert.match(
  responder,
  /REVOKE ALL ON FUNCTION noven_private\.responder_alerta_zonal_v1_impl[\s\S]*?FROM PUBLIC, anon;[\s\S]*?GRANT EXECUTE[\s\S]*?TO authenticated/,
  'Debe conservar la superficie privada necesaria para el wrapper autenticado',
)

console.log('✓ Radar Zonal revalida perfil + acceso operador + familia antes de listar o responder')
