# PLAN.md — Auditoría NoVen IA

> Auditoría completa realizada por agente Architect (NodoLabs Forge).
> Fecha: 2026-06-10. Branch: master. Bundle actual: 939 KB.
>
> Filosofía: no romper lo que funciona, perfeccionarlo. Cada ítem incluye
> archivo:línea, causa raíz y solución concreta. Datos de producción intactos.

## Reglas inviolables

- Cada tarea tiene exactamente UN agente responsable y UN criterio medible.
- No se borra ni se resetea data en producción.
- Antes de modificar RLS o policies en producción se debe testear en branch de Supabase.
- Ningún fix puede romper la app para gerente091@gmail.com (admin) ni para fernandodelgado@gmail.com (operador).

---

## CRÍTICO — bloquean operación o exponen seguridad

### C1 — Netlify Functions sin autenticación (security hole) [x]
- **Archivos:** `netlify/functions/crear-usuario.ts:9-148`, `netlify/functions/listar-usuarios.ts:9-72`
- **Problema:** Ninguna de las dos funciones verifica si el caller está autenticado o tiene rol admin. Cualquiera con la URL pública `https://noven-ia.netlify.app/.netlify/functions/crear-usuario` puede crear un usuario con `rol: 'admin'` y obtener acceso total a la base. `listar-usuarios` expone los emails de TODOS los usuarios del proyecto Supabase sin gate.
- **Causa raíz:** El handler asume implícitamente que solo el panel Admin del frontend lo llama, pero no hay verificación server-side del JWT del caller ni del rol.
- **Solución concreta:**
  1. Extraer el token Bearer del header `Authorization` que envía el frontend (Supabase JS lo agrega automáticamente con `supabase.functions.invoke` o se debe agregar manual con `Authorization: Bearer ${session.access_token}`).
  2. Llamar `GET ${supabaseUrl}/auth/v1/user` con ese token y `apikey: anonKey` para resolver el `user.id`.
  3. Hacer `SELECT rol FROM usuarios WHERE id = $user_id` usando una llamada REST con `apikey: serviceRoleKey`.
  4. Si rol !== 'admin' devolver `403 Forbidden`.
  5. En `Admin.tsx:166-176, 537` agregar el header `Authorization: Bearer ${session.access_token}` obtenido de `useAuth().session`.
- **Restringir CORS:** cambiar `'Access-Control-Allow-Origin': '*'` por el dominio de producción `'https://noven-ia.netlify.app'` (y `'http://localhost:5173'` en dev).
- **Agente:** backend-dev
- **Criterio medible:** Una request POST a `/.netlify/functions/crear-usuario` sin Authorization válido devuelve 401. Con token de un operador devuelve 403. Con token de admin sigue funcionando.

### C2 — RLS de productos rota: nadie puede actualizar productos por rol JWT [x]
- **Archivos:** `supabase/migrations/001_initial_schema.sql:71-82`
- **Problema:** Las policies `productos_insert_admin` y `productos_update_admin` usan `auth.jwt() ->> 'role' = 'admin'`. Supabase NO inyecta el rol de `public.usuarios` en el JWT por defecto. El claim `role` en JWT siempre vale `'authenticated'` para usuarios logueados. **Esto significa que ninguna escritura a `productos` debería pasar el RLS** — pero `Scanner.tsx:272-285` (insert), `Importar.tsx:199, 206` (update/insert), `ProductoConfirm.tsx:70-73` (update imagen_url), `EditarVencimientoModal.tsx:73-77` (update imagen_url + stock_actual), `Scanner.tsx:216-217` (update codigo_barras) escriben productos.
- **Causa raíz:** Si en producción funcionan, es porque RLS quedó deshabilitado en producción a través de la UI de Supabase, o existe un override que las migraciones no reflejan. En ambos casos, **las migraciones no son la fuente de verdad** y reproducir un entorno limpio rompería todo.
- **Solución concreta:**
  1. Verificar estado actual de RLS y policies en producción con: `SELECT polname, polcmd, qual::text, with_check::text FROM pg_policy WHERE polrelid = 'productos'::regclass;` desde el panel SQL de Supabase (NO desde código).
  2. Crear nueva migración `20260610000000_fix_productos_rls.sql` que reemplaza las policies por una basada en `public.usuarios.rol`:
     ```sql
     DROP POLICY IF EXISTS "productos_insert_admin" ON productos;
     DROP POLICY IF EXISTS "productos_update_admin" ON productos;
     CREATE POLICY "productos_insert_admin" ON productos FOR INSERT TO authenticated
       WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'));
     CREATE POLICY "productos_update_admin" ON productos FOR UPDATE TO authenticated
       USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'))
       WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'));
     ```
  3. **Problema secundario:** las operadoras necesitan actualizar `imagen_url`, `stock_actual` y `codigo_barras` (operaciones reales del flujo scanner/edición). Agregar policy específica que permita esas columnas a operadores con familia asignada:
     ```sql
     CREATE POLICY "productos_update_imagen_y_stock_operador" ON productos FOR UPDATE TO authenticated
       USING (EXISTS (SELECT 1 FROM usuario_familias uf WHERE uf.usuario_id = auth.uid() AND uf.familia_id = productos.familia_id))
       WITH CHECK (EXISTS (SELECT 1 FROM usuario_familias uf WHERE uf.usuario_id = auth.uid() AND uf.familia_id = productos.familia_id));
     ```
     (Postgres no permite restringir UPDATE por columnas en una policy — la alternativa es delegar las escrituras de operadora a una RPC `actualizar_producto_operador(id, stock, imagen_url, codigo_barras)` con SECURITY DEFINER que valida la columna a tocar.)
- **Agente:** backend-dev
- **Criterio medible:** Con la migración aplicada en branch de Supabase, un operador puede subir foto y actualizar EAN para productos de SU familia, NO puede cambiar descripcion ni categoria, y admin puede hacer todo.

### C3 — RLS de acciones_operativas impide ver totales del trimestre por sucursal [x]
- **Archivos:** `supabase/migrations/20260526000001_create_acciones_operativas.sql:24-26`, `src/hooks/useAccionesOperativas.ts:61-72`
- **Problema:** La policy SELECT es `USING (auth.uid() = usuario_id)`. Eso significa que **cada operadora solo ve sus propias donaciones/decomisos**. Las KPI cards "Donación Q2" y "Decomiso Q2" del Dashboard muestran números diferentes según quién esté logueado — el gerente ve 0 si nunca registró nada, una operadora ve solo lo que ella cargó. El módulo entero pierde sentido: el contador trimestral del negocio NO es el contador trimestral de un usuario.
- **Causa raíz:** La policy fue copiada del patrón "ownership" de `vencimientos` sin considerar que estas métricas son agregadas a nivel sucursal.
- **Solución concreta:**
  1. Nueva migración `20260610000001_fix_acciones_operativas_select.sql`:
     ```sql
     DROP POLICY IF EXISTS "usuarios autenticados pueden leer acciones" ON acciones_operativas;
     CREATE POLICY "acciones_select_sucursal" ON acciones_operativas FOR SELECT TO authenticated
       USING (true);
     -- (todos los autenticados ven todas — son agregados de negocio, no datos personales)
     ```
  2. Mantener la policy INSERT como está (`auth.uid() = usuario_id` evita suplantación).
  3. En `useAccionesOperativas.ts:64-66` ya filtra por `sucursal_id`, eso queda igual.
- **Agente:** backend-dev
- **Criterio medible:** Logueado como cualquier usuario, las KPI cards del Dashboard muestran el mismo número (total real del trimestre para la sucursal).

