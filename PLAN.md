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
