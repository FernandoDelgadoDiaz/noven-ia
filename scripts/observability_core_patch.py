from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str, expected: int = 1) -> None:
    file = ROOT / path
    source = file.read_text(encoding='utf-8')
    found = source.count(old)
    if found != expected:
        raise SystemExit(f'{path}: expected {expected} occurrence(s), found {found}: {old[:120]!r}')
    file.write_text(source.replace(old, new), encoding='utf-8')


browser_files = [
    'netlify/functions/admin-accesos.ts',
    'netlify/functions/admin-invitaciones.ts',
    'netlify/functions/admin-sucursal.ts',
    'netlify/functions/analisis.ts',
    'netlify/functions/aprender-pendientes-familia.ts',
    'netlify/functions/importar-asistido-completo.ts',
    'netlify/functions/importar-familia.ts',
    'netlify/functions/listar-pendientes-catalogo.ts',
    'netlify/functions/resolver-pendiente-catalogo.ts',
]

for path in browser_files:
    replace(
        path,
        "import { getCorsHeaders } from './_auth'",
        "import { getCorsHeaders, logServerError, publicRpcErrorPayload, serverErrorPayload } from './_auth'",
    )

# Config 5xx: request id visible, sin detalles internos.
for path in ['netlify/functions/admin-accesos.ts', 'netlify/functions/admin-invitaciones.ts']:
    replace(
        path,
        "return jsonResponse(event, 500, { success: false, error: 'Configuración de servidor incompleta' })",
        "return jsonResponse(event, 500, serverErrorPayload(event, 'Configuración de servidor incompleta'))",
    )
for path in [p for p in browser_files if p not in ['netlify/functions/admin-accesos.ts', 'netlify/functions/admin-invitaciones.ts']]:
    replace(
        path,
        "return json(500, { success: false, error: 'Configuración de servidor incompleta' })",
        "return json(500, serverErrorPayload(event, 'Configuración de servidor incompleta'))",
    )

# Los tres endpoints admin comparten validador de sesión. Una caída upstream es 502, no 401.
for path, scope, responder in [
    ('netlify/functions/admin-accesos.ts', 'admin-accesos', 'jsonResponse(event'),
    ('netlify/functions/admin-invitaciones.ts', 'admin-invitaciones', 'jsonResponse(event'),
    ('netlify/functions/admin-sucursal.ts', 'admin-sucursal', 'json'),
]:
    replace(path, "Promise<{ uid: string } | { error: string }>", "Promise<{ uid: string } | { error: string; statusCode: 401 | 502 }>")
    replace(path, "if (!token) return { error: 'No autorizado: token ausente' }", "if (!token) return { error: 'No autorizado: token ausente', statusCode: 401 }")
    replace(path, "if (!res.ok) return { error: 'No autorizado: sesión inválida o expirada' }", "if (!res.ok) return { error: 'No autorizado: sesión inválida o expirada', statusCode: 401 }")
    replace(path, "if (!user.id) return { error: 'No autorizado: usuario no resoluble' }", "if (!user.id) return { error: 'No autorizado: usuario no resoluble', statusCode: 401 }")
    replace(
        path,
        "  } catch (err) {\n    return { error: `No se pudo verificar la sesión: ${err instanceof Error ? err.message : String(err)}` }\n  }",
        f"  }} catch (err) {{\n    logServerError(event, '{scope}', 'auth_verify_failed', err)\n    return {{ error: 'No se pudo verificar la sesión.', statusCode: 502 }}\n  }}",
    )
    if responder.startswith('jsonResponse'):
        replace(
            path,
            "if ('error' in sesion) return jsonResponse(event, 401, { success: false, error: sesion.error })",
            "if ('error' in sesion) {\n    const payload = sesion.statusCode >= 500 ? serverErrorPayload(event, sesion.error) : { success: false, error: sesion.error }\n    return jsonResponse(event, sesion.statusCode, payload)\n  }",
        )
    else:
        replace(
            path,
            "if ('error' in sesion) return json(401, { success: false, error: sesion.error })",
            "if ('error' in sesion) {\n    const payload = sesion.statusCode >= 500 ? serverErrorPayload(event, sesion.error) : { success: false, error: sesion.error }\n    return json(sesion.statusCode, payload)\n  }",
        )
    replace(path, "  return 409\n}\n\nasync function validarSesion", "  return 502\n}\n\nasync function validarSesion")