### C4 — iOS Safari: lightbox de foto no cierra y nesting de button inválido
- **Archivos:** `src/components/dashboard/AlertaItem.tsx:55-77`
- **Problema:** El overlay del lightbox es un `<button type="button">` que contiene un `<img>` con `onClick={(e) => e.stopPropagation()}` (línea 75). HTML inválido — no se pueden anidar elementos interactivos dentro de `<button>`. iOS Safari es estricto: ignora event handlers de hijos interactivos dentro de un button, lo que produce comportamiento errático (cierres no deseados, foto no clickeable, etc.). El commit c3ae1d5 trató de fixearlo pero la causa raíz sigue (la estructura semántica está mal).
- **Causa raíz:** Patrón de implementación incorrecto — uso de `<button>` como overlay en lugar de un `<div role="dialog">`.
- **Solución concreta:**
  ```tsx
  {lightboxAbierto && producto.imagen_url && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-pointer"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto de ${producto.descripcion}`}
      onClick={() => setLightboxAbierto(false)}
      onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') setLightboxAbierto(false) }}
      tabIndex={0}
    >
      <button
        type="button"
        className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white"
        aria-label="Cerrar foto"
        onClick={(e) => { e.stopPropagation(); setLightboxAbierto(false) }}
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={producto.imagen_url}
        alt={producto.descripcion}
        className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )}
  ```
  Bloquear scroll del body mientras está abierto: `useEffect(() => { document.body.style.overflow = lightboxAbierto ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [lightboxAbierto])`.
- **Agente:** frontend-dev
- **Criterio medible:** En iOS Safari real, abrir la foto del producto y tocar fuera de la imagen cierra el lightbox. Tocar sobre la imagen no cierra. El botón X cierra. Funciona también en Chrome desktop.

### C5 — Scanner: pre-llenado de cod_art con EAN de 13 dígitos rompe validación [x]
- **Archivos:** `src/pages/Scanner.tsx:101-104`
- **Problema:** Cuando el usuario busca por EAN y el producto no existe, `setNuevoProductoCodArt(codigo.trim())` (línea 102) mete el código de 13 dígitos en el campo `cod_art` del formulario nuevo producto, que valida estrictamente 7 dígitos (`handleCodArtChange` línea 152-163). El usuario pasa a "nuevo producto" con el campo cod_art ya inválido y truncado a 7 dígitos arbitrarios (los primeros 7 del EAN), generando un código interno falso. Si lo guarda, queda en producción un producto con cod_art incorrecto.
- **Causa raíz:** El pre-llenado no distingue entre código interno (7 dígitos) y EAN (13 dígitos).
- **Solución concreta:** Detectar formato:
  ```ts
  } else if (!scanError) {
    const codigoTrim = codigo.trim()
    if (/^\d{13}$/.test(codigoTrim)) {
      // Es un EAN -> precargar el campo EAN, no cod_art
      setNuevoProductoEan(codigoTrim)
      setNuevoProductoCodArt('')
    } else if (/^\d{7}$/.test(codigoTrim)) {
      setNuevoProductoCodArt(codigoTrim)
      setNuevoProductoEan('')
    } else {
      setNuevoProductoCodArt('')
      setNuevoProductoEan('')
    }
    setErrorBusqueda('no_encontrado')
  }
  ```
- **Agente:** frontend-dev
- **Criterio medible:** Buscar un EAN inexistente y elegir "Agregar producto" deja el campo EAN pre-rellenado y el campo cod_art vacío (no con 7 dígitos arbitrarios).

---

## ALTO — afectan experiencia y confianza

### A1 — Title HTML genérico "Vite + React + TS" en producción
- **Archivo:** `index.html:7`
- **Problema:** En la pestaña del navegador, en el historial y en cualquier preview-link de redes/WhatsApp el título dice "Vite + React + TS". Mata la sensación de marca premium que pide la filosofía del proyecto.
- **Causa raíz:** Nunca se reemplazó el boilerplate.
- **Solución concreta:** Reemplazar todo el `<head>`:
  ```html
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0D9488" />
    <meta name="description" content="NoVen IA — Control predictivo de vencimientos para retail alimenticio. Cero merma, decisiones a tiempo." />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="NoVen IA" />
    <meta name="mobile-web-app-capable" content="yes" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <title>NoVen IA — Control predictivo de vencimientos</title>
  </head>
  ```
- **Agente:** frontend-dev
- **Criterio medible:** En producción la pestaña dice "NoVen IA — Control predictivo de vencimientos" y la barra de status en iOS toma el color teal.

### A2 — Sucursal hardcoded en 5 archivos rompe escalabilidad multi-tenant
- **Archivos:** `src/pages/Dashboard.tsx:14`, `src/pages/Scanner.tsx:12`, `src/hooks/useVencimientosLista.ts:8`, `src/hooks/useAccionesOperativas.ts:5`, `src/components/dashboard/AccionOperativaModal.tsx:9`
- **Problema:** El `SUCURSAL_ID = '00000000-0000-0000-0000-000000000001'` está repetido como constante hardcoded. Cuando se agregue una segunda sucursal hay que tocar 5 archivos y existe riesgo de inconsistencia (ya hay un TODO en cada archivo). Hoy mismo, el usuario con `sucursal_id` distinto en su perfil ve datos de la sucursal hardcoded en lugar de la suya.
- **Causa raíz:** Multi-tenant pendiente desde el inicio, nadie lo encaró.
- **Solución concreta:**
  1. Crear `src/hooks/useSucursalActual.ts`:
     ```ts
     export function useSucursalActual(): { sucursalId: string | null; loading: boolean } {
       const { perfil, loading } = useUsuarioRol()
       const sucursalId = perfil?.sucursal_id ?? '00000000-0000-0000-0000-000000000001'
       // Fallback al ID legacy para no romper en producción
       return { sucursalId, loading }
     }
     ```
  2. Reemplazar todos los `SUCURSAL_ID` hardcoded por `useSucursalActual()`.
  3. Asegurarse de que el admin (`gerente091@gmail.com`) tenga su `sucursal_id` seteado en `public.usuarios` para que esto no rompa el flujo actual.
- **Agente:** frontend-dev
- **Criterio medible:** Buscar `'00000000-0000-0000-0000-000000000001'` en `src/` devuelve 0 matches. La app sigue funcionando idéntica para el usuario actual.

### A3 — Botón "Cambiar foto" iOS Safari fuerza cámara, no permite galería
- **Archivos:** `src/components/dashboard/EditarVencimientoModal.tsx:202`, `src/components/scanner/ProductoConfirm.tsx:165`
- **Problema:** El input file tiene `capture="environment"`. En iOS Safari, esto **fuerza** a abrir la cámara trasera, sin opción a elegir foto de galería. El operador que ya tiene una foto guardada en su carrete no puede usarla, está obligado a tomarla otra vez. El commit 66261a5 buscaba "foto expandible/editable" pero quedó atrapado por iOS.
- **Causa raíz:** `capture` es un hint que iOS interpreta como obligatorio (Android lo trata como opcional con menú).
- **Solución concreta:** En el botón "Cambiar foto" (cuando ya hay foto cargada), remover `capture` o usar `capture=""` para que iOS muestre el menú nativo (Tomar foto / Elegir de galería). Para "Agregar foto" (primera vez) sí dejar `capture="environment"` para acelerar el flujo común.
  ```tsx
  <input
    ref={fotoInputRef}
    type="file"
    accept="image/*"
    {...(fotoUrl ? {} : { capture: 'environment' as const })}
    className="hidden"
    onChange={(e) => { void handleFotoChange(e) }}
  />
  ```
- **Agente:** frontend-dev
- **Criterio medible:** En iOS Safari, tocar "Cambiar foto" muestra menú Tomar/Elegir. Tocar "Agregar foto" abre cámara directa.

### A4 — FAB scanner mobile se superpone al navbar inferior
- **Archivo:** `src/components/layout/AppLayout.tsx:122-138, 140-195`
- **Problema:** El FAB scanner está en `bottom-[calc(32px+env(safe-area-inset-bottom,0px))]` y mide 64x64. El navbar inferior es 64px alto + safe-area. El FAB queda a 32px del borde inferior, por lo que su mitad inferior cae sobre el navbar y oculta el icono central del grid (en mobile con `grid-cols-5` el FAB tapa "Vencimientos" o "Maestro" dependiendo del orden). Además, en iOS con notch hay solapamiento visual feo.
- **Causa raíz:** El layout calcula `bottom` desde el viewport, no desde el navbar.
- **Solución concreta:** Subir el FAB para que apoye sobre el navbar con una "cuna" visual:
  - Cambiar `bottom-[calc(32px+env(safe-area-inset-bottom,0px))]` por `bottom-[calc(40px+env(safe-area-inset-bottom,0px))]` (FAB queda mitad sobre, mitad fuera del navbar — patrón Material).
  - En el grid del navbar, agregar un slot vacío para el scanner: cambiar `mobileNavItems` para incluir un spacer del lado donde está el FAB; o mejor, partir el grid en dos mitades con `flex` y dejar el FAB en el centro como item del propio navbar. Cualquiera de los dos enfoques funciona, decidir con el frontend-dev.
- **Agente:** frontend-dev
- **Criterio medible:** En iPhone 12/13/14/15 real, el FAB no tapa ningún item del navbar y el navbar no tiene un hueco visualmente raro.

### A5 — Dashboard muestra vencidos diferentes que Vencimientos (inconsistencia)
- **Archivos:** `src/hooks/useVencimientos.ts:94` vs `src/hooks/useVencimientosLista.ts:95-107`
- **Problema:** `useVencimientos` (Dashboard) aplica `.gte('fecha_vencimiento', hoy)` y oculta vencidos. `useVencimientosLista` (página Vencimientos) NO aplica ese filtro y muestra vencidos. Resultado:
  - Un producto con `fecha_vencimiento = ayer` aparece como "Vencido hace 1 día" en Vencimientos pero NO aparece en Dashboard (no se cuenta en "Unidades en riesgo" ni dispara el banner crítico de "Atención requerida").
  - El operador ve un decomiso pendiente solo si entra a Vencimientos.
- **Causa raíz:** Decisión de UX inconsistente entre las dos vistas.
- **Solución concreta:** Remover el `.gte('fecha_vencimiento', hoy)` de `useVencimientos.ts:94`. El motor de riesgo ya clasifica los días negativos como `decomiso`, el Dashboard pasaría a mostrar los vencidos en rojo crítico — que es el comportamiento intuitivo: lo más urgente es lo ya vencido. Si se quiere ocultar vencidos viejos, agregar filtro temporal (ej. máximo 30 días vencido).
- **Agente:** backend-dev
- **Criterio medible:** Un producto cargado con vencimiento de ayer aparece tanto en Dashboard como en Vencimientos. El KPI "Unidades en riesgo" del Dashboard coincide con el conteo filtrado en Vencimientos.

### A6 — Bundle 939 KB con dependencias no usadas (xlsx, pdfjs-dist)
- **Archivos:** `package.json:14, 19`
- **Problema:** `xlsx` (~430 KB) y `pdfjs-dist` (~800 KB) están instaladas pero NO se importan en ningún archivo de `src/`. Probablemente Vite las elimina por tree-shaking del bundle final pero suman tiempo de `npm install` y ruido. Si en algún punto fueron tree-shakeadas mal y entraron, hay overhead invisible.
- **Causa raíz:** Dependencias agregadas para features futuras que no se implementaron, nadie las removió.
- **Solución concreta:**
  1. `npm uninstall xlsx pdfjs-dist`.
  2. Verificar que `npm run build` siga ok.
  3. Si se necesitan en el futuro, agregar con `import dinámico` para code splitting.
- **Agente:** frontend-dev
- **Criterio medible:** `package.json` no contiene `xlsx` ni `pdfjs-dist`. Bundle baja al menos 20 KB (verificar con `npm run build`).

### A7 — Code splitting por ruta para reducir bundle inicial
- **Archivo:** `src/router/index.tsx:1-12`
- **Problema:** Todas las páginas (`Dashboard`, `Scanner`, `Vencimientos`, `Maestro`, `Importar`, `Admin`) están importadas estáticamente, lo que genera un único bundle de 939 KB. Un operador que solo usa Dashboard + Scanner descarga también el código de Admin (que pesa por la tabla de usuarios) y de Importar (que pesa por la lógica del CSV parser de Glaciar).
- **Causa raíz:** Falta de `React.lazy` en las rutas.
- **Solución concreta:**
  ```tsx
  import { lazy, Suspense } from 'react'
  const Dashboard = lazy(() => import('../pages/Dashboard'))
  const Scanner = lazy(() => import('../pages/Scanner'))
  const Vencimientos = lazy(() => import('../pages/Vencimientos'))
  const Maestro = lazy(() => import('../pages/Maestro'))
  const Importar = lazy(() => import('../pages/Importar'))
  const Admin = lazy(() => import('../pages/Admin'))
  ```
  Envolver `<Outlet />` en `AppLayout.tsx` con `<Suspense fallback={<RouteSkeleton />}>`.
  Adicionalmente, hacer lazy el `ScannerModal` y el `html5-qrcode` (es un peso muerto si el navegador soporta BarcodeDetector — la mayoría de Android/iOS modernos lo tienen).
- **Agente:** frontend-dev
- **Criterio medible:** `dist/assets/` muestra al menos 6 chunks separados. Bundle del entry inicial baja de 939 KB a menos de 400 KB.

### A8 — Loading inicial de Dashboard parpadea por race entre auth y familias
- **Archivos:** `src/hooks/useVencimientos.ts:115-126`, `src/hooks/useUsuarioFamilias.ts:46-48`
- **Problema:** Mientras `useUsuarioFamilias` está cargando, `useVencimientos.data` devuelve `[]` (línea 120 del hook), por lo que el Dashboard renderiza el empty state "Sin productos registrados" durante ~300-800ms antes de que aparezcan los datos. Mala primera impresión.
- **Causa raíz:** El `data` se calcula en `useMemo` y devuelve `[]` mientras `famLoading === true`, pero el componente Dashboard usa `loading && data.length === 0` como condición de skeleton. Cuando `data.length === 0` por familias-pending, NO entra al skeleton y entra al empty state.
- **Solución concreta:** En Dashboard.tsx, cambiar la condición `{loading && data.length === 0}` por `{loading}` para el skeleton, y el bloque `!loading && alertasOrdenadas.length === 0` ya cubre empty state real. O en `useVencimientos`, devolver `loading: true` mientras `famLoading || fetchLoading` (eso ya lo hace) y asegurar que el componente lo respete.
- **Agente:** frontend-dev
- **Criterio medible:** En login + nav directo a /dashboard nunca aparece "Sin productos registrados" si después hay productos.

---

## MEDIO — optimizaciones técnicas

### [x] M1 — N+1 implícito en Admin.tsx al cargar usuarios
- **Archivos:** `src/pages/Admin.tsx:534-619`
- **Problema:** Hace 5 queries secuenciales (Netlify Function listar-usuarios, usuarios, usuario_familias, familias, sectores) y mapea en memoria. Para 50 usuarios funciona, para 500 empieza a ser lento. Además, las 4 últimas queries a Supabase son secuenciales — se podrían paralelizar con `Promise.all`.
- **Causa raíz:** Implementación straightforward sin pensar en escala.
- **Solución concreta:**
  1. Paralelizar las 4 queries de Supabase con `Promise.all`.
  2. Crear una vista en Supabase `vw_usuarios_completos` que devuelva el join `usuarios + usuario_familias + familias + sectores` en una sola query.
- **Agente:** backend-dev
- **Criterio medible:** La página Admin carga en menos de 500ms para 100 usuarios. `cargarUsuarios()` hace máximo 2 fetches (Netlify Function + 1 query Supabase).

### [x] M2 — useProductos.fetchAll trae todo sin paginación
- **Archivos:** `src/hooks/useProductos.ts:24-39`
- **Problema:** Hace `SELECT * FROM productos WHERE activo = true` sin LIMIT. Hoy con ~500-2000 productos del surtido del super está bien, pero el hook se monta en cada uso del Scanner y descarga toda la tabla aunque solo se busque uno. `searchByBarcode` no usa `state.data`, hace queries directas. Entonces el `fetchAll` es trabajo desperdiciado.
- **Causa raíz:** Hook diseñado para listar pero solo se usa para buscar.
- **Solución concreta:** Eliminar `fetchAll` del hook (o ponerlo opt-in con un flag `{ fetchOnMount: false }`). El Scanner solo necesita `searchByBarcode`. El "Maestro" — cuando se implemente — sí va a necesitar paginación.
- **Agente:** frontend-dev
- **Criterio medible:** Al abrir Scanner no se dispara un `SELECT * FROM productos`. La página Vencimientos también, no descarga el catalog completo si solo lo lista.

### [x] M3 — Trigger updated_at en productos pero NO en vencimientos ni acciones_operativas
- **Archivos:** `supabase/migrations/001_initial_schema.sql:101-104`
- **Problema:** Solo `productos` tiene trigger `set_updated_at`. `vencimientos` no tiene columna `updated_at` y `acciones_operativas` no tampoco. Cuando un operador hace soft-delete con `update activo=false`, no queda registro de cuándo. Si dos personas editan el mismo vencimiento, no se puede auditar.
- **Causa raíz:** Solo se replicó el patrón en una tabla.
- **Solución concreta:** Agregar columna `updated_at` a `vencimientos` y `acciones_operativas` con trigger. Migración nueva, no destructiva.
- **Agente:** backend-dev
- **Criterio medible:** `SELECT updated_at FROM vencimientos LIMIT 1` devuelve un timestamp en lugar de error.

### [x] M4 — Filtro de fecha en useVencimientosLista no excluye muy viejos
- **Archivos:** `src/hooks/useVencimientosLista.ts:95-107`
- **Problema:** Trae TODOS los vencimientos activos sin filtro de fecha. Un vencimiento de hace 3 años que nadie cerró sigue cargándose y procesándose en el cliente. Eventualmente el dataset crece sin freno.
- **Causa raíz:** Falta filtro temporal.
- **Solución concreta:** Agregar `.gte('fecha_vencimiento', desdeIso)` donde `desdeIso = hoy - 90 días`. Vencidos hace más de 90 días deberían cerrarse manualmente como decomiso o archivarse vía cron job (no parte de este plan).
- **Agente:** backend-dev
- **Criterio medible:** Query a `vencimientos` desde la lista nunca retorna registros con `fecha_vencimiento < hoy - 90`.

### M5 — Índices SQL faltantes para queries actuales
- **Archivos:** `supabase/migrations/001_initial_schema.sql:154-161`
- **Problema:** Hay índice en `producto_id`, `sucursal_id` y `fecha_vencimiento` por separado, pero el query típico filtra por los tres a la vez (`sucursal_id`, `activo=true`, `fecha_vencimiento >= hoy`). Postgres puede combinar índices, pero un índice compuesto y parcial sería más eficiente. También falta índice en `acciones_operativas (usuario_id)` pese a que la policy SELECT filtra por ahí.
- **Causa raíz:** Performance no fue revisada en producción.
- **Solución concreta:** Migración nueva:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_vencimientos_activo_sucursal_fecha
    ON vencimientos (sucursal_id, fecha_vencimiento) WHERE activo = true;
  CREATE INDEX IF NOT EXISTS idx_acciones_operativas_usuario
    ON acciones_operativas (usuario_id);
  CREATE INDEX IF NOT EXISTS idx_usuario_familias_usuario
    ON usuario_familias (usuario_id);
  ```
