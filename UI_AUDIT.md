# UI_AUDIT.md — NoVen IA
Fecha: 2026-05-23  
Estado: Solo auditoría. Cero modificaciones.

---

## 1. Árbol UI

```
App
├── Router
│   ├── /login → Login.tsx
│   └── AppLayout.tsx (layout raíz autenticado)
│       ├── nav bottom (fixed, 64px)
│       │   ├── /dashboard  → Inicio        (LayoutDashboard)
│       │   ├── /scanner    → Scanner       (ScanLine)
│       │   ├── /vencimientos → Vencimientos (Calendar)
│       │   ├── /maestro    → Maestro       (Package)
│       │   └── /importar   → Importar      (FileUp) [hidden mobile]
│       └── <Outlet />
│           ├── Dashboard.tsx
│           │   ├── RiesgoCard ×4 (grid 2×2)
│           │   ├── AlertaItem[] (lista ordenada por riesgo)
│           │   └── EditarVencimientoModal (portal, on-demand)
│           ├── Scanner.tsx (máquina de estados: inicio → confirmando → capturar_ean → formulario → exito → nuevo_producto)
│           │   ├── ScannerModal (fullscreen, portal)
│           │   ├── ProductoConfirm (paso 2)
│           │   └── VencimientoForm (paso 3)
│           ├── Vencimientos.tsx
│           │   ├── ChipFiltro[] (overflow-x scroll)
│           │   ├── VencimientoCard[] (lista)
│           │   └── EditarVencimientoModal (portal, on-demand)
│           ├── Maestro.tsx  ← STUB: solo <div>Maestro</div>
│           └── Importar.tsx (drag-drop CSV + preview tabla)
│
└── shadcn/ui primitives (solo en Login)
    button, card, input, label
```

---

## 2. Sistema visual actual

### Colores

| Token | Valor | Uso real |
|---|---|---|
| primary | HSL 142.1 76.2% 36.3% ≈ #16a34a | Definido en CSS var pero NUNCA usado vía `bg-primary`. Se hardcodea como `#16a34a`, `#15803d`, `#166534` en ~30 lugares |
| --background | HSL 210 40% 98% (casi blanco) | Solo en body; las páginas pisan con `bg-slate-50` o `bg-gray-950` |
| --card | white | Solo en Login via shadcn |
| --border | HSL 214.3 31.8% 91.4% | Solo en Login via shadcn |

**Paleta real en uso (hardcodeada):**
- Light surfaces: `white`, `bg-slate-50`, `bg-slate-100`, `bg-slate-200`
- Dark surfaces: `bg-zinc-900`, `bg-gray-800`, `bg-gray-900`, `bg-gray-950`
- Borders light: `border-slate-200`, `border-slate-300`
- Borders dark: `border-gray-700`, `border-gray-800`
- Accent: `#16a34a` (verde Tailwind green-600)
- Semáforo riesgo: green-500, yellow-500, orange-500, red-500, gray-700

**Problema central de tema:** NO hay un solo modo. La app mezcla arbitrariamente light y dark dentro del mismo viewport:

```
Dashboard (página)
├── header      → bg-white/95         ← light
├── RiesgoCards → bg-green/red/blue transparente ← neutralish
└── AlertaItem  → bg-zinc-900         ← DARK
                                          ↑
                            Contraste jarring light+dark
                            dentro de la misma pantalla
```

- `Login`, `Dashboard` (shell), `Vencimientos`, `AppLayout` → light (slate)
- `AlertaItem`, `EditarVencimientoModal`, `ProductoConfirm`, `VencimientoForm`, `Importar` → dark (zinc/gray)
- `ScannerModal` → negro puro (bg-black) ← único que tiene sentido como fullscreen

### Tipografía