# admin-accesos: RPC inesperada => 502 genérico; compensación Auth siempre trazable.
p = 'netlify/functions/admin-accesos.ts'
replace(
    p,
    "if (error) return jsonResponse(event, statusRpc(error.message), { success: false, error: error.message })",
    "if (error) {\n      const status = statusRpc(error.message)\n      return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-accesos', 'listar_contexto_altas_failed', error, status, 'No se pudo cargar el contexto de altas.'))\n    }",
)
replace(
    p,
    "  if (permisoError) {\n    return jsonResponse(event, statusRpc(permisoError.message), { success: false, error: permisoError.message })\n  }",
    "  if (permisoError) {\n    const status = statusRpc(permisoError.message)\n    return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-accesos', 'validar_contexto_altas_failed', permisoError, status, 'No se pudo validar el alcance de altas.'))\n  }",
)
replace(
    p,
    "  } catch (err) {\n    return jsonResponse(event, 502, {\n      success: false,\n      error: `No se pudo verificar el email: ${err instanceof Error ? err.message : String(err)}`,\n    })\n  }",
    "  } catch (err) {\n    logServerError(event, 'admin-accesos', 'email_lookup_failed', err)\n    return jsonResponse(event, 502, serverErrorPayload(event, 'No se pudo verificar el email.'))\n  }",
)
replace(
    p,
    "  if (registroError) {\n    // La cuenta Auth fue creada por ESTA llamada; si falla la asignación segura de\n    // alcance, compensamos para no dejar una cuenta huérfana ni con permisos parciales.\n    await supabase.auth.admin.deleteUser(usuarioId).catch(() => undefined)\n    return jsonResponse(event, statusRpc(registroError.message), {\n      success: false,\n      error: registroError.message,\n    })\n  }",
    "  if (registroError) {\n    // La cuenta Auth fue creada por ESTA llamada; si falla la asignación segura de\n    // alcance, compensamos para no dejar una cuenta huérfana ni con permisos parciales.\n    try {\n      const { error: cleanupError } = await supabase.auth.admin.deleteUser(usuarioId)\n      if (cleanupError) logServerError(event, 'admin-accesos', 'auth_cleanup_failed', cleanupError)\n    } catch (cleanupError) {\n      logServerError(event, 'admin-accesos', 'auth_cleanup_failed', cleanupError)\n    }\n    const status = statusRpc(registroError.message)\n    return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-accesos', 'registrar_invitacion_failed', registroError, status, 'No se pudo registrar la invitación.'))\n  }",
)

# admin-invitaciones: RPC + compensaciones.
p = 'netlify/functions/admin-invitaciones.ts'
replace(
    p,
    "if (error) return jsonResponse(event, statusRpc(error.message), { success: false, error: error.message })",
    "if (error) {\n      const status = statusRpc(error.message)\n      return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-invitaciones', 'listar_invitaciones_failed', error, status, 'No se pudieron listar las invitaciones.'))\n    }",
)
replace(
    p,
    "  if (detalleError) {\n    return jsonResponse(event, statusRpc(detalleError.message), { success: false, error: detalleError.message })\n  }",
    "  if (detalleError) {\n    const status = statusRpc(detalleError.message)\n    return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-invitaciones', 'obtener_invitacion_failed', detalleError, status, 'No se pudo obtener la invitación.'))\n  }",
)
replace(
    p,
    "  if (anulacionError) {\n    return jsonResponse(event, statusRpc(anulacionError.message), { success: false, error: anulacionError.message })\n  }",
    "  if (anulacionError) {\n    const status = statusRpc(anulacionError.message)\n    return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-invitaciones', 'anular_invitacion_failed', anulacionError, status, 'No se pudo anular la invitación.'))\n  }",
)
replace(
    p,
    "      return jsonResponse(event, 502, {\n        success: false,\n        error: `No se pudo limpiar la cuenta pendiente en Auth: ${deleteError.message}`,\n      })",
    "      logServerError(event, 'admin-invitaciones', 'auth_delete_failed', deleteError)\n      return jsonResponse(event, 502, serverErrorPayload(event, 'No se pudo limpiar la cuenta pendiente en Auth.'))",
)
replace(
    p,
    "  if (registroError) {\n    await supabase.auth.admin.deleteUser(nuevaAuth.usuarioId).catch(() => undefined)\n    return jsonResponse(event, statusRpc(registroError.message), {\n      success: false,\n      error: `La invitación anterior fue anulada, pero no se pudo registrar la nueva: ${registroError.message}`,\n    })\n  }",
    "  if (registroError) {\n    try {\n      const { error: cleanupError } = await supabase.auth.admin.deleteUser(nuevaAuth.usuarioId)\n      if (cleanupError) logServerError(event, 'admin-invitaciones', 'auth_cleanup_failed', cleanupError)\n    } catch (cleanupError) {\n      logServerError(event, 'admin-invitaciones', 'auth_cleanup_failed', cleanupError)\n    }\n    const status = statusRpc(registroError.message)\n    return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-invitaciones', 'registrar_invitacion_regenerada_failed', registroError, status, 'La invitación anterior fue anulada, pero no se pudo registrar la nueva.'))\n  }",
)