- **Agente:** backend-dev
- **Criterio medible:** EXPLAIN ANALYZE del query del Dashboard usa el índice compuesto.

### M6 — Hardcodeo de SUCURSAL_ID también en AccionOperativaModal (consistencia)
- **Archivo:** `src/components/dashboard/AccionOperativaModal.tsx:9, 83`
- **Problema:** Mismo problema que A2 pero en el componente que registra acciones operativas. Si en el futuro un usuario opera en otra sucursal, sus donaciones quedan registradas en la sucursal default. Forma parte del fix A2.
- **Agente:** frontend-dev
- **Criterio medible:** Cubierto por A2.

### M7 — ErrorBoundary no envía errores a observabilidad
- **Archivo:** `src/components/ErrorBoundary.tsx:18-20`
- **Problema:** Solo hace `console.error`. En producción no hay forma de saber que un usuario crasheó la app — Fernando se entera por WhatsApp del cliente.
- **Causa raíz:** No se integró Sentry/Logflare/Sentry-lite.
- **Solución concreta:** Integrar Sentry con tag por rol/sucursal/familia. Bajo costo: free tier alcanza para los volúmenes esperados.
- **Agente:** frontend-dev
- **Criterio medible:** Forzar un error en una página redirige a "Algo salió mal" Y aparece en Sentry dashboard.

