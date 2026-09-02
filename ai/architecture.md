# Arquitectura del sistema

Estado: multitenant en producción desde el cutover del 2026-08-27, operando la Sucursal 091.

## Capas

1. **UI** — React 18 + shadcn/ui, mobile-first. `src/pages/`, `src/components/`.
2. **Router** — React Router 7, definido en `src/router/index.tsx`.
3. **Hooks y lib** — lógica de negocio en `src/hooks/` y `src/lib/`.
4. **Netlify Functions** — `netlify/functions/`. Toda escritura operativa pasa por acá o por RPC.
5. **Supabase** — PostgreSQL 17 + Auth + RLS. La autoridad de permisos vive acá.

## Jerarquía y alcance

```text
organización
  └── zona
      └── sucursal
          ├── gerente de sucursal
          ├── supervisor
          └── operadores por familia
```

El alcance efectivo de cada usuario vive en `usuario_accesos` (rol + sucursal o zona) y, para operadores, en `usuario_familias_sucursal`.

**RLS es la autoridad.** React puede ocultar información por UX, pero jamás es la barrera de seguridad. No existe SELECT abierto de datos operativos: `TO authenticated USING (true)` no es una política aceptable.

El browser tiene únicamente `SELECT` sobre las tablas de negocio. Las escrituras pasan por RPC `SECURITY DEFINER` o por funciones Netlify que validan alcance server-side antes de escribir.

Invariantes completas en `docs/MULTITENANT_ARCHITECTURE_V1.md`.

## Catálogo compartido vs. estado por sucursal

Distinción central del modelo:

- **Catálogo, compartido por organización:** `productos`, `producto_codigos`, y la clasificación `cod_art → familia`. Un EAN aprendido por una sucursal queda disponible para toda la organización.
- **Estado, propio de cada sucursal:** `producto_sucursal` (`stock_actual`, `venta_media_diaria`, última importación). La combinación `(producto_id, sucursal_id)` es única.

El mismo SKU puede tener stock y velocidad de venta distintos en varias sucursales sin sobrescribirse.

## Motor predictivo

La ventana comercial real termina en el umbral obligatorio de donación del sector, no en la fecha de vencimiento:

```text
dias_comerciales_restantes = max(dias_hasta_vencimiento - dias_donacion, 0)
dias_stock                 = cantidad_comprometida / venta_media_diaria
velocidad_necesaria        = cantidad_comprometida / dias_comerciales_restantes
hay_riesgo                 = dias_stock > dias_comerciales_restantes
```

Se evalúa la **cantidad comprometida con esa fecha de vencimiento**, no el stock total del reporte. `dias_donacion` proviene de `sectores.dias_donacion` (2 días para perecederos confirmados, 10 para el resto); nunca se infiere en el cliente ni se hardcodea un valor global. No se redondea `dias_stock` hacia abajo: las fracciones importan en la frontera.

Niveles: `seguro`, `radar` (≤45 días con riesgo persistente), `urgente` (≤20 días), `donacion` (alcanzó el umbral del sector), `decomiso` (venció).

Implementación en `src/lib/riesgo.ts`. Reglas de negocio completas, incluido el ciclo RAG, en `docs/RISK_AND_RAG_RULES_V1.md`.

## Flujos de datos

**Importación Glaciar:** CSV → parseo y preview local → detección de organización y sucursal → verificación de autorización server-side → hash → rechazo si el archivo ya fue procesado → transacción → actualización de `producto_sucursal` + inserción de `producto_snapshots` inmutables → registro del resultado en `importaciones`.

**Scanner:** lectura de código de barras → lookup en catálogo de la organización → carga de vencimiento vía RPC transaccional → visible en Dashboard e Historial según alcance.

**Ciclo RAG:** producto en Radar → intervención con porcentaje → control posterior → resultado (`efectivo` / `sin_movimiento`) → escalamiento si persiste → cierre terminal auditable (`vendido` / `donacion` / `decomiso`).

## Capa de IA

`netlify/functions/analisis.ts` arma un prompt determinístico con el resultado económico del trimestre en curso contra la ventana equivalente del trimestre previo, y lo envía a un proveedor de inferencia externo. El servidor valida `sucursal_id` contra `usuario_accesos`; el cliente no decide rol ni familias; el cache queda aislado por `usuario_id + sucursal_id`.

No hay agentes autónomos: la capa de IA es analítica, no ejecuta el ciclo agentic descrito en `PRODUCT_VISION.md`.

El proveedor está **pendiente de decisión** — ítem 1.5 de `docs/PRE_PRODUCTION_HARDENING_PLAN.md`.