- **Fuente:** No declarada. Hereda del sistema operativo (SF Pro / Segoe UI / Roboto).
- **Escala en uso:**
  - `text-[10px]` — labels de nav (no-standard, fuera de escala Tailwind)
  - `text-xs` (12px) — badges, metadata
  - `text-sm` (14px) — contenido secundario dominante
  - `text-base` (16px) — body, botones CTA
  - `text-lg` / `text-xl` — títulos de página Scanner (solo en sub-pasos)
  - `text-2xl` — éxito Scanner
  - `text-3xl` — título Login
- **Pesos:** `font-medium`, `font-semibold`, `font-bold`
- **Tracking:** `tracking-tight` (Login h1), `tracking-wide` (Dashboard section label)
- Sin font stack personalizado. Sin variable fonts. Sin Inter/Geist/etc.

### Spacing

- Padding horizontal estándar: `px-4` (16px) en todas las páginas
- Max-width contenido: `max-w-2xl` (672px) en Dashboard y Vencimientos; `max-w-4xl` en Importar
- Padding bottom para bottom nav: `pb-16` (64px) en AppLayout main
- Gap interno de componentes: inconsistente (gap-2, gap-3, gap-4, gap-6 sin criterio fijo)
- Sección `space-y-6` en Dashboard, `space-y-4` en Vencimientos, `space-y-3` en listas

### Radios

Inconsistentes. Tres valores en uso sin sistema:
- `rounded-lg` (8px) — botones secundarios en algunos lugares
- `rounded-xl` (12px) — inputs, cards Vencimientos, error boxes
- `rounded-2xl` (16px) — cards Scanner, modal, botones CTA principales
- `rounded-full` — badges, dots semáforo, nav pills

No existe decisión explícita "cards = xl, botones = 2xl". Se mezclan.

### Sombras

Sin sistema de elevación. Solo dos tokens en uso:
- `shadow-sm` — AppLayout nav, algunas cards (Vencimientos), Scanner tip
- `shadow-md` — Login card (único componente con sombra visible)
- La mayoría de cards tienen **cero sombra** — separación visual solo por `border`

### Navegación

- Arquitectura: **bottom tab bar** fija (64px), 5 ítems
- Ícono + label (10px), mínimo 56px de ancho por ítem
- Estado activo: color cambia a `#16a34a`. **Sin** highlight de fondo, **sin** pill indicator, **sin** burbuja de notificación
- Estado inactivo: `text-slate-400`
- El 5° ítem (Importar) se oculta en mobile con `hidden md:flex` pero sigue en el DOM
- No hay "Scanner" como botón FAB central diferenciado

---

## 3. Design Debt

### Elementos genéricos

**RiesgoCard:**  
Un contador numérico grande sobre fondo semitransparente coloreado con borde del mismo color. Es exactamente el patrón de "stat card" de cualquier starter template de Tailwind/shadcn. No hay nada que transmita urgencia operacional, contexto temporal, ni diferenciación de marca.

```
┌─────────────────────────┐
│ EN RIESGO         🔴    │
│                         │
│ 7                       │  ← número sin unidad, sin tendencia,
└─────────────────────────┘    sin comparativa
```

**AlertaItem (dashboard):**  
5 líneas de texto stacked. La información más crítica (nombre del producto, nivel de riesgo) comparte peso visual con metadata operacional (Cod. Art, EAN, venta media). El badge de riesgo está en la esquina superior derecha pero es pequeño. Un usuario que escanea rápido no sabe inmediatamente qué hacer.

**Error boxes:**  
Mismo patrón en Dashboard, Vencimientos, Scanner, EditarVencimientoModal, VencimientoForm: `bg-red-X/30 border border-red-X rounded-xl`. Genérico y sin personalidad.

**Loading spinner:**  
`border-2 border-white border-t-transparent rounded-full animate-spin`. Aparece en 6+ lugares idéntico. No hay ningún skeleton personalizado que refleje el shape de los datos que van a aparecer (excepto los rectangulares de Dashboard).

### Componentes repetitivos

