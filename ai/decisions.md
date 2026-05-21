# Decisiones tecnicas

## Vite vs Next.js
**Decision:** Vite + React SPA
**Razon:** App mobile-first tipo PWA, no necesita SSR. Vite es mas rapido para desarrollo y el deploy en Netlify es trivial con SPA redirect.

## cod_art vs codigo_barras
**Decision:** Usar `cod_art` como identificador primario del producto
**Razon:** El codigo de barras puede no estar disponible para todos los productos. El `cod_art` es el identificador interno del negocio y siempre existe. El scanner usa codigo de barras como lookup secundario.
