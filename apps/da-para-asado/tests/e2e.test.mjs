// Pruebas de navegador: la API de Open-Meteo se intercepta con un pronóstico sintético.
// VENDOR_DIR debe apuntar a copias locales de react 18.3.1, react-dom 18.3.1 y htm 3.1.1 (npm pack).
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { buildForecast } from "./fixture.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const VENDOR = process.env.VENDOR_DIR;
if (!VENDOR) throw new Error("Definí VENDOR_DIR");
const SHOTS = process.env.SHOTS_DIR || null;
const PAGE = readFileSync(here + "../index.html", "utf8");
const SKELETON = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + PAGE + "</body></html>";
const FIXED = new Date("2026-11-14T13:05:00Z"); // 10:05 en Río Gallegos
const FORECAST = buildForecast("2026-11-14");

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function open({ api = "ok", claude = null, scheme = "light", ctx: reuse } = {}) {
  const ctx = reuse || await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.clock.setFixedTime(FIXED);
  const state = { api, calls: 0 };
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("https://app.test/")) return route.fulfill({ contentType: "text/html", body: SKELETON });
    if (u.includes("react-dom.production.min.js")) return route.fulfill({ contentType: "text/javascript", body: readFileSync(VENDOR + "/react-dom-18.3.1/package/umd/react-dom.production.min.js") });
    if (u.includes("react.production.min.js")) return route.fulfill({ contentType: "text/javascript", body: readFileSync(VENDOR + "/react-18.3.1/package/umd/react.production.min.js") });
    if (u.includes("htm.umd.js")) return route.fulfill({ contentType: "text/javascript", body: readFileSync(VENDOR + "/htm-3.1.1/package/dist/htm.umd.js") });
    if (u.includes("fonts.googleapis.com")) return route.fulfill({ contentType: "text/css", body: "" });
    if (u.startsWith("https://api.open-meteo.com/")) {
      state.calls++;
      assert.match(u, /latitude=-51\.62&longitude=-69\.22/);
      assert.match(u, /wind_gusts_10m/);
      assert.match(u, /timezone=America%2FArgentina%2FRio_Gallegos/);
      if (state.api === "ok") return route.fulfill({ contentType: "application/json", body: JSON.stringify(FORECAST), headers: { "access-control-allow-origin": "*" } });
      if (state.api === "400") return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: true, reason: "Parámetro inválido" }), headers: { "access-control-allow-origin": "*" } });
      return route.abort();
    }
    return route.abort();
  });
  if (claude) await page.addInitScript(claude, JSON.stringify(FORECAST));
  await page.goto("https://app.test/");
  return { page, ctx, errors, state };
}