# admin-sucursal.
p = 'netlify/functions/admin-sucursal.ts'
replace(
    p,
    "async function eliminarAuthUser(\n  supabaseUrl: string,\n  serviceRoleKey: string,\n  userId: string,\n): Promise<void> {",
    "async function eliminarAuthUser(\n  event: HandlerEvent,\n  supabaseUrl: string,\n  serviceRoleKey: string,\n  userId: string,\n): Promise<void> {",
)
replace(
    p,
    "  if (!res.ok) {\n    console.error('[admin-sucursal] compensación Auth falló', res.status, userId)\n  }",
    "  if (!res.ok) {\n    logServerError(event, 'admin-sucursal', 'auth_cleanup_failed', new Error(`HTTP ${res.status}`), { provider_status: res.status })\n  }",
)
replace(
    p,
    "if (error) return json(statusRpc(error.message), { success: false, error: error.message })",
    "if (error) {\n      const status = statusRpc(error.message)\n      return json(status, publicRpcErrorPayload(event, 'admin-sucursal', 'listar_admin_sucursal_failed', error, status, 'No se pudo cargar la administración de la sucursal.'))\n    }",
    expected=2,
)
replace(
    p,
    "    } catch (err) {\n      return json(502, { success: false, error: err instanceof Error ? err.message : String(err) })\n    }",
    "    } catch (err) {\n      logServerError(event, 'admin-sucursal', 'listar_auth_emails_failed', err)\n      return json(502, serverErrorPayload(event, 'No se pudieron cargar los emails de Auth.'))\n    }",
)
replace(
    p,
    "    if (permisoError) return json(statusRpc(permisoError.message), { success: false, error: permisoError.message })",
    "    if (permisoError) {\n      const status = statusRpc(permisoError.message)\n      return json(status, publicRpcErrorPayload(event, 'admin-sucursal', 'validar_admin_sucursal_failed', permisoError, status, 'No se pudo validar el alcance de administración.'))\n    }",
)
replace(
    p,
    "    } catch (err) {\n      return json(502, {\n        success: false,\n        error: `No se pudo verificar el email: ${err instanceof Error ? err.message : String(err)}`,\n      })\n    }",
    "    } catch (err) {\n      logServerError(event, 'admin-sucursal', 'email_lookup_failed', err)\n      return json(502, serverErrorPayload(event, 'No se pudo verificar el email.'))\n    }",
)
replace(p, "await eliminarAuthUser(supabaseUrl, serviceRoleKey, usuarioId)", "await eliminarAuthUser(event, supabaseUrl, serviceRoleKey, usuarioId)")
replace(
    p,
    "      return json(statusRpc(registroError.message), { success: false, error: registroError.message })",
    "      const status = statusRpc(registroError.message)\n      return json(status, publicRpcErrorPayload(event, 'admin-sucursal', 'registrar_invitacion_local_failed', registroError, status, 'No se pudo registrar la invitación local.'))",
)