### M8 — Scanner: tres useState para errores que podrían ser uno
- **Archivos:** `src/pages/Scanner.tsx:29, 35, 50, 51, 55`
- **Problema:** Hay 7 `useState` para distintos tipos de error (`errorBusqueda`, `errorEan`, `errorNuevo`, `errorCodArt`, `errorEanNuevo`, `errorEanManualCaptura`, etc). Fácil de equivocarse al limpiar uno y dejar otro montado. Aumenta riesgo de bugs sutiles.
- **Causa raíz:** Componente creció orgánicamente sin refactor.
- **Solución concreta:** Consolidar en `useReducer` con tipo discriminado `{type: 'busqueda'|'ean'|'nuevo'|...; message: string}` o partir el Scanner en sub-componentes por paso. Refactor moderado, no urgente.
- **Agente:** frontend-dev
- **Criterio medible:** Tests E2E (cuando existan) pasan. Bug histórico de "el error de paso anterior queda visible" desaparece.

---

## BAJO — deuda técnica menor

### B1 — Comentario obsoleto en architecture.md sobre niveles de riesgo
- **Archivo:** `ai/architecture.md:13`
- **Problema:** Dice "Niveles: seguro (>30d), moderado (15-30d), alto (7-15d), critico (<7d)" pero el código usa 5 niveles distintos: seguro, radar, urgente, donacion, decomiso con umbrales 45/20/10/0.
- **Solución:** Actualizar el documento.
- **Agente:** frontend-dev (es documentación)

### B2 — calcularDiasStock retorna Infinity, daño potencial en displays
- **Archivo:** `src/lib/riesgo.ts:28-31`
- **Problema:** Devuelve `Infinity` cuando `ventaMediaDiaria <= 0`. La mayoría de los lugares lo manejan con `=== Infinity`, pero `AlertaItem.tsx:29` retorna "Sin rotación" lo cual está bien. Sin embargo en `VencimientoForm.tsx:46-48` también está manejado. Bug latente si alguien usa el valor en un Math.round. Riesgo bajo, vale la pena tipar.
- **Solución:** Cambiar return a `number | null` y devolver `null`.
- **Agente:** backend-dev (lib core)

### B3 — Falta archivo .env.example
- **Problema:** El CLAUDE.md menciona "Ver `.env.example`" pero no existe en el repo. Onboarding nuevo dev sufre.
- **Solución:** Crear `.env.example` con `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`, `SUPABASE_SERVICE_ROLE_KEY=` (con comentario "solo en Netlify").
- **Agente:** frontend-dev

### B4 — Maestro y avisos "Próximamente"
- **Archivo:** `src/pages/Maestro.tsx`
- **Problema:** La página entera dice "Próximamente". Es un dead-link en el navbar.
- **Solución:** O implementar el listado paginado (no parte de auditoría), o quitar del navbar hasta que esté.
- **Agente:** frontend-dev

### B5 — Tipo Vencimiento.producto opcional pero usado como required en hook
- **Archivo:** `src/types/index.ts:78, 86`, `src/hooks/useVencimientos.ts:33-37`
- **Problema:** `Vencimiento.producto?` es opcional, pero `VencimientoConRiesgo.producto` es required. El hook hace un narrowing manual con `hasProducto`. Está bien, pero el cast `as unknown as` (línea 105) es una bandera que se puede limpiar tipando mejor el select de Supabase.
- **Solución:** Definir un tipo `VencimientoRow` específico para el shape del select.
- **Agente:** backend-dev

### B6 — RLS de usuario_familias permite a cualquiera reasignar familias
- **Archivo:** `supabase/migrations/20260525100000_admin_panel_schema.sql:98-110`
- **Problema:** Policies INSERT/DELETE de `usuario_familias` están abiertas a cualquier authenticated. Un operador podría darse a sí mismo nuevas familias. Funciona porque el frontend no expone el endpoint, pero es defensa-en-profundidad floja.
- **Solución:** Restringir a `auth.uid() IN (SELECT id FROM usuarios WHERE rol = 'admin')`.
- **Agente:** backend-dev

### B7 — Algunos useEffect con cleanup débil en Scanner cámara
- **Archivo:** `src/components/scanner/ScannerModal.tsx:81-93, 247-249`
- **Problema:** El cleanup del `useEffect` llama `stopCamera()` pero si la promesa de `iniciarNativa()` aún está en curso, el cleanup puede ejecutarse antes de que `streamRef.current` esté asignado, dejando una cámara abierta. iOS Safari es estricto con eso (bloquea siguiente call).
- **Solución:** Usar flag `let cancelado = false` y checkar antes de `streamRef.current = stream`.
- **Agente:** frontend-dev

---

## Fases sugeridas para ejecución

- **Fase 1 — Seguridad y datos (CRÍTICO):** C1, C2, C3 — backend-dev arranca con C3 (más simple, mayor visibilidad inmediata en KPI cards). Luego C2 (requiere testear en branch de Supabase). C1 último, requiere coordinación con frontend para mandar el JWT.
- **Fase 2 — UX iOS y bugs flagrantes (CRÍTICO+ALTO):** C4, C5, A1, A3, A4 — frontend-dev en paralelo a Fase 1.
- **Fase 3 — Consistencia y performance (ALTO):** A2, A5, A6, A7, A8 — mezcla front+back.
- **Fase 4 — Optimizaciones (MEDIO):** M1-M8.
- **Fase 5 — Deuda menor (BAJO):** B1-B7.

Total: 5 críticos, 8 altos, 8 medios, 7 bajos. **28 ítems**.

---

## Funcionalidades nuevas (post-auditoría) — 2026-06-24

Trabajo de producto sobre la base auditada. No forma parte de los 28 ítems originales.

### F1 — Scanner: circuito completo de captura de códigos [x] (deployado, commit `02038a4`)
- Caso 1: producto sin `codigo_barras` → paso intermedio, escaneo de EAN **solo por cámara**, UPDATE.
- Caso 2: producto sin `cod_art` → paso intermedio, tipeo manual 7 dígitos, UPDATE.
- Caso 3/4: alta de producto nuevo exige EAN (cámara) + cod_art (tipeo), ambos obligatorios.
- Invariante: el EAN **nunca** se ingresa por tipeo manual, siempre por cámara. Satisface y refuerza **C5**.

### F2 — Navegación desde cards del Dashboard + página Historial [x] (deployado, commit `e342e68`)
- Cards del Dashboard navegan al destino esperado: Unidades en riesgo → `/vencimientos?filtro=riesgo`, En radar → `?filtro=radar`, Donación → `/historial?tipo=donacion`, Decomiso → `/historial?tipo=decomiso`.
- Vencimientos lee `?filtro=` (riesgo → urgente/donacion/decomiso, radar → radar) combinándose con chips/búsqueda; banner "Mostrando…" + "Ver todos".
- Nueva página `Historial` (`/historial?tipo=`): header trimestral, total acumulado, lista de `acciones_operativas` del trimestre (foto, producto, cantidad, fecha/hora, usuario, observaciones) y empty state. Ruta lazy protegida por PrivateRoute.
- Gotcha resuelto: `acciones_operativas` tiene `created_at` (no `fecha`) y `usuario_id` referencia `auth.users` (sin FK a `public.usuarios` → el embed PostgREST `usuarios(nombre)` no funciona; se resuelve con query separada a `usuarios`).

### F3 — Scanner: vencimiento único por producto [x] (deployado, commit `8d57c16`)
- Regla: máximo 1 vencimiento activo por producto/sucursal. Al escanear un producto con vencimiento activo → pantalla "Registro existente" (datos actuales + nivel de riesgo) y **actualizar (UPDATE)** en vez de duplicar.
- `VencimientoForm` gana modo edición vía prop `vencimientoExistente` (UPDATE sobre `id`; INSERT solo cuando no existe).
- **Enforcement en DB (commit `4dedf3b`):** migración `20260624000000_uq_vencimiento_activo_por_producto.sql` aplicada a producción — dedup no destructivo + índice único parcial `uq_vencimiento_activo_por_producto_sucursal ON vencimientos (producto_id, sucursal_id) WHERE activo = true`. Cierra la condición de carrera multi-cliente. Al aplicarla había 0 duplicados (22 activos intactos).
- **UX del conflicto (commit `dc19e5c`):** `VencimientoForm` traduce el error `23505` (unique_violation) a un mensaje amigable en vez del error técnico crudo.

