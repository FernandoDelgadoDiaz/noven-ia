// Clasificación explícita de las tablas de `public` por exposición.
//
// POR QUÉ EXISTE
//
// Hasta ahora la exposición de cada tabla era el resultado acumulado de las
// migraciones que la tocaron. Nadie declaraba en ningún lado cuánto DEBÍA estar
// expuesta: se sabía mirando el catálogo, y sólo si a alguien se le ocurría
// mirar. Una tabla nueva entraba con los grants que le tocaran y nada avisaba.
//
// Esto invierte la relación: la clase se declara acá y el verificador comprueba
// que el catálogo real coincida. Una tabla nueva sin clasificar rompe CI.
//
// QUÉ SUBSUME
//
// Esto también cubre la aserción anti-`USING(true)` (ítem 2.4 del plan). Si una
// tabla `lectura_tenant` tiene que estar acotada por organización, zona o
// sucursal, una política permisiva sobre ella falla por definición. Dos tests
// separados dirían dos veces lo mismo con una costura entre ellos.
//
// AL 2026-09-03 hay cero políticas permisivas en `public`: esto preserva un
// invariante que hoy se cumple, no corrige un defecto.

/**
 * Las clases, de menos a más expuesta.
 *
 * `grantsAuthenticated` es el conjunto EXACTO permitido: ni más ni menos. Si
 * una tabla necesita otra cosa, se cambia su clase a propósito y el diff lo
 * muestra, que es justamente el punto.
 */
export const CLASES = Object.freeze({
  solo_servidor: {
    descripcion: 'Sin grants a authenticated. Se escribe por Netlify Function con service_role.',
    grantsAuthenticated: [],
    exigePolitica: false,
    politicaDebeAcotar: null,
  },
  respaldo_historico: {
    descripcion: 'Respaldo puntual sin rol en el circuito operativo. Sin grants.',
    grantsAuthenticated: [],
    exigePolitica: false,
    politicaDebeAcotar: null,
  },
  lectura_tenant: {
    descripcion: 'Lectura acotada por organización, zona o sucursal.',
    grantsAuthenticated: ['SELECT'],
    exigePolitica: true,
    politicaDebeAcotar: 'tenant',
  },
  propia_del_usuario: {
    descripcion: 'Lectura de las filas del propio usuario.',
    grantsAuthenticated: ['SELECT'],
    exigePolitica: true,
    politicaDebeAcotar: 'usuario',
  },
  escritura_propia: {
    descripcion: 'Único escritor legítimo desde el browser: cada quien sobre lo suyo.',
    grantsAuthenticated: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'],
    exigePolitica: true,
    politicaDebeAcotar: 'usuario',
  },
})

/**
 * Toda tabla de `public` tiene que estar acá. El verificador falla si aparece
 * una que no esté, y también si acá figura una que ya no existe.
 */
export const CLASIFICACION = Object.freeze({
  // --- Catálogo y jerarquía: lectura acotada al tenant ---------------------
  acciones_operativas: 'lectura_tenant',
  familias: 'lectura_tenant',
  intervenciones_rag: 'lectura_tenant',
  organizaciones: 'lectura_tenant',
  producto_codigos: 'lectura_tenant',
  producto_sucursal: 'lectura_tenant',
  productos: 'lectura_tenant',
  regiones: 'lectura_tenant',
  sectores: 'lectura_tenant',
  sucursales: 'lectura_tenant',
  vencimiento_observaciones: 'lectura_tenant',
  vencimientos: 'lectura_tenant',
  zonas: 'lectura_tenant',

  // --- Identidad y accesos: cada quien ve lo suyo --------------------------
  usuarios: 'propia_del_usuario',
  usuario_accesos: 'propia_del_usuario',
  usuario_familias_sucursal: 'propia_del_usuario',

  // --- El único escritor legítimo desde el browser -------------------------
  // El browser registra su propia suscripción push. `no-browser-business-writes`
  // lo exceptúa por eso y por nada más.
  push_subscriptions: 'escritura_propia',

  // --- Server-only ---------------------------------------------------------
  // RLS habilitada y CERO grants: negación total para authenticated. El advisor
  // de Supabase las reporta como `rls_enabled_no_policy`, y eso NO es un
  // defecto: sin grants no hace falta política para negar.
  alertas_zonales: 'solo_servidor',
  alertas_zonales_destinos: 'solo_servidor',
  analisis_cache: 'solo_servidor',
  importacion_0258_detalle: 'solo_servidor',
  importaciones: 'solo_servidor',
  invitaciones_acceso: 'solo_servidor',
  problemas_economicos_ciclos: 'solo_servidor',
  producto_costo_observaciones: 'solo_servidor',
  producto_costo_ultima_observacion: 'solo_servidor',
  producto_imagen_cambios: 'solo_servidor',
  producto_pendiente_detecciones: 'solo_servidor',
  producto_snapshots: 'solo_servidor',
  productos_pendientes_catalogo: 'solo_servidor',
  rag_escalamientos: 'solo_servidor',
  rate_limit_consumo: 'solo_servidor',
  usuario_familias: 'solo_servidor',

  // --- Respaldos de agosto -------------------------------------------------
  // Ya no están en `public`: el ítem E4 los movió a `noven_archive`, fuera del
  // alcance de esta clasificación, que sólo cubre `public`. La clase
  // `respaldo_historico` se conserva porque describe una forma de exposición
  // que puede volver a aparecer, no porque hoy la use alguna tabla.
})