# Análisis IA: 5xx internos quedan correlacionados y no se devuelve detalle técnico.
p = 'netlify/functions/analisis.ts'
replace(
    p,
    "  } catch (err) {\n    return json(502, { success: false, error: `No se pudo validar la sesión: ${err instanceof Error ? err.message : String(err)}` })\n  }",
    "  } catch (err) {\n    logServerError(event, 'analisis', 'auth_verify_failed', err)\n    return json(502, serverErrorPayload(event, 'No se pudo validar la sesión.'))\n  }",
)
for old, code, public in [
    ("if (perfilError) return json(502, { success: false, error: `No se pudo validar el perfil: ${perfilError.message}` })", 'perfil_read_failed', 'No se pudo validar el perfil.'),
    ("if (sucursalError) return json(502, { success: false, error: `No se pudo validar la sucursal: ${sucursalError.message}` })", 'sucursal_read_failed', 'No se pudo validar la sucursal.'),
    ("if (accesosError) return json(502, { success: false, error: `No se pudo validar el alcance: ${accesosError.message}` })", 'accesos_read_failed', 'No se pudo validar el alcance.'),
    ("if (familiasError) return json(502, { success: false, error: `No se pudieron validar las familias: ${familiasError.message}` })", 'familias_read_failed', 'No se pudieron validar las familias.'),
    ("if (vErr) return json(502, { success: false, error: `Error al leer vencimientos: ${vErr.message}` })", 'vencimientos_read_failed', 'No se pudieron leer los vencimientos.'),
    ("if (ragError) return json(502, { success: false, error: `Error al leer seguimiento RAG: ${ragError.message}` })", 'rag_read_failed', 'No se pudo leer el seguimiento RAG.'),
]:
    var = {'perfil_read_failed':'perfilError','sucursal_read_failed':'sucursalError','accesos_read_failed':'accesosError','familias_read_failed':'familiasError','vencimientos_read_failed':'vErr','rag_read_failed':'ragError'}[code]
    replace(p, old, f"if ({var}) {{\n    logServerError(event, 'analisis', '{code}', {var})\n    return json(502, serverErrorPayload(event, '{public}'))\n  }}")
replace(
    p,
    "  if (accActualError || accAnteriorError) {\n    return json(502, { success: false, error: `Error al leer historial: ${(accActualError ?? accAnteriorError)?.message}` })\n  }",
    "  if (accActualError || accAnteriorError) {\n    const historyError = accActualError ?? accAnteriorError\n    logServerError(event, 'analisis', 'historial_read_failed', historyError)\n    return json(502, serverErrorPayload(event, 'No se pudo leer el historial operativo.'))\n  }",
)
replace(
    p,
    "      console.error('[analisis] DeepSeek error', dsRes.status, await dsRes.text().catch(() => ''))\n      return json(502, { success: false, error: `Error del modelo de análisis (${dsRes.status})` })",
    "      logServerError(event, 'analisis', 'model_http_failed', new Error(`HTTP ${dsRes.status}`), { provider_status: dsRes.status })\n      return json(502, serverErrorPayload(event, `Error del modelo de análisis (${dsRes.status})`))",
)
replace(
    p,
    "    if (!contenido) return json(502, { success: false, error: 'El modelo no devolvió contenido' })",
    "    if (!contenido) {\n      logServerError(event, 'analisis', 'model_empty_response', new Error('empty model response'))\n      return json(502, serverErrorPayload(event, 'El modelo no devolvió contenido'))\n    }",
)
replace(
    p,
    "  } catch (err) {\n    return json(502, { success: false, error: `Error al contactar el modelo: ${err instanceof Error ? err.message : String(err)}` })\n  }",
    "  } catch (err) {\n    logServerError(event, 'analisis', 'model_request_failed', err)\n    return json(502, serverErrorPayload(event, 'Error al contactar el modelo.'))\n  }",
)

