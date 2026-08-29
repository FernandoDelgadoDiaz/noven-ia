from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str, expected: int = 1) -> None:
    file = ROOT / path
    source = file.read_text(encoding='utf-8')
    found = source.count(old)
    if found != expected:
        raise SystemExit(f'{path}: expected {expected}, found {found}: {old[:100]!r}')
    file.write_text(source.replace(old, new), encoding='utf-8')


def replace_last(path: str, old: str, new: str, expected_total: int) -> None:
    file = ROOT / path
    source = file.read_text(encoding='utf-8')
    found = source.count(old)
    if found != expected_total:
        raise SystemExit(f'{path}: expected total {expected_total}, found {found}: {old[:100]!r}')
    pos = source.rfind(old)
    if pos < 0:
        raise SystemExit(f'{path}: last occurrence not found: {old[:100]!r}')
    file.write_text(source[:pos] + new + source[pos + len(old):], encoding='utf-8')


replace(
    'netlify/functions/analisis.ts',
    "import { getCorsHeaders, logServerError, publicRpcErrorPayload, serverErrorPayload } from './_auth'",
    "import { getCorsHeaders, logServerError, serverErrorPayload } from './_auth'",
)
replace(
    'netlify/functions/analisis.ts',
    "    if (familiasError) {\n    logServerError(event, 'analisis', 'familias_read_failed', familiasError)\n    return json(502, serverErrorPayload(event, 'No se pudieron validar las familias.'))\n  }",
    "    if (familiasError) {\n      logServerError(event, 'analisis', 'familias_read_failed', familiasError)\n      return json(502, serverErrorPayload(event, 'No se pudieron validar las familias.'))\n    }",
)

# Hay exactamente dos retornos iguales en admin-sucursal: listar y guardar.
# Sólo el segundo corresponde a guardar_usuario_sucursal_admin_v1.
replace_last(
    'netlify/functions/admin-sucursal.ts',
    "return json(status, publicRpcErrorPayload(event, 'admin-sucursal', 'listar_admin_sucursal_failed', error, status, 'No se pudo cargar la administración de la sucursal.'))",
    "return json(status, publicRpcErrorPayload(event, 'admin-sucursal', 'guardar_usuario_sucursal_failed', error, status, 'No se pudo guardar el usuario de la sucursal.'))",
    expected_total=2,
)

# Las compensaciones de invitaciones deben quedar trazables incluso si el rollback DB falla.
replace(
    'netlify/functions/admin-invitaciones.ts',
    "      await supabase\n        .from('invitaciones_acceso')\n        .update({ estado: 'pendiente', anulada_at: null })\n        .eq('id', invitacionId)\n      logServerError(event, 'admin-invitaciones', 'auth_delete_failed', deleteError)",
    "      const { error: restoreError } = await supabase\n        .from('invitaciones_acceso')\n        .update({ estado: 'pendiente', anulada_at: null })\n        .eq('id', invitacionId)\n      if (restoreError) logServerError(event, 'admin-invitaciones', 'rollback_pending_failed', restoreError)\n      logServerError(event, 'admin-invitaciones', 'auth_delete_failed', deleteError)",
)
replace(
    'netlify/functions/admin-invitaciones.ts',
    "    await supabase\n      .from('invitaciones_acceso')\n      .update({ auth_deleted_at: new Date().toISOString() })\n      .eq('id', invitacionId)",
    "    const { error: markDeletedError } = await supabase\n      .from('invitaciones_acceso')\n      .update({ auth_deleted_at: new Date().toISOString() })\n      .eq('id', invitacionId)\n    if (markDeletedError) logServerError(event, 'admin-invitaciones', 'mark_auth_deleted_failed', markDeletedError)",
)
replace(
    'netlify/functions/admin-invitaciones.ts',
    "    await supabase\n      .from('invitaciones_acceso')\n      .update({ estado: 'pendiente', anulada_at: null })\n      .eq('id', invitacionId)\n    return jsonResponse(event, 409, {",
    "    const { error: restoreError } = await supabase\n      .from('invitaciones_acceso')\n      .update({ estado: 'pendiente', anulada_at: null })\n      .eq('id', invitacionId)\n    if (restoreError) logServerError(event, 'admin-invitaciones', 'rollback_pending_failed', restoreError)\n    return jsonResponse(event, 409, {",
)

print('observability core review fixes applied')
