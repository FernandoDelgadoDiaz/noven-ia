// Validación del Artifact PUBLICADO con respuestas REALES capturadas (no simula el clima).
// Lo que sí se simula es el transporte: el navegador local no puede salir a internet,
// así que las respuestas capturadas se entregan interceptando la red.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const PUB = process.env.PUBLISHED_HTML, V = process.env.VENDOR_DIR, OUT = process.env.SHOTS_DIR;
const LIVE = JSON.parse(readFileSync(new URL("./data/live-2026-11-14T1440.json", import.meta.url)));
const fc = structuredClone(LIVE.forecast);
fc.hourly.time = [];
for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) fc.hourly.time.push(fc.daily.time[d] + "T" + String(h).padStart(2, "0") + ":00");
const AT = new Date("2026-11-14T17:40:27Z");
const html = readFileSync(PUB, "utf8");
const browser = await chromium.launch();
const log = (k, v) => console.log(k.padEnd(34), typeof v === "string" ? v : JSON.stringify(v));

async function run(name, { forecast = fc, metar = LIVE.metar_raw, direct = true, mcp = null, prefs = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (prefs) await ctx.addInitScript((p) => localStorage.setItem("dpa:prefs:v1", JSON.stringify(p)), prefs);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.clock.setFixedTime(AT);
  if (mcp) await page.addInitScript(mcp, { fc: JSON.stringify(forecast), metar });
  await page.route("**/*", (r) => {
    const u = r.request().url();
    if (u === "https://app.test/") return r.fulfill({ contentType: "text/html", body: html });
    if (u.includes("react-dom.production")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(V + "/react-dom-18.3.1/package/umd/react-dom.production.min.js") });
    if (u.includes("react.production")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(V + "/react-18.3.1/package/umd/react.production.min.js") });
    if (u.includes("htm.umd")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(V + "/htm-3.1.1/package/dist/htm.umd.js") });
    if (!direct) return r.abort();
    if (u === LIVE.metar_url) return metar === null ? r.abort() : r.fulfill({ contentType: "text/plain", body: metar, headers: { "access-control-allow-origin": "*" } });
    if (u.startsWith("https://api.open-meteo.com/v1/forecast?")) return forecast === null ? r.abort() : r.fulfill({ contentType: "application/json", body: JSON.stringify(forecast), headers: { "access-control-allow-origin": "*" } });
    return r.abort();
  });
  await page.goto("https://app.test/");
  await page.waitForTimeout(1500);
  console.log("\n=== " + name);
  return { page, ctx, errs };
}
const T = (page, sel) => page.locator(sel).first().innerText().then((t) => t.replace(/\s+/g, " ").trim()).catch(() => "(no está)");

// 1) Datos reales, consulta directa
{
  const { page, ctx, errs } = await run("A. Respuestas reales, consulta directa");
  log("Actualizado", await T(page, ".meta"));
  log("Observado (caja)", await T(page, '[data-kind="obs"]'));
  log("Modelo (caja)", await T(page, '[data-kind="model"]'));
  log("Esta hora", await T(page, ".now-hour"));
  log("Comparación", await T(page, '[data-testid="cmp"]'));
  log("Hoy (veredicto)", await T(page, ".hero .verdict"));
  log("Hoy (horario)", await T(page, ".hero .best-time"));
  for (const d of [2, 3, 4]) {
    await page.locator("#now-dur-" + d).click();
    log(`Ahora ${d} h: mejor`, await T(page, ".now-best .now-best-head"));
    log(`Ahora ${d} h: por qué`, await T(page, ".now-best ul.why"));
    log(`Ahora ${d} h: alternativas`, await page.locator(".alt-row").allInnerTexts().then((a) => a.map((s) => s.replace(/\s+/g, " "))));
  }
  log("Aviso tarde agradable", await T(page, ".now-card .notice"));
  log("Oportunidades", await page.locator(".opps .opp").allInnerTexts().then((a) => a.map((s) => s.split("\n").slice(0, 3).join(" | "))));
  log("Pie de fuentes", await T(page, ".now-card .src-foot"));
  log("Errores JS", errs);
  if (OUT) await page.screenshot({ path: OUT + "/live-A.png", fullPage: true });
  await ctx.close();
}
// 2) Mismas respuestas reales entregadas por el conector Firecrawl simulado (como dentro de Claude)
{
  const mcp = ({ fc, metar }) => {
    window.claude = { use: (n) => Promise.resolve(n !== "mcp" ? null : { callTool: (s, t, input) =>
      Promise.resolve({ content: [], payload: { rawHtml: /aviationweather/.test(input.url) ? metar : fc }, cache: { storedAt: Date.now() - 4 * 60000, revalidating: false } }) }) };
  };
  const { page, ctx, errs } = await run("B. Mismas respuestas reales vía conector (transporte simulado)", { direct: false, mcp });
  log("Actualizado", await T(page, ".meta"));
  log("Pie de fuentes", await T(page, ".now-card .src-foot"));
  log("Errores JS", errs);
  await ctx.close();
}
// 3) Fallas y datos incompletos (simulados a partir de los reales)
{
  const { page, ctx } = await run("C1. Falla Open-Meteo, METAR real OK", { forecast: null });
  log("Aviso", await T(page, ".notice[role=alert]")); log("¿Hay veredicto?", await page.locator(".hero").count());
  await ctx.close();
}
{
  const { page, ctx } = await run("C2. Falla METAR, Open-Meteo real OK", { metar: null });
  log("Observado (caja)", await T(page, '[data-kind="obs"]')); log("Ahora 3 h", await T(page, ".now-best .now-best-head"));
  await ctx.close();
}
{
  const { page, ctx } = await run("C3. METAR ilegible", { metar: "<html>error</html>" });
  log("Observado (caja)", await T(page, '[data-kind="obs"]'));
  await ctx.close();
}
{
  const inc = structuredClone(fc); delete inc.hourly.wind_gusts_10m;
  const { page, ctx } = await run("C4. Open-Meteo sin ráfagas (incompleto)", { forecast: inc });
  log("Hoy", await T(page, ".hero")); log("Oportunidades", await T(page, ".opps")); log("Ahora 3 h", await T(page, ".now-best"));
  await ctx.close();
}
{
  const inc = structuredClone(fc); delete inc.current;
  const { page, ctx } = await run("C5. Open-Meteo sin dato actual", { forecast: inc });
  log("Modelo (caja)", await T(page, '[data-kind="model"]'));
  await ctx.close();
}
// 4) Límites configurados con datos reales
{
  const { page, ctx } = await run("D. Preferencias estrictas (viento 10, ráfaga 20, sensación 16)", { prefs: { duration: 3, minFeels: 16, maxWind: 10, maxGust: 20, slot: "libre", exposure: "expuesta" } });
  log("Oportunidades", await page.locator(".opps .opp").allInnerTexts().then((a) => a.map((s) => s.split("\n").slice(0, 3).join(" | "))));
  log("Ahora 3 h", await T(page, ".now-best .now-best-head"));
  await ctx.close();
}
await browser.close();