| Patrón duplicado | Archivos | Problema |
|---|---|---|
| Configuración de colores por nivel de riesgo | riesgo.ts (`BADGE_CONFIG`), AlertaItem.tsx (`nivelConfig`), Vencimientos.tsx (`NIVEL_CONFIG`), VencimientoForm.tsx (`getNivelConfig`) | 4 definiciones divergentes del mismo semáforo |
| Spinner de carga | Dashboard, Scanner, VencimientoForm, EditarVencimientoModal, ScannerModal | JSX copy-paste, sin componente `<Spinner>` |
| Error box | Dashboard, Vencimientos, Scanner, VencimientoForm, EditarVencimientoModal, Importar | Misma estructura inline, no hay `<ErrorAlert>` |
| Botón cancelar ghost | Scanner (×3), EditarVencimientoModal | Mismo `text-slate-400 hover:text-slate-600 text-sm` inline |
| Header de página (sticky, backdrop-blur) | Dashboard, Vencimientos, Importar | Cada uno re-implementa la misma estructura |

### UI poco premium

1. **Ausencia de fuente propia.** Sistema font-stack hace que la app no tenga identidad tipográfica. En mobile iOS se ve diferente que en Android.

2. **Botones sin profundidad.** Los CTA primarios (`bg-[#16a34a]`) son planos. No hay gradiente sutil, no hay `box-shadow` de color, no hay estado pressed convincente más allá de `active:bg-[#166534]`.

3. **El modal de edición (EditarVencimientoModal) es oscuro en una app que tiene contexto light.** Overlay `bg-black/70` + modal `bg-gray-900` funciona bien en un contexto dark. Aquí aparece sobre una pantalla light y el contraste cultural es incorrecto (se siente como un popup de otra app).

4. **Sin micro-animaciones de entrada/salida.** El modal aparece instantáneamente. Las cards no tienen `animate-in`. Los estados de éxito son abruptos.

5. **El estado de éxito del Scanner** (`paso === 'exito'`) es un `animate-pulse` sobre un círculo verde. Funciona pero se siente provisional.

6. **Emojis como iconos funcionales.** RiesgoCard usa `🔴`, `📡`, `⛔` como íconos de estado. En producción, los emojis tienen rendering inconsistente entre plataformas y tamaños.

7. **Sin gradientes.** Todo es flat. Una superficie oscura pura, sin ninguna profundidad.

### Problemas mobile

**Bottom nav:**
- Label `text-[10px]` está por debajo de los 11px recomendados para mobile (iOS Human Interface Guidelines).
- Sin feedback háptico implementable (pero tampoco hay `touchstart` preparado para ello).
- En iPhone con home indicator, el `h-16` puede no tener el `safe-area-inset-bottom` correcto (no se detecta `pb-safe` o `env(safe-area-inset-bottom)` en el código).

**Scanner página principal:**
- El botón de escaneo es una caja de 160px de alto con `border-dashed`. Visualmente se lee como un "drop zone" para archivos, no como una acción primaria táctil.
- Un usuario nuevo podría no saber si debe "tap" o "drag" aquí.
- El `min-h-[160px]` se siente arbitrario. No llena el espacio de pantalla disponible.

**Dashboard RiesgoCards:**
- Grid 2×2 en mobile con `gap-3` = cards de ~160px de ancho. El número "0" o "7" en `text-3xl` queda bien pero el título `text-xs uppercase tracking-wide` es ilegible a un vistazo rápido.

**Vencimientos - filtros:**
- `overflow-x-auto` con chips: funciona pero sin indicador de scroll (sin fade lateral, sin scrollbar visible). El usuario no sabe que hay más filtros.
- `flex gap-2` con select + input de búsqueda al mismo ancho (`flex-1`): en pantallas de 375px el select y el input quedan demasiado angostos para ser usables cómodamente.