### F4 — Dashboard operativo: KPIs compactos + alertas con jerarquía [x] (deployado, commit `a588650`)
- Solo UI/UX (sin tocar rutas, lógica, Supabase ni auth). 4 archivos: `RiesgoCard.tsx`, `AlertaItem.tsx`, `Dashboard.tsx`, `AppLayout.tsx`.
- Cards KPI compactas (`p-3.5`, número `2rem`, icono 36px) sin badge "activo"; grid 2×2 mobile intacto.
- `AlertaItem` con jerarquía operativa: línea de motivo (Sin rotación / Rotación baja / Rotación suficiente) + fila SKU · Familia · Cantidad · Estado + chips de acción compactos naranja claro.
- Nombre de familia vía **lookup display-only** (`familias.nombre`) en el Dashboard; el hook de vencimientos solo trae `familia_id` y no se modificó.
- Padding bottom (`pb-28`) en el listado; bottom nav "Maestro" → "Productos" (ruta `/maestro` intacta).
- **Pendiente (necesita backend):** el bloque "Estado" está hardcodeado a "Sin gestionar". Mostrar "Gestionado" cuando exista una `acciones_operativas` para ese `vencimiento_id` requiere ampliar la query del hook (fuera de alcance de este cambio solo-UI).

### F5 — Notificaciones Web Push [x] (deployado, commit `089fe07`)
- Regla de negocio: notificar SOLO cuando un vencimiento transiciona a `'urgente'`; destinatarios = operadores de la familia del producto + admins.
- Migración `20260625000000_push_notifications.sql` (aplicada a prod): columna `vencimientos.nivel_actual` (CHECK 5 niveles) + tabla `push_subscriptions` (RLS ownership + índice único `(usuario_id, subscription->>'endpoint')`).
- `netlify/functions/enviar-push.ts`: gate por `x-webhook-secret`, resuelve destinatarios (`usuario_familias` + admins), envía con `web-push`/VAPID, limpia suscripciones `410/404`. Smoke test prod: 401 sin secret / 200 con secret.
- `public/sw.js` (service worker push + notificationclick) · `usePushNotifications` (registro SW, permiso, subscribe, upsert) · banner de activación en `AppLayout` · detección de transición en `useVencimientos` (UPDATE `nivel_actual='urgente'`).
- Webhook DB: `pg_net` + trigger `trg_notify_push_urgente AFTER UPDATE OF nivel_actual` → `net.http_post` a la function. Doble defensa de la regla (frontend escribe literal `'urgente'` + trigger `IS DISTINCT FROM OLD`).
- **Secretos** (VAPID private, `WEBHOOK_SECRET`) solo en Netlify env + trigger de DB; nunca en el repo.
- **~~Limitación PASO 7 client-triggered~~ RESUELTO (commit `f3fc04d`):** se agregó la función `recalcular_niveles_vencimientos()` + job `pg_cron` `recalcular-niveles-vencimientos` (diario `0 12 * * *` UTC = 09:00 ART, `pg_net`/trigger ya existentes) que recalcula `nivel_actual` server-side; las transiciones a `'urgente'` disparan el push aunque nadie abra la app. La lógica de riesgo queda **duplicada** (frontend `src/lib/riesgo.ts` + SQL) — actualizar ambos si cambian umbrales.
- **Pendiente de verificación manual:** recepción real en dispositivo con app cerrada, registro de SW, banner y guardado de suscripción (requieren teléfono real con permiso concedido).

### F6 — Análisis inteligente con DeepSeek [x] (deployado, commit `4182c7d`)
- Reemplaza la página `/maestro` (stub) por `/analisis`. Nav: "Análisis" + icono `BrainCircuit` (sidebar + mobile). Se eliminó `src/pages/Maestro.tsx` (huérfano).
- `netlify/functions/analisis.ts`: valida JWT → uid; **deriva rol/sucursal/familias server-side desde la DB e IGNORA el body del cliente** (aislamiento por rol más estricto que la spec). Arma prompt con vencimientos reales (producto/nivel/días/cantidad/venta/familia) + totales donación/decomiso del trimestre + fecha. Llama DeepSeek (`deepseek-chat`, temp 0.3, system prompt distinto operador/admin). 502 ante fallo del modelo.
- `useAnalisis` (token JWT, POST, estados, cache en localStorage) · `Analisis.tsx` (header, subtítulo por rol, generar/loading "Analizando tus datos…"/resultado/actualizar).
- **Secreto** `DEEPSEEK_API_KEY` solo en Netlify env; nunca en el repo. Smoke prod: gate 401 sin/con JWT inválido; key DeepSeek validada (200).
- **Pendiente de verificación manual:** path 200 end-to-end con login real (operador vs admin) — comparar el reporte devuelto contra los vencimientos reales.
- **Limitación:** el motor de riesgo está duplicado inline en la function (espejo de `src/lib/riesgo.ts`) porque la function no comparte el bundle del frontend. Si cambian los umbrales, actualizar ambos lugares.

#### F6.1 — Recomendaciones basadas en merma inevitable [x] (deployado, deploy ID `6a4196b734f4b619f578e47d`)
- `calcularMerma(cantidad, ventaMedia, dias)` en `analisis.ts`: `unidadesVenderANormal = ventaMedia * max(0, dias)`, `mermaUnidades = max(0, cantidad - unidadesVenderANormal)`, `mermaPorcentaje = cantidad>0 ? (m/c)*100 : 100`. Asigna `accion` en 4 niveles por umbral: MONITOREAR (≤20%) / OFERTA LEVE (≤50%) / PROMOCIÓN AGRESIVA (≤80%) / DONACIÓN INEVITABLE (>80%). Interfaz `MermaCalc` con tipado estricto (sin `any`).
- El prompt por producto ahora emite 8 campos: stock actual, venta media, unidades vendibles a precio normal, merma estimada (unidades y %) y acción calculada.
- `SYSTEM_OPERADOR`/`SYSTEM_ADMIN` reescritos: basarse SIEMPRE en la "Acción calculada", **no inventar % de descuento**, explicar en unidades concretas. Para DONACIÓN INEVITABLE → coordinar donación; para PROMOCIÓN AGRESIVA → urgencia sin % específico.
- Edge cases validados por QA (PASS): días negativos truncados con `Math.max(0, dias)` → 100% merma (vencido); ventaMedia=0 → 100%; cantidad=0 → 100% (defensivo, no se da en la práctica por el schema). Sin regresión de rol/familias/RLS. `tsc` + `build` limpios.
- Cosmético: se eliminó la redundancia "vencido hace X días" duplicada en la línea de "Días restantes" del prompt.
- **Nota:** `calcularMerma` se sumó a la copia inline del motor de riesgo (no se pudo importar `src/lib/riesgo.ts`, módulo frontend-only). Sigue pendiente extraer la lógica compartida a `shared/`.

---

# Sesión 2026-08-05 — Bugfixes RLS + auditoría del importador CSV

> Agente: Architect (NodoLabs Forge). Deploy `6a73ded558742b2b7fb65004`.
> Filosofía aplicada: datos confiables o no hay sistema. Si el importador miente,
> todo lo que se construye encima miente.

## ENTREGADO Y VERIFICADO

### S1 — Admin no podía eliminar vencimientos [x] (deployado)
- **Archivo:** `src/components/dashboard/EditarVencimientoModal.tsx:122-131`
- **Causa raíz:** el botón "Eliminar registro" hace un SOFT DELETE
  (`UPDATE vencimientos SET activo=false`). Las policies de UPDATE en producción
  eran `vencimientos_update` (`auth.uid() = usuario_id`) y `vencimientos_update_own`
  (`usuario_id = auth.uid()`). No existía policy para admin: el UPDATE afectaba
  **0 filas** y PostgREST **no devuelve error** en ese caso → falla silenciosa.
  Por eso el botón "no hacía nada" sin mensaje.
- **Migración:** `20260805000000_rls_vencimientos_admin_familia.sql` (aplicada).
  Helper `public.rol_actual()` (SECURITY DEFINER, `search_path` fijo, EXECUTE solo
  para `authenticated`) para no leer `usuarios` desde el cuerpo de la policy.
  Policies unificadas `vencimientos_update_admin_o_familia` y
  `vencimientos_delete_admin_o_familia`: admin/supervisor sin restricción, o
  autor del registro, o dueño de la familia del producto.
- **Decisión de diseño:** se conserva el OR `usuario_id = auth.uid()` a propósito.
  Hay 59 productos con `familia_id` NULL; sin ese OR los vencimientos cargados
  sobre esos productos quedarían inaccesibles para el operador que los cargó.
- **Verificación (6 tests contra producción, en transacción con ROLLBACK):**
  | Test | Resultado |
  |---|---|
  | Admin hace soft delete de registro ajeno | 1 fila — PASS |
  | Operador intenta borrar de familia ajena | 0 filas — PASS |
  | Operador borra en su propia familia | 1 fila — PASS |
  | Familia 003 → segundo operador | bloqueado — PASS |
  | Familia 003 → admin | permitido — PASS |
  | Promover a operador con familia en conflicto | bloqueado — PASS |
  Post-rollback: 30 vencimientos activos, 2 asignaciones, rol admin intactos.