# Importación por familia: 5xx de lectura internos no salen al navegador.
p = 'netlify/functions/importar-familia.ts'
replace(
    p,
    "  } catch (err) {\n    const msg = err instanceof Error ? err.message : String(err)\n    return json(502, { success: false, error: `No se pudo verificar la sesión: ${msg}` })\n  }",
    "  } catch (err) {\n    logServerError(event, 'importar-familia', 'auth_verify_failed', err)\n    return json(502, serverErrorPayload(event, 'No se pudo verificar la sesión.'))\n  }",
)
replace(
    p,
    "  if (perfilActorError || sucursalActorError) {\n    return json(502, { success: false, error: 'No se pudo validar el alcance de la importación.' })\n  }",
    "  if (perfilActorError || sucursalActorError) {\n    logServerError(event, 'importar-familia', 'scope_lookup_failed', perfilActorError ?? sucursalActorError)\n    return json(502, serverErrorPayload(event, 'No se pudo validar el alcance de la importación.'))\n  }",
)
replace(
    p,
    "  if (accesosActorError) {\n    return json(502, { success: false, error: 'No se pudo validar el permiso de importación.' })\n  }",
    "  if (accesosActorError) {\n    logServerError(event, 'importar-familia', 'access_lookup_failed', accesosActorError)\n    return json(502, serverErrorPayload(event, 'No se pudo validar el permiso de importación.'))\n  }",
)
for old, errvar, code, public in [
    ("      return json(502, { success: false, error: `No se pudo reconstruir la reconciliación: ${(errCod ?? errEan)?.message}` })", 'errCod ?? errEan', 'catalog_reconciliation_read_failed', 'No se pudo reconstruir la reconciliación.'),
    ("    return json(502, { success: false, error: `No se pudo cargar el catálogo de la familia: ${errPorFamilia.message}` })", 'errPorFamilia', 'family_catalog_read_failed', 'No se pudo cargar el catálogo de la familia.'),
    ("      return json(502, { success: false, error: `No se pudo cargar el estado local: ${errEstados.message}` })", 'errEstados', 'local_state_read_failed', 'No se pudo cargar el estado local.'),
]:
    indent = '      ' if old.startswith('      ') else '    '
    replace(p, old, f"{indent}logServerError(event, 'importar-familia', '{code}', {errvar})\n{indent}return json(502, serverErrorPayload(event, '{public}'))")
replace(
    p,
    "    console.error('[importar-familia] RPC error:', errAplicado)\n    const status = /permiso|sucursal|familia/i.test(errAplicado.message) ? 403 : 409\n    return json(status, { success: false, error: errAplicado.message })",
    "    const status = /permiso|sucursal|familia/i.test(errAplicado.message) ? 403 : 409\n    logServerError(event, 'importar-familia', 'apply_import_failed', errAplicado, { status_code: status })\n    return json(status, publicRpcErrorPayload(event, 'importar-familia', 'apply_import_failed', errAplicado, status, 'No se pudo aplicar la importación.'))",
)

# Importación masiva.
p = 'netlify/functions/importar-asistido-completo.ts'
replace(
    p,
    "  } catch (err) {\n    const msg = err instanceof Error ? err.message : String(err)\n    return json(502, { success: false, error: `No se pudo verificar la sesión: ${msg}` })\n  }",
    "  } catch (err) {\n    logServerError(event, 'importar-asistido-completo', 'auth_verify_failed', err)\n    return json(502, serverErrorPayload(event, 'No se pudo verificar la sesión.'))\n  }",
)
replace(
    p,
    "  if (gateError) {\n    return json(502, { success: false, error: 'No se pudo validar el alcance de la importación.' })\n  }",
    "  if (gateError) {\n    logServerError(event, 'importar-asistido-completo', 'scope_gate_failed', gateError)\n    return json(502, serverErrorPayload(event, 'No se pudo validar el alcance de la importación.'))\n  }",
)
replace(
    p,
    "    console.error('[importar-asistido-completo] RPC error:', error)\n    const status = error.message.includes('permiso') ? 403 : 502\n    return json(status, { success: false, error: error.message })",
    "    const status = error.message.includes('permiso') ? 403 : 502\n    return json(status, publicRpcErrorPayload(event, 'importar-asistido-completo', 'apply_import_failed', error, status, 'No se pudo aplicar la importación masiva.'))",
)