**Scanner - paso formulario (VencimientoForm):**
- Inputs de `h-14` (56px) son correctos para mobile.
- Sin `inputMode="decimal"` en el campo de fecha (usa `type="date"` nativo, que es correcto, pero el estilo `[color-scheme:dark]` puede tener comportamiento inconsistente).

**Textos truncados:**
- AlertaItem usa `truncate` en el título del producto. En mobile esto corta nombres como "CHOCOLATE ARCOR TABLETA LECHE 100G — ARCOR" de manera confusa.
- ProductoConfirm muestra título completo (correcto) pero VencimientoCard en Vencimientos usa `line-clamp-2` (mejor, pero inconsistente con AlertaItem).

### Falta de jerarquía visual

**Dashboard:**  
Todo tiene el mismo peso. El flujo de lectura natural en mobile va de arriba hacia abajo, pero no hay ninguna señal de qué es más importante. Un producto en `decomiso` está en la lista pero visualmente no grita más que uno en `seguro` (solo cambia el dot color y el badge text). El tamaño, indentación y fondo son idénticos.

```
AlertaItem decomiso:   bg-zinc-900 | tamaño X | dot gris
AlertaItem seguro:     bg-zinc-900 | tamaño X | dot verde
```

No hay nada que haga al decomiso inmediatamente visible como urgente.

**Vencimientos:**  
VencimientoCard tiene 3 niveles de información: nombre/marca, fecha/días, badge. Pero el badge (nivel) está en la esquina superior derecha como texto pequeño. La información más accionable (qué hacer con este producto ahora mismo) está oculta detrás del modal.

**Scanner - StepIndicator:**  
Tres dots de 6×6px y un "1/3" en texto-xs. Funciona como indicador de progreso pero tiene cero presencia visual. En mobile el usuario puede no notarlo.

---

## 4. Detección de patrones problemáticos

### Admin-template feeling

**Checklist de síntomas:**

- [x] Stat cards 2×2 en home con número grande + label + ícono (patrón dashkit/adminlte/shadcn-dashboard)
- [x] Sidebar/nav con íconos + labels iguales para todos los ítems
- [x] Color primario como único acento sin paleta secundaria
- [x] Cards blancas con `border border-slate-200` como único separador
- [x] Tipografía system-font sin identidad propia
- [x] El único componente "shadcn puro" es el Login (Card/Input/Label/Button sin personalización)
- [x] Headers con `sticky top-0 z-10 bg-white/95 backdrop-blur border-b` = textbook

El Dashboard en particular se ve como cualquier proyecto que partió de `shadcn/ui` + Tailwind sin diseño propio. La paleta verde es la única diferenciación de marca.

### Cards planas

**RiesgoCard:**  
`border-${color}/30 bg-${color}/10` = solo tinte de color con opacidad baja. Sin elevación (box-shadow), sin gradiente, sin texture. Dos clics en cualquier screenshot de Dribbble muestran cómo debería verse una stat card de operaciones críticas.

**VencimientoCard (Vencimientos):**  
`bg-white border border-slate-200 rounded-2xl shadow-sm`. Completamente genérica. No transmite nada sobre el nivel de riesgo del ítem. El semáforo (dot) de 12px es lo único que diferencia visualmente un producto en decomiso de uno en estado seguro.

**AlertaItem (Dashboard):**  
Fondo oscuro plano `bg-zinc-900 border border-zinc-800`. Funcional pero sin jerarquía. Las 5 líneas de texto tienen pesos parecidos. No hay ninguna zona visualmente "caliente" para decomiso.

### Navegación débil

**Bottom nav actual:**
```
[Dashboard] [Scanner] [Vencimientos] [Maestro] [Importar*]
    ↑          ↑            ↑            ↑
  mismo      mismo        mismo        mismo
  tamaño     tamaño       tamaño       tamaño
```
Sin diferenciación de importancia entre tabs. El Scanner debería ser el tab principal —la acción que el operario realiza decenas de veces al día— pero tiene exactamente la misma jerarquía visual que "Maestro" (un stub vacío).