test("camino feliz: veredicto, ranking, última actualización", async () => {
  const { page, ctx, errors } = await open();
  await page.locator(".hero .verdict").waitFor();
  assert.match(await page.locator(".hero .verdict").innerText(), /Sí, da/);
  assert.match(await page.locator(".hero .best-time .big").innerText(), /12:00\s*–\s*15:00/);
  assert.match(await page.locator(".hero .say").innerText(), /^Hoy entre las 12:00 y las 15:00 es tu mejor oportunidad/);
  assert.match(await page.locator(".meta").innerText(), /Actualizado: .*10:05/);
  assert.equal(await page.locator(".opps .opp").count(), 7);
  const first = await page.locator(".opps .opp").first().innerText();
  assert.match(first, /Hoy/); assert.match(first, /Ideal para asado/);
  const all = await page.locator(".opps").innerText();
  assert.match(all, /Ráfagas de hasta 55 km\/h/); // se explica por qué se descarta
  assert.match(all, /Faltan datos del pronóstico/);
  if (SHOTS) {
    await page.screenshot({ path: SHOTS + "/light-top.png", fullPage: true });
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("preferencias: duración y franja cambian la recomendación y se guardan", async () => {
  const { page, ctx } = await open();
  await page.locator(".hero .verdict").waitFor();
  await page.getByRole("button", { name: "Preferencias" }).click();
  await page.locator("#dur-5").click();
  assert.match(await page.locator(".hero .best-time .big").innerText(), /12:00\s*–\s*17:00/);
  await page.locator("#slot-noche").click();
  assert.match(await page.locator(".hero .verdict").innerText(), /Hoy no da/);
  await page.locator("#slot-libre").click();
  await page.locator("#exp-protegida").click();
  await page.locator("#maxGust").fill("20");
  assert.equal(await page.locator('output[for="maxGust"]').innerText(), "20 km/h");
  await page.getByRole("button", { name: "Cerrar" }).click();
  assert.equal(await page.locator(".sheet").count(), 0);
  await page.reload();
  await page.locator(".hero .verdict").waitFor();
  assert.match(await page.locator(".hero .best-time .big").innerText(), /12:00\s*–\s*17:00/, "la duración de 5 h se mantiene tras recargar");
  await page.getByRole("button", { name: "Preferencias" }).click();
  assert.equal(await page.locator("#exp-protegida").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator('output[for="maxGust"]').innerText(), "20 km/h");
  await ctx.close();
});

test("gráfico horario: cambio de día y selección de hora", async () => {
  const { page, ctx, errors } = await open({ scheme: "dark" });
  await page.locator(".chart-wrap svg").waitFor();
  assert.match(await page.locator(".hour-detail").innerText(), /12:00/);
  await page.locator(".day-chip").nth(3).click();
  assert.equal(await page.locator(".day-chip").nth(3).getAttribute("aria-pressed"), "true");
  assert.match(await page.locator(".hour-detail").innerText(), /Lluvia/);
  const box = await page.locator(".chart-wrap").boundingBox();
  // 30 de 360 unidades de margen izquierdo + 24 columnas: la hora 20 cae en x = 30 + 20.5 * 12.5
  await page.mouse.click(box.x + box.width * ((30 + 20.5 * 12.5) / 360), box.y + box.height / 2);
  assert.match(await page.locator(".hour-detail .row1").innerText(), /20:00/);
  assert.match(await page.locator(".hour-detail").innerText(), /80 %/);
  await page.locator(".opps .opp").nth(1).click(); // tocar una oportunidad selecciona ese día
  const selDate = await page.locator(".day-chip[aria-pressed=true] .dd").innerText();
  assert.ok(selDate.length > 0);
  if (SHOTS) {
    await page.locator(".chart-card").screenshot({ path: SHOTS + "/dark-chart.png" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: SHOTS + "/dark-top.png" });
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("sin conexión: error claro, sin datos inventados, y reintento", async () => {
  const { page, ctx, state } = await open({ api: "fail" });
  await page.locator(".notice").waitFor();
  assert.match(await page.locator(".notice").innerText(), /Sin conexión/);
  assert.match(await page.locator(".notice").innerText(), /No se muestran datos inventados/);
  assert.equal(await page.locator(".hero").count(), 0);
  state.api = "ok";
  await page.getByRole("button", { name: "Reintentar" }).click();
  await page.locator(".hero .verdict").waitFor();
  assert.equal(await page.locator(".notice").count(), 0);
  // falla posterior: se conserva el último pronóstico real con aviso
  state.api = "fail";
  await page.getByRole("button", { name: "Actualizar pronóstico" }).click();
  await page.locator(".notice.warn").waitFor();
  assert.match(await page.locator(".notice").innerText(), /último pronóstico descargado/);
  assert.equal(await page.locator(".hero").count(), 1);
  await ctx.close();
});

test("error de la API se informa con su motivo", async () => {
  const { page, ctx } = await open({ api: "400" });
  await page.locator(".notice").waitFor();
  assert.match(await page.locator(".notice").innerText(), /Parámetro inválido/);
  await ctx.close();
});

function mockClaude(mode) {
  return new Function("fixture", `
    window.claude = { use: function (name) {
      if (name !== "mcp") return Promise.resolve(null);
      return Promise.resolve({ callTool: function (server, tool, input) {
        window.__mcpCall = { server: server, tool: tool, input: input };
        if (${JSON.stringify(mode)} === "ok") return Promise.resolve({ content: [], payload: { rawHtml: fixture, metadata: { statusCode: 200 } } });
        return Promise.reject({ code: ${JSON.stringify(mode)}, message: "x" });
      } });
    } };`);
}

test("dentro de Claude: usa el conector Firecrawl cuando el fetch directo está bloqueado", async () => {
  const { page, ctx, errors } = await open({ api: "fail", claude: mockClaude("ok") });
  await page.locator(".hero .verdict").waitFor();
  assert.match(await page.locator(".meta").innerText(), /vía Firecrawl/);
  const call = await page.evaluate(() => window.__mcpCall);
  assert.equal(call.server, "Firecrawl");
  assert.equal(call.tool, "firecrawl_scrape");
  assert.match(call.input.url, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
  assert.deepEqual(call.input.formats, ["rawHtml"]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("dentro de Claude sin conector: indica cómo resolverlo", async () => {
  const { page, ctx } = await open({ api: "fail", claude: mockClaude("server_not_connected") });
  await page.locator(".notice").waitFor();
  assert.match(await page.locator(".notice").innerText(), /Falta el conector Firecrawl/);
  await ctx.close();
  const r2 = await open({ api: "fail", claude: mockClaude("approval_required") });
  await r2.page.locator(".notice").waitFor();
  assert.match(await r2.page.locator(".notice").innerText(), /Falta tu permiso/);
  assert.equal(await r2.page.getByRole("button", { name: "Permitir y actualizar" }).count(), 1);
  await r2.ctx.close();
});

test("sin overflow horizontal a 360 px", async () => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const { page } = await open({ ctx });
  await page.locator(".hero .verdict").waitFor();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 0, "overflow de " + over + " px");
  await page.getByRole("button", { name: "Preferencias" }).click();
  const over2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over2 <= 0);
  await ctx.close();
});