### S2 — Familia exclusiva por operador [x] (deployado)
- **Migración:** `20260805000001_familia_exclusiva_operador.sql` (aplicada).
- **Decisión arquitectónica — trigger, NO índice único parcial:** el predicado de
  un índice parcial debe ser IMMUTABLE y PostgreSQL no admite subconsultas ahí.
  El `rol` vive en `public.usuarios`, no en `usuario_familias`, así que
  `WHERE (SELECT rol FROM usuarios ...) = 'operador'` es ilegal como predicado.
  La alternativa —desnormalizar `rol` dentro de `usuario_familias`— crea un
  segundo lugar de verdad que hay que mantener sincronizado. El trigger valida
  contra la fuente única y admite el lock advisory.
- `fn_familia_exclusiva_operador()` BEFORE INSERT/UPDATE en `usuario_familias`,
  con `pg_advisory_xact_lock` para cerrar la carrera entre transacciones
  concurrentes. Error `23505` con mensaje en castellano.
- `fn_rol_operador_sin_colision()` BEFORE UPDATE OF rol en `usuarios`: cubre el
  caso de promover a operador a alguien que ya tiene familias en conflicto.
- Al aplicar: 0 colisiones preexistentes (003 → Repositora Golosinas, 014 → Hernan).
- **Frontend:** `src/pages/Admin.tsx` — familias tomadas aparecen deshabilitadas
  con "Asignada a {nombre}", el bloqueo se recalcula al cambiar el rol, se depuran
  las selecciones en conflicto al pasar a operador, validación al guardar y
  rollback de familias si el INSERT falla.

### S3 — `/importar` estaba SIN PROTECCIÓN [x] (deployado) — no estaba en el brief
- **Archivo:** `src/router/index.tsx:73-80` (antes del fix).
- **Problema:** la ruta colgaba directamente de `PrivateRoute`, fuera del bloque
  `AdminRoute`. **Cualquier usuario autenticado, incluido un operador, podía
  entrar y reescribir stock, venta media y familia de productos de otras familias.**
- **Fix:** ruta movida bajo `AdminRoute`. Además en
  `src/components/layout/AppLayout.tsx` el link "Importar" estaba en
  `BASE_NAV_ITEMS` y `MOBILE_NAV_RIGHT_BASE`, o sea visible para operadores;
  se movió a `ADMIN_NAV_ITEMS`. Ocultar el link no alcanza — por eso el guard va
  igual —, pero ofrecérselo a quien no puede usarlo era una invitación al error.

### S4 — Reparación de descripciones corrompidas [x] (aplicada)
- **Migración:** `20260805000002_reparar_descripciones_mojibake.sql`.
- 6 productos tenían U+FFFD guardado en `descripcion` (`BA�O`, `SUE�OS`,
  `CASTA�AS`, `JALAPE�O`, `BA�ADA`), todos donde iba una `Ñ`. Verificado uno por
  uno: exactamente 1 carácter corrupto por fila, en los 6 el original es `Ñ`.
- Backup en `public.productos_descripcion_backup_20260805` (RLS: SELECT solo admin)
  con la query de rollback documentada en el archivo de migración.
- UPDATE acotado por lista explícita de descripciones: no puede tocar filas nuevas
  cuyo carácter corrupto no sea una `Ñ`. Restantes tras aplicar: 0.

### S5 — Módulos del importador, escritos y testeados [x] (mergeados, SIN CABLEAR)
- `src/lib/importar-csv.ts` — **38 tests pasando**
- `src/lib/importar-reconciliacion.ts` — **30 tests pasando**
- ⚠️ **Ninguno está importado por `src/pages/Importar.tsx` todavía.** Es código
  muerto: Vite lo tree-shakea y no aparece en los chunks del build. No afecta el
  bundle ni el comportamiento en producción.
- Cobertura de los tests, con los casos reales de producción:
  - `parsearNumeroArg('1.234')` → 1234 · `parsearNumeroArg('1.234,56')` → 1234.56
  - Latin-1 vs UTF-8 detectados y decodificados correctamente
  - CSV con columna nueva insertada: resuelve índices por nombre
  - Escenario Turrocklets completo (ver S6)

---

## PENDIENTE — próxima pasada

### P1 — Cablear la UI de `Importar.tsx` a los módulos [x] (deployado `6a73e65dc36bff84ecd43390`)
`Importar.tsx` pasó de 475 a ~1040 líneas, cableado a `importar-csv.ts` e
`importar-reconciliacion.ts`. Chunk: 33.85 kB → 97.16 kB. Construido en 4 partes
con ediciones incrementales (dos intentos previos de agente reventaron el límite
de 32k tokens de salida al escribir el archivo entero de una vez).

Gates implementados y verificados en el código:

- **C5 · Familia no resuelta [x]** — 8 caminos de corte antes de construir la
  reconciliación (`Importar.tsx:242`). Si la familia no resuelve, `recon` queda null
  y el preview nunca se renderiza. Mensajes distintos según si falta `Cód.Familia:`
  o si el código no existe en `familias`. Contexto del bug original:
  Si el regex `Cód.Familia:` no matchea o el código no existe en `familias`,
  `familiaId` queda null y los productos nuevos se insertan **sin `familia_id`**.
  Es el origen de los 59 productos huérfanos. Además, para un operador la RLS
  `productos_insert_operador_familia` exige `uf.familia_id = productos.familia_id`,
  así que con familia null **todos** los inserts fallan.
  Sigue pendiente: los 59 productos ya huérfanos no se reparan solos (ver P3).

- **C7 · Reasignación silenciosa de familia [x]** — `payload.familia_id` se asigna
  ahora en UN solo lugar (`Importar.tsx:334`), detrás de `debeAsignarFamilia()`:
  solo si el producto no tenía familia (repara huérfanos) o si el admin tildó ese
  producto puntual en la sección "Productos que cambiarían de familia".
  Contexto del bug original:
  `Importar.tsx:198`: `if (familiaId !== null) updatePayload.familia_id = familiaId`.
  Cada producto que matchea recibe la familia de ese CSV, pisando la que tenía.
  **Este es el mecanismo que corrompió Turrocklets** (ver S6/P3).
  La decisión es por producto, no un toggle global: cada conflicto se lista con
  "figura en [familia actual] en la app, este CSV dice [familia del CSV]".

- **C8 · Gate de confirmación de familia [x]** — `familiaConfirmada` arranca en
  `false`; el preview y el botón de confirmar están detrás de esa bandera
  (`Importar.tsx:629`) y `handleConfirmarImportacion` la vuelve a chequear (`:303`)
  como defensa en profundidad.
  La tarjeta nombra familia y operador asignado; si la familia no tiene operador,
  avisa en ámbar y permite continuar.

Los tres gates son independientes y se aplican en secuencia: C5 corta si no hay
familia; C8 confirma el archivo completo; C7 decide producto por producto. **No
unificar C7 con C8**: si confirmar el archivo implicara aceptar en bloque los
reetiquetados, se reproduce exactamente el bug que corrompió Turrocklets.

Además del brief, se agregó **aviso de posible duplicado** (`UMBRAL_AVISO = 0.70`):
los productos que van a insertarse como nuevos y se parecen entre 70% y 85% a uno
existente se listan como sospecha en el preview y en el reporte. El módulo solo
matchea automáticamente por encima de 0,85; esa franja intermedia antes se
insertaba en silencio.

⚠️ **Sin verificación funcional en navegador.** Los gates están verificados por
lectura de código y el build/lint pasan, pero nadie ejecutó todavía una
importación real contra un CSV de Glaciar. Antes de usarlo en serio conviene
probar con un archivo real y revisar el reporte.

### P2 — Los tres puntos de datos aprobados [x] (migración `20260805100000`)
1. **`usuarios.activo = true` para gerente091@gmail.com.** Hoy está en `false`.
   No es la causa del bug de borrado (ni `AdminRoute` ni `PrivateRoute` filtran por
   `activo`), pero es una inconsistencia.
2. **Deduplicar Turrocklets.** Sobreviviente `3328533` (id `be277e9a-0dfe-42a3-82db-a3e8dbd898fc`,
   stock 169, venta media 3.15). Pasos, en orden:
   - corregir su `familia_id` a **003 GOLOSINAS** (`1c4d345c-254a-4065-b111-f744f966faaa`);
     hoy figura en 014 por el bug C7
   - migrar el vencimiento activo `11731d9d-eb1e-46a0-b9bd-d97ed4f64a5b`
     (2 unidades, vence 2026-08-07, nivel `donacion`, 0 acciones, cargado por
     Repositora Golosinas) de `c4fba8e2` a `be277e9a`. **Sin colisión**: el
     sobreviviente tiene 0 vencimientos, así que no viola
     `uq_vencimiento_activo_por_producto_sucursal`
   - migrar `codigo_barras = '0000077993540'` al sobreviviente (hoy lo tiene solo
     el `0000000`). Si no se migra, al escanear el producto la app no lo encuentra
     y **crea un tercer duplicado**. ⚠️ El EAN tiene formato raro (ceros a la
     izquierda): validar contra el envase físico
   - `imagen_url`: **ninguno de los dos tiene foto**, no hay nada que conservar
   - desactivar `c4fba8e2` con `activo = false` (no borrar), con backup documentado
3. **Migración de limpieza dedicada** para los dos grupos de P3.

