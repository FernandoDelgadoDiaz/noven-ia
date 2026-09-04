# NoVen IA

Capa de inteligencia operacional para supermercados: detecta, evita, recupera y demuestra pérdidas económicas evitables.

**La fuente de verdad de producto es `PRODUCT_VISION.md`.** Si algo de este archivo la contradice, prevalece esa. NoVen no es una app de vencimientos ni un dashboard: la gestión de vencimientos es el primer dominio, no el producto.

Estado actual: productivo en una sola sucursal (091), con arquitectura multitenant ya cerrada. Ver `docs/PRE_PRODUCTION_HARDENING_PLAN.md` para el estado del plan de endurecimiento.

## Stack

- React 18.3 + TypeScript 5.6 + Vite 6
- TailwindCSS 3.4 + shadcn/ui
- React Router 7
- Supabase JS v2 (PostgreSQL + Auth + RLS)
- Netlify Functions para toda escritura operativa
- html5-qrcode (scanner), web-push (notificaciones)

Los reportes Glaciar se parsean con código propio en `src/lib/importar-*.ts`. No hay dependencia de SheetJS ni de ninguna librería de planillas.

## Rutas

Públicas: `/login`, `/activar`.

Autenticadas: `/dashboard`, `/scanner`, `/vencimientos`, `/historial`, `/analisis`, `/problemas`, `/importar`, `/importar/familia`, `/importar/masivo`, `/importar/pendientes`, `/importar/pendientes/aprender`, `/admin`, `/admin/accesos`.

Definidas en `src/router/index.tsx`, que es la referencia.

## Motor predictivo

La ventana comercial real termina en el umbral obligatorio de donación del sector, no en el vencimiento:

```
dias_comerciales_restantes = max(dias_hasta_vencimiento - dias_donacion, 0)
dias_stock                 = cantidad_comprometida / venta_media_diaria
hay_riesgo                 = dias_stock > dias_comerciales_restantes
```

Se evalúa la **cantidad comprometida con esa fecha de vencimiento**, no el stock total informado por Glaciar. `dias_donacion` proviene siempre de `sectores.dias_donacion`; nunca se infiere en el cliente.

Niveles: `seguro`, `radar` (≤45 días), `urgente` (≤20 días), `donacion` (alcanzó el umbral del sector), `decomiso` (venció).

Implementación en `src/lib/riesgo.ts`. Reglas completas en `docs/RISK_AND_RAG_RULES_V1.md`.

## Capa de IA

`netlify/functions/analisis.ts` genera análisis gerencial comparando el trimestre en curso contra la ventana equivalente del trimestre previo. OpenAI es el proveedor elegido en el ítem 1.5 y se invoca desde la Function mediante `OPENAI_API_KEY`; la clave nunca se expone al browser.

## Comandos

- `npm run dev` — desarrollo local en localhost:5173
- `npm run build` — build de producción
- `npm run lint` — linting
- `npm test` — suite de contratos (`scripts/tests/*.test.mjs`)
- `npx playwright test` — E2E de navegador (contra Supabase interceptado por fixture)

## Reportes

Todo cierre de tarea o avance parcial se entrega como **reporte listo para copiar y pegar**: un bloque autocontenido, con el estado, lo que se hizo, lo que falta y lo que quedó pendiente de decisión. Sin depender del hilo de la conversación para entenderse.

## Referencias

- `PRODUCT_VISION.md` — visión de producto (normativa)
- `docs/PRE_PRODUCTION_HARDENING_PLAN.md` — estado del plan de endurecimiento
- `docs/MULTITENANT_ARCHITECTURE_V1.md` — arquitectura e invariantes multitenant
- `docs/RISK_AND_RAG_RULES_V1.md` — reglas de riesgo, donación y RAG
- `ai/rules.md` — reglas de código
- `ai/architecture.md` — arquitectura del sistema
- `ai/decisions.md` — decisiones técnicas
- `ai/contracts.md` — contratos de interfaces

## Variables de entorno

Ver `.env.example`