**Ausencia de:**
- Pill/indicator de tab activo (solo cambio de color, sin background)
- Badge de conteo en Dashboard tab (ej: "3 decomiso")
- FAB central para Scanner (patrón estándar mobile-first para acción principal)
- Transición animada entre tabs

### Scanner poco protagonista

La página Scanner es la razón de existir de esta app. Un operario la usa 20-50 veces por turno. Sin embargo:

1. **CTA de escaneo:** Caja rectangular con borde punteado gris, ícono verde, texto. Visualmente idéntica a un drag-drop de Importar. No comunica "esto es lo que hacés aquí".

2. **Sin affordance inmediata.** El primer frame de la página muestra: header con título, step indicator, y la caja. No hay nada que indique que "tap aquí → cámara abre" de forma inmediata.

3. **Flujo de pasos:** Steps 1/3 → 2/3 → 3/3. El indicator es correcto pero minimalista. No hay contexto de dónde está el usuario en el flujo.

4. **La cámara (ScannerModal)** es lo mejor de toda la app: fullscreen negro, recuadro con esquinas verde, línea animada de scan. Pero es un modal encima de la página, no una experiencia integrada.

5. **Pantalla de éxito:** `animate-pulse` sobre círculo verde. El auto-dismiss en 2 segundos es correcto. Pero la pantalla de éxito podría ser un momento de marca ("¡Registrado!") en lugar de un estado transitorio genérico.

### Dashboard poco operacional

El dashboard es supuestamente la herramienta de toma de decisiones del encargado. Problemas:

**Stat cards no son accionables:**  
"7 en riesgo" no lleva a ningún lado. No es tappable, no filtra la lista, no muestra detalle. Son decorativas.

**Lista de alertas sin acción directa:**  
Para actuar sobre un producto hay que: tap item → esperar modal → cambiar dato → guardar → modal cierra. Mínimo 4 taps para la acción más común (confirmar que un producto fue retirado).

**Sin contexto temporal:**  
No muestra la fecha de hoy ni el período de análisis. Un encargado que entra a las 8am no ve "hoy es viernes 23/05" ni "vencen hoy: 3 productos".

**Sin diferenciación de urgencia en la lista:**  
Un producto en decomiso y uno en radar están en la misma lista con el mismo tamaño de card. Solo el dot de color y el badge los diferencia. No hay rows de color rojo, no hay pinned items, no hay separación por secciones urgentes/no urgentes.

**Sin estado "todo ok":**  
Si no hay alertas, aparece la pantalla vacía con "📦 No hay productos registrados aun". Pero este mismo estado vacío aparece tanto cuando no hay datos (día 1) como cuando todo está en orden. No hay diferencia entre "sin datos" y "operación limpia".

**Refresh manual:**  
No hay pull-to-refresh. El spinner en el header indica carga pero no hay forma de refrescar manualmente los datos.

---

## Resumen ejecutivo

| Área | Estado | Prioridad |
|---|---|---|
| Sistema de color unificado | Partido: light/dark mezclados | Alta |
| Fuente tipográfica | System font, sin identidad | Alta |
| Semáforo de riesgo | 4 definiciones duplicadas | Alta |
| Scanner como hero action | Debil: dashed box genérica | Alta |
| Dashboard operacional | Stat cards decorativas, sin acción directa | Alta |
| Jerarquía visual alertas | Decomiso visualmente igual a seguro | Alta |
| Bottom nav | Sin peso diferenciado por importancia | Media |
| Cards con elevación | Flat, sin sombras, sin profundidad | Media |
| Microanimaciones | Ninguna (excepto spinner) | Media |
| Safe area mobile (iOS) | No detectada | Media |
| Emojis como iconos | Rendering inconsistente | Baja |
| Spinner como componente | 6× copy-paste | Baja |
| Maestro | Stub vacío en producción | Baja |