/**
 * Formas de acotamiento aceptadas en una política de `authenticated`.
 *
 * `tenant`: la política resuelve el alcance por las funciones de acceso, que
 * son las únicas que consultan la jerarquía del usuario.
 * `usuario`: la política compara contra `auth.uid()` directamente.
 *
 * Cualquier otra cosa —`true`, una constante, una comparación con un literal—
 * no acota nada y el verificador la rechaza.
 */
export const ACOTAMIENTOS = Object.freeze({
  tenant: [
    /noven_private\.tiene_acceso_organizacion\(/,
    /noven_private\.tiene_acceso_zona\(/,
    /noven_private\.tiene_acceso_sucursal\(/,
    // Resuelve el alcance por producto+sucursal para las tablas operativas.
    // Faltaba, y su ausencia hacía que cinco tablas correctamente acotadas
    // parecieran sin acotar.
    /noven_private\.puede_leer_producto_sucursal\(/,
  ],
  usuario: [
    /auth\.uid\(\)/,
  ],
})

/** `anon` no puede tener un solo grant en `public`. */
export const ANON_SIN_GRANTS = true

// ---------------------------------------------------------------------------
// VISTAS
// ---------------------------------------------------------------------------
//
// Las vistas son la puerta trasera de RLS y es fácil no verla. Por defecto una
// vista se evalúa con los permisos de su DUEÑO, no de quien consulta: si estas
// vistas —todas de `postgres`— no tuvieran `security_invoker`, cualquier
// usuario autenticado leería el catálogo entero de todas las organizaciones a
// través de ellas, con las políticas de las tablas base sin aplicarse.
//
// Al 2026-09-03 las doce tienen `security_invoker = true` y el aislamiento se
// sostiene. Pero NADA lo estaba protegiendo: una vista nueva sin la opción
// rompía el aislamiento en silencio, y ni el gate de replay ni ningún contrato
// lo habrían visto. Por eso el verificador lo exige.

export const CLASES_VISTA = Object.freeze({
  vista_lectura_tenant: {
    descripcion: 'Vista de lectura sobre tablas acotadas por RLS. Hereda el alcance del invocador.',
    grantsAuthenticated: ['SELECT'],
  },
  vista_solo_servidor: {
    descripcion: 'Vista sin exposición a authenticated.',
    grantsAuthenticated: [],
  },
})

export const CLASIFICACION_VISTAS = Object.freeze({
  v_acciones_operativas_historial: 'vista_lectura_tenant',
  v_efectividad_intervencion_rag: 'vista_lectura_tenant',
  v_efectividad_rag_operador: 'vista_lectura_tenant',
  v_efectividad_rag_resumen: 'vista_lectura_tenant',
  v_producto_sucursal_operativo: 'vista_lectura_tenant',
  v_productos_catalogo: 'vista_lectura_tenant',
  v_resultado_operador_rag: 'vista_lectura_tenant',
  v_resultado_vencimiento_tramos: 'vista_lectura_tenant',
  v_seguimiento_rag_actual: 'vista_lectura_tenant',
  v_vencimientos_operativos: 'vista_lectura_tenant',

  v_problemas_economicos_historial: 'vista_solo_servidor',
  vw_usuarios_completos: 'vista_solo_servidor',
})

/**
 * Sin esto, una vista evalúa RLS como su dueño y el aislamiento multitenant
 * deja de existir para quien la consulte. No es configurable por vista: es la
 * condición para que una vista pueda exponerse a `authenticated`.
 */
export const VISTAS_EXIGEN_SECURITY_INVOKER = true
