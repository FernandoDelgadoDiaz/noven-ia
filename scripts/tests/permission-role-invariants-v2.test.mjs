import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260828000210_role_scope_invariants_v2.sql'),
  'utf8',
)

function functionBlock(schema, name, nextSchema = '(?:public|noven_private)') {
  const match = migration.match(new RegExp(
    `CREATE OR REPLACE FUNCTION ${schema.replace('.', '\\.') }\\.${name}[\\s\\S]*?(?=CREATE OR REPLACE FUNCTION ${nextSchema}\\.|REVOKE ALL ON FUNCTION|COMMIT;)`,
  ))
  return match?.[0] ?? ''
}

const hierarchyHelper = functionBlock('noven_private', 'es_administrador_jerarquia_v1')
assert.ok(hierarchyHelper, 'debe existir helper único de jerarquía')
assert.match(hierarchyHelper, /ua_admin\.rol = 'admin_organizacion'/)
assert.match(hierarchyHelper, /ua_local\.rol = 'gerente_sucursal'/)
assert.match(hierarchyHelper, /s091\.codigo = '091'/)
assert.match(hierarchyHelper, /u\.activo = true/)

for (const name of ['tiene_acceso_sucursal', 'tiene_acceso_zona', 'puede_ver_familia_sucursal', 'listar_resumen_radar_zonal_v1_impl']) {
  const block = functionBlock('noven_private', name)
  assert.ok(block, `debe redefinir ${name}`)
  assert.doesNotMatch(block, /admin_organizacion/, `${name}: admin_organizacion no debe ampliar datos operativos`)
}

const branchAccess = functionBlock('noven_private', 'tiene_acceso_sucursal')
assert.match(branchAccess, /ua\.rol = 'gerente_zonal' AND ua\.zona_id = s\.zona_id/)
assert.match(branchAccess, /ua\.rol IN \('gerente_sucursal', 'supervisor', 'operador'\)[\s\S]*?ua\.sucursal_id = s\.id/)

const familyAccess = functionBlock('noven_private', 'puede_ver_familia_sucursal')
assert.match(familyAccess, /ua\.rol = 'gerente_zonal' AND ua\.zona_id = s\.zona_id/)
assert.match(familyAccess, /ua\.rol IN \('gerente_sucursal', 'supervisor'\)[\s\S]*?ua\.sucursal_id = s\.id/)
assert.match(familyAccess, /ua\.rol = 'operador'[\s\S]*?usuario_familias_sucursal/)

const radar = functionBlock('noven_private', 'listar_resumen_radar_zonal_v1_impl')
assert.match(radar, /ua\.rol = 'gerente_zonal' AND ua\.zona_id = a\.zona_id/)
assert.match(radar, /ua\.rol IN \('gerente_sucursal', 'supervisor'\)[\s\S]*?ua\.sucursal_id = a\.sucursal_origen_id/)

const replaceImage = functionBlock('noven_private', 'puede_reemplazar_imagen_producto')
assert.match(replaceImage, /ua\.rol IN \('gerente_sucursal', 'supervisor'\)/)
assert.doesNotMatch(replaceImage, /gerente_zonal|admin_organizacion/,
  'zonal y jerarquía no deben escribir imágenes por su rol superior')

for (const name of ['listar_admin_sucursal_v1', 'guardar_usuario_sucursal_admin_v1']) {
  const block = functionBlock('public', name)
  assert.ok(block, `debe redefinir ${name}`)
  assert.match(block, /ua\.rol='?gerente_sucursal'?|ua\.rol = 'gerente_sucursal'/)
  assert.match(block, /ua\.sucursal_id=p_sucursal_id|ua\.sucursal_id = p_sucursal_id/)
  assert.doesNotMatch(block, /gerente_zonal|admin_organizacion/,
    `${name}: sólo gerente de la sucursal debe administrar localmente`)
}

const localInvite = functionBlock('public', 'registrar_invitacion_local_v1')
assert.ok(localInvite)
assert.match(localInvite, /INSERT INTO public\.usuarios\(id,nombre,rol,sucursal_id,activo\)/,
  'invitación local debe crear el perfil público pendiente')
assert.match(localInvite, /VALUES\(p_usuario_id,btrim\(p_nombre\),p_rol,p_sucursal_id,false\)/,
  'perfil local debe nacer inactivo')
assert.match(localInvite, /INSERT INTO public\.usuario_accesos[\s\S]*?VALUES\(p_usuario_id,v_org,p_rol,NULL,p_sucursal_id,false\)/,
  'acceso local debe nacer inactivo')
assert.doesNotMatch(localInvite, /PERFORM public\.guardar_usuario_sucursal_admin_v1/,
  'alta nueva no debe depender de la RPC que exige acceso existente')
assert.doesNotMatch(localInvite, /gerente_zonal|admin_organizacion/,
  'zonal/jerarquía no crean Supervisor u Operador fuera del gerente local')

const hierarchyContext = functionBlock('public', 'listar_contexto_altas_v1')
assert.match(hierarchyContext, /es_administrador_jerarquia_v1\(p_actor_id,ua\.organizacion_id\)/)
assert.doesNotMatch(hierarchyContext, /gerente_zonal/,
  'zonal no debe listar contexto de administración jerárquica')

const hierarchyInvite = functionBlock('public', 'registrar_invitacion_acceso_v1')
assert.match(hierarchyInvite, /es_administrador_jerarquia_v1\(p_actor_id,v_org\)/)
assert.doesNotMatch(hierarchyInvite, /ua\.rol='gerente_zonal'|ua\.rol = 'gerente_zonal'/,
  'zonal no debe crear gerentes')

const invitationManage = functionBlock('noven_private', 'puede_gestionar_invitacion_v1')
assert.match(invitationManage, /ia\.rol IN \('gerente_zonal','gerente_sucursal'\)[\s\S]*?es_administrador_jerarquia_v1/)
assert.match(invitationManage, /ia\.rol IN \('supervisor','operador'\)[\s\S]*?ua_local\.rol='gerente_sucursal'/)
assert.doesNotMatch(invitationManage, /ua_local\.rol='gerente_zonal'/)

console.log('✓ matriz de roles v2: sucursal local, zonal lectura, jerarquía exclusiva 091')
