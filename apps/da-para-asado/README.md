# ¿Da para asado?

Microapp de un solo archivo (`index.html`, React 18 + htm desde CDN) que lee el pronóstico real de
Open-Meteo para Río Gallegos y recomienda ventanas para asar al aire libre, priorizando el viento.

## Datos
- Primero intenta `fetch` directo a `api.open-meteo.com` (funciona en cualquier hosting estático).
- Dentro de un Artifact de Claude ese `fetch` está bloqueado por la política de seguridad; entonces usa
  el conector Firecrawl del usuario (`firecrawl_scrape`, 1 crédito por actualización, resultado cacheado 15 min).
- Si todo falla muestra el error y, si existe, el último pronóstico real guardado con su fecha. Nunca inventa datos.

## Publicar en un hosting propio
Subir `index.html` a Netlify, GitHub Pages, etc. No requiere build ni claves.
Nota: el archivo omite `<!doctype>/<html>/<head>` porque el Artifact los agrega; los navegadores lo
renderizan igual, pero para hosting propio conviene envolverlo en un esqueleto HTML estándar.

## Pruebas
- Motor: `node --test tests/engine.test.mjs`
- Navegador (Playwright, Open-Meteo interceptado con un pronóstico sintético):
  `VENDOR_DIR=<carpeta con react-18.3.1, react-dom-18.3.1 y htm-3.1.1 extraídos de npm pack> node --test --test-concurrency=1 tests/e2e.test.mjs`