# Aprendizaje de catálogo.
p = 'netlify/functions/aprender-pendientes-familia.ts'
replace(
    p,
    "  } catch (err) {\n    const msg = err instanceof Error ? err.message : String(err)\n    return json(502, { success: false, error: `No se pudo verificar la sesión: ${msg}` })\n  }",
    "  } catch (err) {\n    logServerError(event, 'aprender-pendientes-familia', 'auth_verify_failed', err)\n    return json(502, serverErrorPayload(event, 'No se pudo verificar la sesión.'))\n  }",
)
replace(
    p,
    "  if (gateError) {\n    return json(502, { success: false, error: 'No se pudo validar el alcance para aprender catálogo.' })\n  }",
    "  if (gateError) {\n    logServerError(event, 'aprender-pendientes-familia', 'scope_gate_failed', gateError)\n    return json(502, serverErrorPayload(event, 'No se pudo validar el alcance para aprender catálogo.'))\n  }",
)
replace(
    p,
    "    console.error('[aprender-pendientes-familia] RPC error:', error)\n    const status = /alcance|permiso|familia|sucursal/i.test(error.message) ? 403 : 409\n    return json(status, { success: false, error: error.message })",
    "    const status = /alcance|permiso|familia|sucursal/i.test(error.message) ? 403 : 409\n    logServerError(event, 'aprender-pendientes-familia', 'resolve_pending_failed', error, { status_code: status })\n    return json(status, publicRpcErrorPayload(event, 'aprender-pendientes-familia', 'resolve_pending_failed', error, status, 'No se pudo aprender el catálogo.'))",
)

# Listado de pendientes.
p = 'netlify/functions/listar-pendientes-catalogo.ts'
replace(
    p,
    "  } catch (err) {\n    const msg = err instanceof Error ? err.message : String(err)\n    return json(502, { success: false, error: `No se pudo verificar la sesión: ${msg}` })\n  }",
    "  } catch (err) {\n    logServerError(event, 'listar-pendientes-catalogo', 'auth_verify_failed', err)\n    return json(502, serverErrorPayload(event, 'No se pudo verificar la sesión.'))\n  }",
)
replace(
    p,
    "    console.error('[listar-pendientes-catalogo] RPC error:', error)\n    const status = /alcance|permiso/i.test(error.message) ? 403 : 502\n    return json(status, { success: false, error: error.message })",
    "    const status = /alcance|permiso/i.test(error.message) ? 403 : 502\n    return json(status, publicRpcErrorPayload(event, 'listar-pendientes-catalogo', 'list_pending_failed', error, status, 'No se pudieron cargar los pendientes de catálogo.'))",
)

# Resolución de pendientes.
p = 'netlify/functions/resolver-pendiente-catalogo.ts'
replace(
    p,
    "  } catch (err) {\n    const msg = err instanceof Error ? err.message : String(err)\n    return json(502, { success: false, error: `No se pudo verificar la sesión: ${msg}` })\n  }",
    "  } catch (err) {\n    logServerError(event, 'resolver-pendiente-catalogo', 'auth_verify_failed', err)\n    return json(502, serverErrorPayload(event, 'No se pudo verificar la sesión.'))\n  }",
)
replace(
    p,
    "  if (gateError) {\n    return json(502, { success: false, error: 'No se pudo validar el alcance de clasificación.' })\n  }",
    "  if (gateError) {\n    logServerError(event, 'resolver-pendiente-catalogo', 'scope_gate_failed', gateError)\n    return json(502, serverErrorPayload(event, 'No se pudo validar el alcance de clasificación.'))\n  }",
)
replace(
    p,
    "    console.error('[resolver-pendiente-catalogo] RPC error:', error)\n    const status = /alcance|permiso|organización|familia/i.test(error.message) ? 403 : 409\n    return json(status, { success: false, error: error.message })",
    "    const status = /alcance|permiso|organización|familia/i.test(error.message) ? 403 : 409\n    logServerError(event, 'resolver-pendiente-catalogo', 'resolve_pending_failed', error, { status_code: status })\n    return json(status, publicRpcErrorPayload(event, 'resolver-pendiente-catalogo', 'resolve_pending_failed', error, status, 'No se pudo clasificar el producto.'))",
)

print('observability core patch applied')