### P3 — Relevamiento de datos sucios [ ]
- **59 productos con `familia_id` NULL** (de 651). Invisibles a las consultas por
  familia y a la detección de huérfanos. Causa: C5.
- **11 productos con `cod_art` fuera de `^\d{4,8}$`**, todos cargados desde el
  Scanner. Nunca van a matchear un cod_art de Glaciar (7 dígitos):
  | cod_art | descripción | marca | stock | codigo_barras |
  |---|---|---|---|---|
  | `0000000` | Turrocklets | Arcor | 127 | `0000077993540` |
  | `7622201761288` | Galletitas mini chocolate | Oreo | 5 | null |
  | `7622210795625` | Chocolate leche | Milka | 133 | null |
  | `7790040003606` | Galletitas sabor queso | Mesitas | 9 | `7790040003606` |
  | `7790040484801` | Alfajor triple chocolate | Tofi | 98 | null |
  | `7790040953703` | Alfajor tofi blanco | Tofi | 74 | `7790040953703` |
  | `7790310985236` | Papas fritas clásicas | Lays | 68 | null |
  | `7790310985267` | Nachos sabor queso | Doritos | 103 | null |
  | `7790310985274` | Palitos de maiz con queso | Cheetos | 58 | `7790310985274` |
  | `7790310985335` | Papas flamin hot | Lays | 45 | null |
  | `7798267200044` | Alfajor de maicena | La bustincera | 27 | null |
  10 de los 11 tienen un **EAN-13 guardado en `cod_art`**; 6 de esos tienen
  `codigo_barras` en NULL pese a que el `cod_art` *es* el EAN. La limpieza debe
  mover `cod_art → codigo_barras` en esos casos.
  Los dos grupos son **disjuntos**: ninguno de los 11 está entre los 59 sin familia.
  Todos tienen `venta_media_diaria = 0`, así que el motor de riesgo los trata como
  "sin rotación".

### P4 — Productos con `familia_id` incorrecto [ ] INVESTIGACIÓN ABIERTA
**Límite declarado: no se puede resolver sin los CSV de Glaciar.** Cualquier lista
app-vs-Glaciar sin esos archivos sería inventada.

Lo que sí está establecido:
- **Mecanismo:** C7 (`Importar.tsx:198`), no UPDATEs manuales por descripción.
- **Evidencia forense:** 154 productos actualizados en 22 segundos
  (2026-05-29 23:43:07 → 23:43:29), ~7 por segundo — la firma del `for` secuencial
  con un `await` por producto del importador. Un `UPDATE ... WHERE ilike` manual
  habría sido instantáneo, en un único timestamp. Los 154 quedaron en familia 014.
- Turrocklets `3328533` fue actualizado el 2026-08-04 23:32 → otra corrida, mismo
  mecanismo.
- **Implicancia:** el reparto actual 003 (398 productos) / 014 (194) no refleja la
  taxonomía de Glaciar sino *qué CSV se importó último y matcheó cada producto*.

Query de detección, para correr cuando estén los CSV: cargar los `cod_art` de cada
CSV con su familia en una tabla temporal y hacer el `EXCEPT` contra
`productos.familia_id`. Otros lotes sospechosos detectados:
`2026-05-26 02:29:22` (13 productos, fam 003) y `2026-05-26 02:30:32` (9, fam 003).

### P5 — Hallazgos MEDIO/BAJO del importador [ ]
- **MEDIO · Atomicidad real.** `Importar.tsx:196-209`: N updates + N inserts
  secuenciales sin transacción. Si falla a la mitad queda estado parcial. El fix
  planificado (lotes de 50 con `Promise.all`) mejora la velocidad y el reporte de
  errores pero **no da atomicidad**. Para eso hace falta una RPC `SECURITY DEFINER`
  que reciba el lote y lo aplique en una transacción.
- **MEDIO · `descripcion` y `marca` del CSV nunca actualizan** el registro existente
  (`Importar.tsx:197` no las incluye). La divergencia entre lo que muestra la app y
  lo que dice Glaciar queda invisible. Reportar el drift en vez de pisar en silencio.
- **MEDIO · Sin deduplicación de `cod_art` dentro del mismo CSV** — resuelto en el
  módulo nuevo, falta cablearlo.
- **BAJO · `FOOTER_PATTERNS` incluye `'Fecha'`** (`Importar.tsx:59`): descarta
  cualquier línea que contenga esa palabra. Muy amplio; hoy no causa daño porque el
  guard del regex sobre la columna 0 ya filtra, pero es frágil.
- **BAJO · Mensaje de error genérico cuando no aparece `Cod.Art.`**: se reporta
  "no se encontraron productos" en vez de "no se encontró el encabezado".

### P6 — Deuda técnica arrastrada [ ]
- El motor de riesgo sigue **triplicado**: `src/lib/riesgo.ts`,
  `netlify/functions/analisis.ts` (copia inline) y la función SQL
  `recalcular_niveles_vencimientos()`. Si cambian los umbrales hay que tocar los tres.
- ~~Escalada de privilegios en `usuarios`~~ **[x] CERRADO** (por el usuario, vía SQL).
  `usuarios_update_admin_or_self` (`qual = true`, `with_check = true`) fue
  reemplazada por `usuarios_update_admin` y `usuarios_update_own`, esta última con
  un WITH CHECK que exige que `rol` y `activo` sigan iguales a los actuales.
  Verificado contra producción (4 tests, transacción con rollback): la auto-escalada
  a admin es rechazada por la policy, un operador no puede editar a otro usuario,
  sí puede editar su propio nombre, y el panel Admin sigue pudiendo editar a otros.
- Policies duplicadas en `vencimientos` (`_select` y `_select_authenticated`,
  `_insert` e `_insert_own`) y en `familias`. Las de UPDATE/DELETE ya se
  consolidaron; las de SELECT/INSERT siguen duplicadas.

---

## Cierre P2 — 2026-08-05

### P2.1 — `usuarios.activo = true` para gerente091@gmail.com [x]
Verificado: `activo = true`. Respaldo en `dedup_turrocklets_backup_20260805`.

### P2.2 — Turrocklets deduplicado [x]
Orden de ejecución obligado por el índice ÚNICO `productos_codigo_barras_key`:
hay que liberar el `codigo_barras` del duplicado ANTES de asignárselo al que
sobrevive. Invertir esos dos pasos hace fallar la migración entera.

Estado final verificado:
| cod_art | familia | stock | v.media | codigo_barras | activo | venc. activos |
|---|---|---|---|---|---|---|
| `0000000` | 003 | 127 | 0.00 | null | **false** | 0 |
| `3328533` | **003** | 169 | 3.15 | `0000077993540` | true | **1** |

El vencimiento migró al registro correcto conservando su `usuario_id`, así que
sigue perteneciendo a Repositora Golosinas, operadora de 003. La familia del
sobreviviente se corrigió de 014 a 003.

### P2.3 — EAN guardado en el campo equivocado [x] parcial
9 de 11 productos con EAN-13 en `cod_art` ahora tienen ese EAN también en
`codigo_barras`, para que el Scanner y el fallback del importador puedan
encontrarlos. `cod_art` se dejó como estaba: es NOT NULL y único, y no se puede
inventar el código real de Glaciar.

**Lo que NO se hizo y no se puede hacer sin los CSV de Glaciar:** reemplazar el
`cod_art` EAN por el real. Sigue abierto.

---

## HALLAZGO NUEVO — dos duplicados más del tipo Turrocklets [ ]

Los 2 productos que el guard de unicidad dejó fuera de P2.3 no eran un caso
borde: son **duplicados lógicos** del mismo producto físico. El `codigo_barras`
del registro de Glaciar es exactamente el `cod_art` del registro escaneado, lo
que los liga sin ambigüedad.

**Par 1 — Alfajor de maicena**
| origen | cod_art | descripción | stock | v.media | codigo_barras |
|---|---|---|---|---|---|
| Scanner | `7798267200044` | Alfajor de maicena | 27 | 0.00 | null |
| Glaciar | `3210595` | ALFAJORES DE MAICENA | 38 | 0.68 | `7798267200044` |

