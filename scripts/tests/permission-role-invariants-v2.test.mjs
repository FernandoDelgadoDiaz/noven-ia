import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const scopeMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260828000210_role_scope_invariants_v2.sql'),
  'utf8',
)
const zonalMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260828000220_zonal_read_only_boundary_v1.sql'),
  'utf8',
)

function block(source, schema, name) {
  const match = source.match(new RegExp(
    `CREATE OR REPLACE FUNCTION ${schema}\\.${name}[\\s\\S]*?\\$\\$;`,
  ))
  return match?.[0] ?? ''
}

const hierarchyHelper = block(scopeMigration, 'noven_private', 'es_administrador_jerarquia_v1')
assert.ok(hierarchyHelper, 'debe existir helper único de jerarquía')
assert.match(hierarchyHelper, /ua_admin\.rol = 'admin_organizacion'/)
assert.match(hierarchyHelper, /ua_local\.rol = 'gerente_sucursal'/)
assert.match(hierarchyHelper, /s091\.codigo = '091'/)
assert.match(hierarchyHelper, /u\.activo = true/)

// admin_organizacion no abre por sí solo sucursales ni Radar operativo.
for (const name of ['tiene_acceso_sucursal', 'tiene_acceso_zona', 'listar_resumen_radar_zonal_v1_impl']) {
  const fn = block(scopeMigration, 'noven_private', name)
  assert.ok(fn, `debe redefinir ${name}`)
  assert.doesNotMatch(fn, /admin_organizacion/, `${name}: admin_organizacion no amplía alcance operativo`)
}

const branchAccess = block(scopeMigration, 'noven_private', 'tiene_acceso_sucursal')
assert.match(branchAccess, /ua\.rol = 'gerente_zonal' AND ua\.zona_id = s\.zona_id/)
assert.match(branchAccess, /ua\.rol IN \('gerente_sucursal', 'supervisor', 'operador'\)[\s\S]*?ua\.sucursal_id = s\.id/)

const radar = block(scopeMigration, 'noven_private', 'listar_resumen_radar_zonal_v1_impl')
assert.match(radar, /ua\.rol = 'gerente_zonal' AND ua\.zona_id = a\.zona_id/)
assert.match(radar, /ua\.rol IN \('gerente_sucursal', 'supervisor'\)[\s\S]*?ua\.sucursal_id = a\.sucursal_origen_id/)

// Lectura zonal y operación local quedan separadas en la migración final.
const readFamily = block(zonalMigration, 'noven_private', 'puede_leer_familia_sucursal')
const readProduct = block(zonalMigration, 'noven_private', 'puede_leer_producto_sucursal')
const operateFamily = block(zonalMigration, 'noven_private', 'puede_ver_familia_sucursal')
const operateProduct = block(zonalMigration, 'noven_private', 'puede_ver_producto_sucursal')
assert.match(readFamily, /ua\.rol='gerente_zonal' AND ua\.zona_id=s\.zona_id/,
  'gerente zonal debe poder leer familias dentro de su zona')
assert.match(readProduct, /puede_leer_familia_sucursal/)
assert.doesNotMatch(operateFamily, /gerente_zonal|admin_organizacion/,
  'helper operativo no debe autorizar zonal ni jerarquía')
assert.match(operateFamily, /ua\.rol IN \('gerente_sucursal','supervisor'\)/)
assert.match(operateFamily, /ua\.rol='operador'[\s\S]*?usuario_familias_sucursal/)
assert.doesNotMatch(operateProduct, /gerente_zonal|admin_organizacion/)
assert.match(operateProduct, /puede_ver_familia_sucursal/)

for (const policy of [
  'producto_sucursal_select_scope',
  'vencimientos_select_scope_v1',
  'venc_obs_select_scope',
  'rag_select_scope',
  'acciones_operativas_select_scope_v1',
]) {
  assert.match(zonalMigration, new RegExp(`CREATE POLICY ${policy}[\\s\\S]*?puede_leer_producto_sucursal`),
    `${policy} debe usar helper de lectura zonal`)
}

const replaceImage = block(scopeMigration, 'noven_private', 'puede_reemplazar_imagen_producto')
assert.match(replaceImage, /ua\.rol IN \('gerente_sucursal', 'supervisor'\)/)
assert.doesNotMatch(replaceImage, /gerente_zonal|admin_organizacion/,
  'zonal y jerarquía no escriben imágenes por rol superior')

for (const name of ['listar_admin_sucursal_v1', 'guardar_usuario_sucursal_admin_v1']) {
  const fn = block(scopeMigration, 'public', name)
  assert.ok(fn, `debe redefinir ${name}`)
  assert.match(fn, /ua\.rol='?gerente_sucursal'?|ua\.rol = 'gerente_sucursal'/)
  assert.match(fn, /ua\.sucursal_id=p_sucursal_id|ua\.sucursal_id = p_sucursal_id/)
  assert.doesNotMatch(fn, /gerente_zonal|admin_organizacion/,
    `${name}: sólo gerente de esa sucursal administra localmente`)
}

const localInvite = block(scopeMigration, 'public', 'registrar_invitacion_local_v1')
assert.ok(localInvite)
assert.match(localInvite, /INSERT INTO public\.usuarios\(id,nombre,rol,sucursal_id,activo\)/)
assert.match(localInvite, /VALUES\(p_usuario_id,btrim\(p_nombre\),p_rol,p_sucursal_id,false\)/)
assert.match(localInvite, /INSERT INTO public\.usuario_accesos[\s\S]*?VALUES\(p_usuario_id,v_org,p_rol,NULL,p_sucursal_id,false\)/)
assert.doesNotMatch(localInvite, /PERFORM public\.guardar_usuario_sucursal_admin_v1/,
  'alta nueva no depende de la RPC que exige acceso existente')
assert.doesNotMatch(localInvite, /gerente_zonal|admin_organizacion/)

const hierarchyContext = block(scopeMigration, 'public', 'listar_contexto_altas_v1')
assert.match(hierarchyContext, /es_administrador_jerarquia_v1\(p_actor_id,ua\.organizacion_id\)/)
assert.doesNotMatch(hierarchyContext, /ua\.rol='gerente_zonal'|ua\.rol = 'gerente_zonal'/)

const hierarchyInvite = block(scopeMigration, 'public', 'registrar_invitacion_acceso_v1')
assert.match(hierarchyInvite, /es_administrador_jerarquia_v1\(p_actor_id,v_org\)/)
assert.doesNotMatch(hierarchyInvite, /ua\.rol='gerente_zonal'|ua\.rol = 'gerente_zonal'/)

const invitationManage = block(scopeMigration, 'noven_private', 'puede_gestionar_invitacion_v1')
assert.match(invitationManage, /ia\.rol IN \('gerente_zonal','gerente_sucursal'\)[\s\S]*?es_administrador_jerarquia_v1/)
assert.match(invitationManage, /ia\.rol IN \('supervisor','operador'\)[\s\S]*?ua_local\.rol='gerente_sucursal'/)
assert.doesNotMatch(invitationManage, /ua_local\.rol='gerente_zonal'/)

console.log('✓ matriz v2: sucursal opera local, zonal sólo lee su zona, jerarquía exclusiva 091')
