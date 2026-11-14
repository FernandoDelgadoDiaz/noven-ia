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
// METAR SINTÉTICO de prueba (formato real, valores inventados para el escenario de prueba).
const METAR = "METAR SAWG 141300Z 25008KT CAVOK 12/04 Q1016\nMETAR SAWG 141200Z 26006KT CAVOK 10/04 Q1017";

let browser;
const tab = (page, t) => page.locator("#tab-" + t).click();
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function open({ api = "ok", claude = null, scheme = "light", ctx: reuse, forecast = FORECAST, at = FIXED, metar = METAR, trend = null, archive = null } = {}) {
  const ctx = reuse || await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.clock.setFixedTime(at);
  const state = { api, calls: 0, metar, forecast };
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("https://app.test/")) return route.fulfill({ contentType: "text/html", body: SKELETON });
    if (u.includes("react-dom.production.min.js")) return route.fulfill({ contentType: "text/javascript", body: readFileSync(VENDOR + "/react-dom-18.3.1/package/umd/react-dom.production.min.js") });
    if (u.includes("react.production.min.js")) return route.fulfill({ contentType: "text/javascript", body: readFileSync(VENDOR + "/react-18.3.1/package/umd/react.production.min.js") });
    if (u.includes("htm.umd.js")) return route.fulfill({ contentType: "text/javascript", body: readFileSync(VENDOR + "/htm-3.1.1/package/dist/htm.umd.js") });
    if (u.includes("fonts.googleapis.com")) return route.fulfill({ contentType: "text/css", body: "" });
    if (u.startsWith("https://aviationweather.gov/")) {
      state.metarCalls = (state.metarCalls || 0) + 1;
      if (state.metar === "fail" || state.api === "fail") return route.abort();
      return route.fulfill({ contentType: "text/plain", body: state.metar, headers: { "access-control-allow-origin": "*" } });
    }
    if (u.startsWith("https://archive-api.open-meteo.com/")) {
      return archive ? route.fulfill({ contentType: "application/json", body: JSON.stringify(archive), headers: { "access-control-allow-origin": "*" } }) : route.abort();
    }
    if (u.startsWith("https://api.open-meteo.com/") && u.includes("forecast_days=16")) {
      return trend ? route.fulfill({ contentType: "application/json", body: JSON.stringify(trend), headers: { "access-control-allow-origin": "*" } }) : route.abort();
    }
    if (u.startsWith("https://api.open-meteo.com/")) {
      state.calls++;
      assert.match(u, /latitude=-51\.62&longitude=-69\.22/);
      assert.match(u, /wind_gusts_10m/);
      assert.match(u, /timezone=America%2FArgentina%2FRio_Gallegos/);
      if (state.api === "ok") return route.fulfill({ contentType: "application/json", body: JSON.stringify(state.forecast), headers: { "access-control-allow-origin": "*" } });
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
  await tab(page, "semana");
  assert.equal(await page.locator(".opps .opp").count(), 3, "solo ventanas ideales o con precauciones");
  assert.equal(await page.locator('.opps .opp[data-level="no"]').count(), 0);
  const first = await page.locator(".opps .opp").first().innerText();
  assert.match(first, /Hoy, sábado 14\/11/); assert.match(first, /Ideal para asado/);
  assert.match(first, /Condiciones ideales de 12:00 a 18:00 \(6 h seguidas\)/);
  const opps = await page.locator(".opps").innerText();
  assert.doesNotMatch(opps, /Disponible|disponible/);
  assert.doesNotMatch(opps, /No conviene/);
  // días descartados: desplegable, cerrado por defecto
  const disc = page.locator("details.discarded");
  assert.match(await disc.locator("summary").innerText(), /Días sin condiciones favorables \(4\)/);
  assert.equal(await disc.evaluate((e) => e.open), false);
  await disc.locator("summary").click();
  const dtxt = await disc.innerText();
  assert.match(dtxt, /Mañana, domingo 15\/11 — No conviene hacer asado/);
  assert.match(dtxt, /Lunes 16\/11|Martes 17\/11/);
  assert.match(dtxt, /Ráfagas de hasta 55 km\/h/);
  assert.match(dtxt, /Faltan datos del pronóstico/);
  assert.doesNotMatch(dtxt, /\d\d:00 – \d\d:00/, "los días descartados no muestran horarios como recomendación");
  if (SHOTS) {
    await page.screenshot({ path: SHOTS + "/light-top.png", fullPage: true });
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("preferencias: duración y franja cambian la recomendación y se guardan", async () => {
  const { page, ctx } = await open();
  await page.locator(".hero .verdict").waitFor();
  await tab(page, "semana");
  await page.getByRole("button", { name: "Preferencias" }).click();
  await page.locator("#dur-2").click();
  assert.equal(await page.locator(".opps .opp").count(), 4, "con 2 h aparece la ventana 14–16 del jueves");
  assert.match(await page.locator(".opps").innerText(), /14:00 – 16:00/);
  await page.getByRole("button", { name: "Cerrar" }).click();
  await tab(page, "hoy");
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
  await page.locator(".hero .verdict").waitFor();
  await tab(page, "pronostico");
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
  await tab(page, "semana");
  await page.locator(".opps .opp").nth(1).click(); // tocar una oportunidad abre el gráfico de ese día
  assert.equal(await page.locator("#tab-pronostico").getAttribute("aria-current"), "page");
  const selDate = await page.locator(".day-chip[aria-pressed=true] .dd").innerText();
  assert.ok(selDate.length > 0);
  if (SHOTS) {
    await page.locator(".chart-card").screenshot({ path: SHOTS + "/dark-chart.png" });
    await tab(page, "semana");
    await page.locator("details.discarded summary").click();
    await page.screenshot({ path: SHOTS + "/dark-full.png", fullPage: true });
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("sin conexión: error claro, sin datos inventados, y reintento", async () => {
  const { page, ctx, state } = await open({ api: "fail" });
  await page.locator(".notice[role=alert]").waitFor();
  assert.match(await page.locator(".notice[role=alert]").innerText(), /Sin conexión/);
  assert.match(await page.locator(".notice[role=alert]").innerText(), /No se muestran datos inventados/);
  assert.equal(await page.locator(".hero").count(), 0);
  state.api = "ok";
  await page.getByRole("button", { name: "Reintentar" }).click();
  await page.locator(".hero .verdict").waitFor();
  assert.equal(await page.locator(".notice[role=alert]").count(), 0);
  // falla posterior: se conserva el último pronóstico real con aviso
  state.api = "fail";
  await page.getByRole("button", { name: "Actualizar pronóstico" }).click();
  await page.locator(".notice.warn[role=alert]").waitFor();
  assert.match(await page.locator(".notice[role=alert]").innerText(), /último pronóstico descargado/);
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
        if (/aviationweather/.test(input.url)) return ${JSON.stringify(mode)} === "ok" ? Promise.resolve({ content: [], payload: { rawHtml: "METAR SAWG 141300Z 25008KT CAVOK 12/04 Q1016" } }) : Promise.reject({ code: ${JSON.stringify(mode)}, message: "x" });
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
  assert.deepEqual(errors.filter((e) => !/Failed to load resource/.test(e)), [], "solo se espera el fetch directo bloqueado");
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
  await tab(page, "semana");
  await page.locator("details.discarded summary").click();
  const over1 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over1 <= 0, "overflow con descartados abiertos: " + over1);
  for (const t of ["pronostico", "planificar"]) {
    await tab(page, t);
    if (t === "planificar") await page.locator("#q-anionuevo").click();
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(o <= 0, "overflow en " + t + ": " + o);
  }
  await page.getByRole("button", { name: "Preferencias" }).click();
  const over2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over2 <= 0);
  await ctx.close();
});

test("sin condiciones favorables en 7 días: mensaje claro y ninguna ventana inventada", async () => {
  const storm = {};
  for (let d = 0; d < 7; d++) storm[d] = () => ({ temp: 14, feels: 8, prob: 0, precip: 0, code: 3, wind: 35, gust: 62, dir: 250 });
  const { page, ctx, errors } = await open({ forecast: buildForecast("2026-11-14", storm) });
  await page.locator(".hero .verdict").waitFor();
  assert.match(await page.locator(".hero .verdict").innerText(), /Hoy no da/);
  assert.equal(await page.locator(".hero .best-time").count(), 0, "no se destaca ningún horario");
  assert.match(await page.locator(".hero").innerText(), /No encontramos condiciones recomendables para hacer asado en los próximos 7 días/);
  await tab(page, "semana");
  assert.match(await page.locator(".opps").innerText(), /No encontramos condiciones recomendables para hacer asado en los próximos 7 días/);
  assert.equal(await page.locator(".opps .opp:not(.empty)").count(), 0);
  assert.match(await page.locator("details.discarded summary").innerText(), /\(7\)/);
  await tab(page, "pronostico");
  assert.equal(await page.locator(".rec-mark").count(), 0, "el gráfico no marca ventanas");
  assert.equal(await page.locator(".chart-wrap svg").count(), 1, "el gráfico sigue funcionando");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("fechas: Hoy y Mañana según Río Gallegos aunque el teléfono esté en otro huso", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Tokyo" });
  // 02:30 UTC del 15/11 = 23:30 del 14/11 en Río Gallegos, pero ya es 15/11 en Tokio
  const { page } = await open({ ctx, at: new Date("2026-11-15T02:30:00Z") });
  await page.locator(".hero .verdict").waitFor();
  await tab(page, "pronostico");
  await page.locator(".day-chip").first().waitFor();
  assert.equal(await page.locator(".day-chip").first().innerText().then((t) => t.replace(/\s+/g, " ").trim()), "Hoy 14/11");
  assert.equal(await page.locator(".day-chip").nth(1).innerText().then((t) => t.replace(/\s+/g, " ").trim()), "Mañ 15/11");
  assert.match(await page.locator(".meta").innerText(), /Actualizado: sáb 14\/11, 23:30/);
  await tab(page, "planificar");
  assert.equal(await page.locator(".cal-cell.today").getAttribute("data-date"), "2026-11-14", "el calendario marca hoy según Río Gallegos");
  await tab(page, "hoy");
  assert.match(await page.locator(".hero .verdict").innerText(), /Por hoy ya fue/);
  await ctx.close();
});

test("tarjeta de hoy: puntaje igual al de la lista, sin superposición en iPhone", async () => {
  for (const width of [320, 375, 390]) {
    for (const prefs of [null, { minFeels: 16 }]) { // ideal y «con cuidado» (título más largo)
      const ctx = await browser.newContext({ viewport: { width, height: 800 } });
      if (prefs) await ctx.addInitScript((p) => { try { localStorage.setItem("dpa:prefs:v1", JSON.stringify(Object.assign({ duration: 3, minFeels: 10, maxWind: 20, maxGust: 30, slot: "libre", exposure: "expuesta" }, p))); } catch (e) {} }, prefs);
      const { page } = await open({ ctx });
      await page.locator(".hero .verdict").waitFor();
      const heroScore = await page.locator(".hero .ring .n").innerText();
      const heroTone = await page.locator(".hero .ring circle").nth(1).getAttribute("stroke");
      await tab(page, "semana");
      const todayCard = page.locator(".opps .opp", { hasText: "Hoy," }).first();
      assert.equal(heroScore, await todayCard.locator(".ring .n").innerText(), "mismo puntaje que la lista");
      assert.equal(heroTone, await todayCard.locator(".ring circle").nth(1).getAttribute("stroke"), "mismo color");
      await tab(page, "hoy");
      const t = await page.locator(".hero .hero-title").boundingBox();
      const v = await page.locator(".hero .verdict").boundingBox();
      const r = await page.locator(".hero .ring").boundingBox();
      const hero = await page.locator(".hero").boundingBox();
      assert.ok(v.x + v.width <= r.x + 0.5 && t.x + t.width <= r.x + 0.5, `superposición a ${width}px`);
      assert.ok(r.x + r.width <= hero.x + hero.width, "el círculo queda dentro de la tarjeta");
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 0);
      if (SHOTS && width === 375) await page.locator(".hero").screenshot({ path: SHOTS + `/hero-${prefs ? "cuidado" : "ideal"}.png` });
      await ctx.close();
    }
  }
  // sin ventana recomendable hoy: no hay puntaje
  const storm = {};
  for (let d = 0; d < 7; d++) storm[d] = () => ({ temp: 14, feels: 8, prob: 0, precip: 0, code: 3, wind: 35, gust: 62, dir: 250 });
  const s1 = await open({ forecast: buildForecast("2026-11-14", storm) });
  await s1.page.locator(".hero .verdict").waitFor();
  assert.equal(await s1.page.locator(".hero .ring").count(), 0);
  await s1.ctx.close();
  const s2 = await open({ at: new Date("2026-11-15T02:30:00Z") }); // 23:30, ya no quedan horas
  await s2.page.locator(".hero .verdict").waitFor();
  assert.equal(await s2.page.locator(".hero .ring").count(), 0);
  await s2.ctx.close();
});

test("¿Da para asado ahora?: observado y modelo separados, duraciones 2/3/4 h", async () => {
  const { page, ctx, errors } = await open();
  const sec = page.locator(".now-card");
  await sec.waitFor();
  assert.match(await sec.locator('[data-kind="obs"]').innerText(), /Observado · aeropuerto \(SAWG\)[\s\S]*12 °C · 15 km\/h OSO[\s\S]*Sin ráfagas informadas[\s\S]*10:00 \(hace 5 min\)/);
  assert.match(await sec.locator('[data-kind="model"]').innerText(), /Modelo · Open-Meteo \(estimación\)[\s\S]*no es una medición/);
  assert.match(await sec.locator(".now-best").innerText(), /12:00 – 15:00/);
  assert.match(await sec.locator("ul.why").innerText(), /mejor puntaje entre \d+ ventanas aceptables de 3 h/);
  await page.locator("#now-dur-2").click();
  assert.match(await sec.locator(".now-best .opp-time").innerText(), /12:00 – 14:00/);
  assert.ok(await sec.locator(".alt-row").count() >= 1, "con 2 h hay alternativas");
  await page.locator("#now-dur-4").click();
  assert.match(await sec.locator(".now-best .opp-time").innerText(), /12:00 – 16:00/);
  assert.match(await sec.innerText(), /Agradable, pero no para brasas/, "la mañana templada con ráfagas de 45 se advierte");
  assert.match(await sec.innerText(), /De 10:00 a 12:00 y de 18:00 a 21:00 se esperan/);
  assert.match(await sec.locator(".src-foot").innerText(), /Pronóstico: Open-Meteo, consultado sáb 14\/11, 10:05[\s\S]*METAR de aviationweather\.gov/);
  assert.match(await sec.locator('[data-testid="cmp"]').innerText(), /Las ráfagas no se pueden comparar/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("si la observación falla, el resto de la app sigue funcionando", async () => {
  const { page, ctx } = await open({ metar: "fail" });
  await page.locator(".hero .verdict").waitFor();
  await page.locator('.now-card [data-kind="obs"]', { hasText: "Sin observación disponible" }).waitFor();
  assert.match(await page.locator(".now-best").innerText(), /12:00/);
  assert.equal(await page.locator(".notice[role=alert]").count(), 0);
  await ctx.close();
});

test("ráfagas observadas fuertes vuelven roja la hora actual", async () => {
  const { page, ctx } = await open({ metar: "METAR SAWG 141300Z 25025G42KT CAVOK 12/04 Q1016" });
  await page.locator(".now-hour").waitFor();
  assert.match(await page.locator(".now-hour").innerText(), /Esta hora \(10:00\):\s*No conviene\s*según la observación/);
  assert.match(await page.locator(".now-card").innerText(), /Observado en el aeropuerto a las 10:00: ráfagas de 78 km\/h/);
  await ctx.close();
});

test("«¿Por qué no me recomendaste este horario?» explica horas y valores", async () => {
  const { page, ctx } = await open();
  await page.locator(".hero .verdict").waitFor();
  await tab(page, "pronostico");
  await page.locator(".chart-wrap svg").waitFor();
  await page.locator(".chart-wrap").scrollIntoViewIfNeeded();
  const box = await page.locator(".chart-wrap").boundingBox();
  // hora 19 (fuera del tramo calmo, ráfagas de 45, todavía de día)
  await page.mouse.click(box.x + box.width * ((30 + 19.5 * 12.5) / 360), box.y + box.height / 2);
  assert.match(await page.locator(".hour-detail .row1").innerText(), /19:00/);
  await page.getByRole("button", { name: "¿Por qué no me recomendaste este horario?" }).click();
  const ans = await page.locator(".why-ans").evaluate((e) => e.textContent);
  assert.match(ans, /Ventana 19:00–22:00 \(3 h\)/);
  assert.match(ans, /Aunque la temperatura prevista era agradable[\s\S]*las ráfagas previstas superaban el límite configurado de 40 km\/h/);
  assert.match(ans, /19:00 — Ráfagas de hasta 45 km\/h/);
  assert.match(ans, /21:00 — /);
  // una hora recomendada no ofrece el botón
  await page.locator(".chart-wrap").scrollIntoViewIfNeeded();
  const box2 = await page.locator(".chart-wrap").boundingBox();
  await page.mouse.click(box2.x + box2.width * ((30 + 12.5 * 12.5) / 360), box2.y + box2.height / 2);
  assert.equal(await page.getByRole("button", { name: "¿Por qué no me recomendaste este horario?" }).count(), 0);
  assert.match(await page.locator(".hour-detail").innerText(), /Este horario está recomendado/);
  await ctx.close();
});

test("cambio de pronóstico entre dos consultas: muestra la nueva oportunidad", async () => {
  const windy = buildForecast("2026-11-14", { 2: () => ({ temp: 17, feels: 15, prob: 0, precip: 0, code: 1, wind: 28, gust: 55, dir: 250 }) });
  const { page, ctx, state } = await open({ forecast: windy });
  await page.locator(".hero .verdict").waitFor();
  assert.equal(await page.locator(".changes").count(), 0, "la primera consulta no tiene con qué comparar");
  state.forecast = buildForecast("2026-11-14", { 2: () => ({ temp: 17, feels: 15, prob: 0, precip: 0, code: 1, wind: 8, gust: 15, dir: 250 }) });
  await page.clock.setFixedTime(new Date(FIXED.getTime() + 20 * 60000));
  await page.getByRole("button", { name: "Actualizar pronóstico" }).click();
  await page.locator(".changes").waitFor();
  const txt = await page.locator(".changes").evaluate((e) => e.textContent);
  assert.match(txt, /Cambios desde la consulta anterior \(sáb 14\/11, 10:05\)/);
  assert.match(txt, /Nueva oportunidad: Lunes 16\/11, 09:00–12:00 · ideal para asado \(antes: no conviene\)/);
  assert.match(txt, /No envía alertas automáticas/);
  await ctx.close();
});

test("textos: «límite configurado», fuentes rotuladas y faltan datos ≠ mal tiempo", async () => {
  const { page, ctx } = await open();
  await page.locator(".hero .verdict").waitFor();
  const body = await page.locator("body").evaluate((e) => e.textContent);
  assert.doesNotMatch(body, /límite seguro/i);
  assert.match(body, /Límite configurado: 40/);
  assert.match(await page.locator(".now-hour").innerText(), /según el pronóstico/);
  await tab(page, "pronostico");
  assert.match(await page.locator(".hour-detail").innerText(), /Valores del pronóstico de Open-Meteo, no mediciones/);
  await ctx.close();
  const f = buildForecast("2026-11-14");
  delete f.hourly.wind_gusts_10m;
  const r = await open({ forecast: f });
  await r.page.locator(".hero .verdict").waitFor();
  await tab(r.page, "semana");
  await r.page.locator(".opps").waitFor();
  const t = await r.page.locator(".opps").innerText();
  assert.match(t, /Faltan datos del pronóstico \(por ejemplo, las ráfagas\)/);
  assert.doesNotMatch(t, /No encontramos condiciones recomendables/);
  await r.ctx.close();
});

test("planificar: calendario, accesos rápidos, cruce de año y «todavía es pronto»", async () => {
  const { page, ctx, errors } = await open();
  await page.locator(".hero .verdict").waitFor();
  await tab(page, "planificar");
  assert.match(await page.locator(".cal-head h3").innerText(), /Noviembre 2026/);
  assert.equal(await page.locator(".cal-cell.today").getAttribute("data-date"), "2026-11-14");
  // Año Nuevo cruza el año: el calendario salta a diciembre y el período abarca 2 años
  await page.locator("#q-anionuevo").click();
  assert.match(await page.locator(".cal-head h3").innerText(), /Diciembre 2026/);
  assert.match(await page.locator('[data-testid="range"]').innerText(), /31 dic 2026 – 1 ene 2027/);
  assert.equal(await page.locator('.pd[data-kind="pronto"]').count(), 2);
  assert.match(await page.locator(".pd-list").innerText(), /Todavía es pronto para recomendar un horario/);
  assert.equal(await page.locator(".pd-list .ring").count(), 0, "sin puntajes para fechas lejanas");
  assert.doesNotMatch(await page.locator(".pd-list").innerText(), /\d\d:00 – \d\d:00/, "sin horarios inventados");
  assert.match(await page.locator('[data-testid="trend-card"]').innerText(), /Tendencia orientativa/);
  await page.locator(".cal-nav").nth(1).click();
  assert.match(await page.locator(".cal-head h3").innerText(), /Enero 2027/);
  // Navidad
  await page.locator("#q-navidad").click();
  assert.match(await page.locator('[data-testid="range"]').innerText(), /24 – 25 dic/);
  // Selección manual dentro del pronóstico horario: 15 → 17/11
  await page.locator(".cal-nav").first().click();
  await page.locator('[data-date="2026-11-17"]').click();
  await page.locator('[data-date="2026-11-15"]').click();
  assert.match(await page.locator('[data-testid="range"]').innerText(), /15 – 17 nov/);
  assert.equal(await page.locator('.pd[data-kind="horario"], .pd[data-kind="horario-sin"]').count(), 3);
  assert.match(await page.locator(".pd-list").innerText(), /Mañana, domingo 15\/11[\s\S]*No conviene/);
  await page.locator("#plan-dur-4").click();
  const t = await page.locator(".pd-list").innerText();
  assert.match(t, /Lunes 16\/11/);
  assert.match(await page.locator(".plan-res").innerText(), /Mejor ventana del período: .*\(\d+ puntos\)/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("planificar: tendencia diaria (días 8–16) y error de la API de tendencia", async () => {
  const { page, ctx, state } = await open();
  await page.locator(".hero .verdict").waitFor();
  await tab(page, "planificar");
  await page.locator('[data-date="2026-11-24"]').click();
  await page.locator('[data-date="2026-11-24"]').click();
  await page.locator('.pd[data-kind="tendencia"]').waitFor();
  const txt = await page.locator('.pd[data-kind="tendencia"]').innerText();
  assert.match(txt, /Todavía es pronto para recomendar un horario/);
  assert.match(txt, /Tendencia no disponible|Tendencia diaria, no horaria/);
  await ctx.close();
  // con tendencia real-formato servida
  const r = await open({ trend: { daily: { time: ["2026-11-24"], temperature_2m_max: [18], temperature_2m_min: [7], wind_speed_10m_max: [22], wind_gusts_10m_max: [48], precipitation_probability_max: [10], precipitation_sum: [0] } } });
  await r.page.locator(".hero .verdict").waitFor();
  await tab(r.page, "planificar");
  await r.page.locator('[data-date="2026-11-24"]').click();
  await r.page.locator('[data-date="2026-11-24"]').click();
  await r.page.locator('.pd[data-kind="tendencia"] .tag').waitFor();
  assert.match(await r.page.locator('.pd[data-kind="tendencia"]').innerText(), /Ráfagas fuertes en algún momento del día \(hasta 48 km\/h\)/);
  assert.equal(await r.page.locator('.pd[data-kind="tendencia"] .ring').count(), 0);
  await r.ctx.close();
});

test("planificar: guardar, ver, detectar cambios y borrar eventos", async () => {
  const { page, ctx } = await open();
  await page.locator(".hero .verdict").waitFor();
  await tab(page, "planificar");
  await page.locator("#q-navidad").click();
  await page.locator("#save-period").click();
  await page.locator("#event-name").fill("Asado de Navidad con la familia");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  const ev = page.locator('[data-event="Asado de Navidad con la familia"]');
  await ev.waitFor();
  assert.match(await ev.innerText(), /24 – 25 dic[\s\S]*Todavía es pronto para recomendar un horario/);
  // evento cercano guardado con una firma vieja: se detecta el cambio
  await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem("dpa:events:v1"));
    l.push({ id: "x1", name: "Domingo", start: "2026-11-14", end: "2026-11-14", dur: 3, sig: "pronto", savedAt: 1 });
    localStorage.setItem("dpa:events:v1", JSON.stringify(l));
  });
  await page.reload();
  await page.locator(".planner").waitFor(); // se recuerda la pestaña (#planificar)
  assert.equal(await page.locator("#tab-planificar").getAttribute("aria-current"), "page");
  const e2 = page.locator('[data-event="Domingo"]');
  await e2.waitFor();
  assert.match(await e2.innerText(), /Ya hay pronóstico horario para este evento/);
  await e2.getByRole("button", { name: "Marcar como visto" }).click();
  assert.equal(await e2.locator('[data-testid="ev-change"]').count(), 0);
  assert.match(await page.locator(".events").innerText(), /Las alertas automáticas todavía no funcionan/);
  await ev.getByRole("button", { name: "Borrar" }).click();
  await ev.getByRole("button", { name: "Confirmar borrado" }).click();
  assert.equal(await page.locator('[data-event="Asado de Navidad con la familia"]').count(), 0);
  await ctx.close();
});

test("diseño: tema oscuro por defecto, foto, brasas y movimiento reducido", async () => {
  const { page, ctx } = await open();
  await page.locator(".hero .verdict").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute("data-theme")), "dark");
  const bg = await page.locator(".mast-photo").evaluate((e) => getComputedStyle(e).backgroundImage);
  assert.match(bg, /data:image\/jpeg;base64/);
  assert.equal(await page.locator(".embers i").count(), 12);
  assert.notEqual(await page.locator(".embers i").first().evaluate((e) => getComputedStyle(e).animationName), "none");
  await ctx.close();
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const r = await open({ ctx: c2 });
  await r.page.locator(".hero .verdict").waitFor();
  assert.equal(await r.page.locator(".embers").evaluate((e) => getComputedStyle(e).display), "none");
  await c2.close();
});

test("planificar: estadística histórica a pedido, rotulada y ligada al período", async () => {
  const archive = { daily: { time: ["2024-12-24", "2024-12-25", "2025-12-24", "2025-12-25"], temperature_2m_max: [18, 20, 14, 19], wind_gusts_10m_max: [35, 60, 105.5, 101.5], precipitation_sum: [0, 2, 0.3, 0] } };
  const { page, ctx } = await open({ archive });
  await page.locator(".hero .verdict").waitFor();
  await tab(page, "planificar");
  await page.locator("#q-navidad").click();
  await page.getByRole("button", { name: "Ver cómo fue en años anteriores" }).click();
  const c = page.locator('[data-testid="clim"]');
  await c.waitFor();
  const t = await c.innerText();
  assert.match(t, /En 2024–2025, para estas fechas: ráfaga máxima diaria promedio de 76 km\/h; en el 75 % de los días superó los 40 km\/h/);
  assert.match(t, /no es una medición de la estación/);
  assert.match(t, /Es estadística de años anteriores, no un pronóstico\./);
  await page.locator("#q-anionuevo").click();
  assert.equal(await page.locator('[data-testid="clim"]').count(), 0, "al cambiar el período no queda la estadística vieja");
  await ctx.close();
});