**Par 2 — Chocolate Milka**
| origen | cod_art | descripción | stock | v.media | codigo_barras |
|---|---|---|---|---|---|
| Scanner | `7622210795625` | Chocolate leche | 133 | 0.00 | null |
| Glaciar | `2319100` | CHOCOLATE CONLECHE MILKA Un(240 | 44 | 0.24 | `7622210795625` |

Ninguno de los 4 tiene vencimientos activos, así que deduplicarlos es de bajo
riesgo. Mismo procedimiento que Turrocklets: sobrevive el de Glaciar, hereda el
`codigo_barras`, y el escaneado se da de baja lógica.

⚠️ **El par 2 NO lo detecta el matcheo por descripción del importador**:
"Chocolate leche" contra "CHOCOLATE CONLECHE MILKA Un(240" queda por debajo del
umbral de 0,85. Sí aparece como huérfano con el badge "cod_art es un EAN", que es
la red que lo atrapa. Vale como recordatorio de que la similaridad de descripción
es una ayuda, no una garantía: **el `codigo_barras` es el único vínculo duro**
entre un producto escaneado y su equivalente en Glaciar.

Mejora candidata para el importador: cruzar el `codigo_barras` del producto de
Glaciar contra el `cod_art` de los productos escaneados (hoy se hace la
comparación inversa). Cerraría este tipo de duplicado de raíz.

---

## CORRECCIÓN — las 87 escrituras NO fueron el importador

Una versión previa de este documento atribuía las 87 escrituras del
2026-08-06 00:50:58 al importador nuevo, por leer esa concentración como lotes de
`Promise.all`. **Era incorrecto.** Fue un UPDATE masivo corrido a mano en el SQL
Editor con los 415 cod_art del CSV real de familia 003, más dos UPDATE sueltos
(`3127680` → 014 Pehuamar, `2989207` → 003 Galak).

Los números cierran: 57 NULL + 31 de 014 del script + 2 manuales = 59 → 0.

**Nadie corrió todavía una importación con el código nuevo. Los gates C5/C7/C8
siguen SIN validación funcional**: están verificados por lectura de código, tests
de los módulos y build/lint, pero ninguna importación real pasó por ellos.

Lección metodológica: una sola sentencia SQL escribe todas sus filas en el mismo
instante, o sea MÁS concentrado que los lotes de la aplicación, no menos. La
concentración temporal por sí sola no distingue "bulk UPDATE manual" de "lotes de
la app". Lo que sí discrimina es lo opuesto: ~7 filas/segundo sostenido durante
decenas de segundos (como el lote del 2026-05-29) solo puede ser un bucle
secuencial con un `await` por fila. Esa inferencia sigue en pie; la de las 87 no.

Aparte: los vencimientos activos bajaron de 30 a 18 (118 totales, 100 inactivos,
86 vencidos, 0 activos vencidos). Consistente con la operación normal o el job
`pg_cron`, no con las migraciones de esta sesión.

---

## Duplicados por código de barras — detección y limpieza [x]

### Mejora en el módulo: el vínculo duro
`importar-reconciliacion.ts` ahora cruza el `codigo_barras` del producto de
Glaciar contra el `cod_art` de los productos escaneados (antes solo hacía la
comparación inversa). Nuevo campo `duplicadosPorEan` en `Reconciliacion`, con
sección propia en el preview y en el reporte. Los pares detectados así se excluyen
de la lista de huérfanos, porque tienen un diagnóstico más preciso.

**Por qué la similaridad de descripción no alcanza** (medido, no estimado):
- "Chocolate leche" vs "CHOCOLATE CONLECHE MILKA Un(240" → **0,591**
- Umbral de matcheo automático → 0,85

### Tres pares deduplicados (migraciones `20260805110000` y `dedup_cofler_ean8`)
Criterio uniforme: sobrevive el registro de Glaciar, el escaneado queda con
`activo = false`. Nada se borra. Los 3 tenían 0 vencimientos activos.

| # | Glaciar (sobrevive) | Scanner (baja) | detectado por |
|---|---|---|---|
| 1 | `3210595` ALFAJORES DE MAICENA (38 u, 0.68) | `7798267200044` Alfajor de maicena (27 u) | EAN-13 en cod_art |
| 2 | `2319100` CHOCOLATE CONLECHE MILKA (44 u, 0.24) | `7622210795625` Chocolate leche (133 u) | **solo** el codigo_barras |
| 3 | `2986826` CHOCOLATE BLANCO CON MANI COFLER (105 u, 0.37) | `77981912` Chocolate blanco con mani (167 u) | **solo** el codigo_barras |

### ⚠️ Hallazgo importante: el EAN-8 es indetectable por formato
El par 3 apareció recién con la mejora. Su `cod_art` `77981912` es un **EAN-8**:
tiene 8 dígitos, así que **pasa el patrón `^\d{4,8}$` de un cod_art válido de
Glaciar**. `clasificarCodArt()` lo devuelve como `null` (sano) y el badge
"cod_art es un EAN" nunca se le muestra.

**Ninguna heurística de formato puede atrapar este caso**, porque el espacio de
los EAN-8 se solapa exactamente con el de los códigos legítimos de Glaciar. El
`codigo_barras` es el único discriminante. Esto refuerza la regla: la similaridad
de descripción y el formato del código son ayudas; el código de barras es la
única evidencia dura de que dos registros son el mismo producto físico.

Estado final: **0 duplicados por EAN activos**. 647 productos activos, 4 inactivos
(los 3 pares + Turrocklets), 19 filas respaldadas en
`dedup_turrocklets_backup_20260805`.

### Pendiente relacionado
Detectar duplicados donde el registro de Glaciar **no** tenga `codigo_barras`
cargado. Ahí no hay vínculo duro y solo queda la similaridad de descripción, con
sus falsos negativos conocidos. La única solución de fondo es que el Scanner
guarde el EAN en `codigo_barras` y nunca en `cod_art`.

---

## Scanner — cerrar el agujero de raíz [x] (deploy `6a73ecd2831ba97ff1cc9766`)

### Hallazgo previo: el bug principal YA estaba cerrado
Antes de tocar nada se auditaron todos los caminos que escriben `cod_art`. El
commit `841a3bc` (**2026-05-27**) ya había agregado validación estricta:
truncado a 7 dígitos, `codArtValido()` exigiendo exactamente 7, precarga que
manda 13 dígitos al campo EAN, y botón de guardar deshabilitado si algo no valida.

**Los 16 registros con `cod_art` fuera de formato se crearon entre el 2026-05-22
y el 2026-05-24 — todos anteriores a ese commit. Ninguno después.** El Scanner no
venía generando duplicados nuevos; los que hay son legacy.

### Pero había cuatro huecos reales, y uno era un bloqueo funcional

**1 · El EAN-8 no se podía cargar en absoluto** — `eanNuevoValido()` exigía
exactamente 13 dígitos. EAN-8 es el estándar de productos chicos: golosinas y
chocolates, justo el catálogo de este comercio. El operador escaneaba, recibía
"El EAN debe tener exactamente 13 dígitos" y el botón de guardar quedaba
deshabilitado **sin ningún camino alternativo**. Es plausible que así naciera
`77981912`: el 24 de mayo todavía se podía meter en `cod_art`.
→ Ahora se aceptan 8 (EAN-8), 12 (UPC-A), 13 (EAN-13) y 14 (GTIN-14).

**2 · `0000000` seguía pasando la validación** — siete dígitos, o sea válido para
`esCodArtValido()`. Es el placeholder exacto que originó el duplicado de
Turrocklets, y hasta hoy se podía volver a crear. Lo detectó un test, no la
lectura del código.
→ Se rechaza el cod_art de todos ceros. Los ceros a la izquierda siguen siendo
válidos: `0022354` es un código real.

**3 · Faltaba el chequeo del vínculo duro antes de insertar** — el alta verificaba
`cod_art` duplicado y `codigo_barras` duplicado, pero no el caso clave: que ya
exista un producto **cuyo `cod_art` sea exactamente el EAN que se está por
registrar**. Ese es el duplicado legacy, y sin el chequeo se creaba uno nuevo.
→ `buscarConflictoCodigos()` en `useProductos`, con tres motivos distintos y
mensaje accionable por cada uno. **No filtra por `activo`**: los índices únicos
aplican también a los productos dados de baja, y antes reutilizar el código de
uno desactivado devolvía una violación de constraint cruda sin decir cuál era.

**4 · `handleEanCapturado` guardaba lo que viniera del lector sin validar el largo**
→ Ahora valida, y además chequea el vínculo duro antes de asignar.

### Módulo nuevo: `src/lib/codigos.ts`
Centraliza la regla, que antes estaba repetida en 6 lugares como literales
`/^\d{7}$/` y `/^\d{13}$/`. **21 tests.**

**Invariante verificada por test, no por inspección:** la intersección entre
"EAN válido" y "cod_art válido" es vacía, porque ningún largo de EAN (8, 12, 13,
14) coincide con el largo del cod_art (7). Es lo que hace estructuralmente
imposible que un código de barras real entre como código interno.

Los 4 duplicados reales de producción (`0000000`, `7798267200044`,
`7622210795625`, `77981912`) están en la suite: los cuatro son rechazados hoy.

### ⚠️ Límite que hay que tener presente
El EAN-8 y el cod_art de Glaciar **no se pueden distinguir con certeza por
formato** cuando el largo coincide — el espacio de los EAN-8 se solapa con el de
los códigos internos de 8 dígitos. Acá se resuelve porque el cod_art de Glaciar
es de largo fijo 7, pero si algún día Glaciar emite códigos de 8 dígitos, la
desambiguación por formato deja de funcionar. El discriminante robusto es el
origen del dato: lector de barras → EAN; tipeo en el campo de código interno →
cod_art. El código está estructurado así.

### Pendiente relacionado
- Los 12 productos legacy con `cod_art` fuera de formato que NO son duplicados
  conocidos siguen sin poder matchear con Glaciar. Aparecen como huérfanos en
  cada importación. Reparar cada uno requiere el cod_art real del CSV.
- Hay 4 productos con `cod_art` de 8 dígitos y descripción en mayúsculas estilo
  Glaciar (`12651129`, `13487283`, `33568577`, `00586790`, todos del
  2026-05-22 19:30-19:32, todos con `codigo_barras` NULL). No tienen gemelo
  detectable por código de barras. Habría que revisarlos contra el CSV: pueden
  ser duplicados cuyo par no tiene el EAN cargado.
