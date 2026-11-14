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

async function open({ api = "ok", claude = null, scheme = "light", ctx: reuse, forecast = FORECAST, at = FIXED, metar = METAR, trend = null, archive = null, feriados = null } = {}) {
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
    if (u.startsWith("https://api.argentinadatos.com/v1/feriados/")) {
      state.feriadoCalls = (state.feriadoCalls || 0) + 1;
      const y = u.split("/").pop();
      return feriados && feriados[y] ? route.fulfill({ contentType: "application/json", body: JSON.stringify(feriados[y]), headers: { "access-control-allow-origin": "*" } }) : route.abort();
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











test("planificar: calendario, accesos rápidos, cruce de año y «todavía es pronto»", async () => {
  const { page, ctx, errors } = await open();
  await page.locator(".hero .verdict").waitFor();
  await tab(page, "planificar");
  assert.match(await page.locator(".cal-head h3").innerText(), /Noviembre 2026/);
  assert.equal(await page.locator(".cal-cell.today").getAttribute("data-date"), "2026-11-14");
  // Período que cruza el año, elegido en el calendario: 31/12/2026 → 1/1/2027
  await page.locator(".cal-nav").nth(1).click();
  assert.match(await page.locator(".cal-head h3").innerText(), /Diciembre 2026/);
  await page.locator('[data-date="2026-12-31"]').click();
  await page.locator(".cal-nav").nth(1).click();
  await page.locator('[data-date="2027-01-01"]').click();
  assert.match(await page.locator('[data-testid="range"]').innerText(), /31 dic 2026 – 1 ene 2027/);
  assert.equal(await page.locator('.pd[data-kind="pronto"]').count(), 2);
  assert.match(await page.locator(".pd-list").innerText(), /Todavía es pronto para recomendar un horario/);
  assert.equal(await page.locator(".pd-list .ring").count(), 0, "sin puntajes para fechas lejanas");
  assert.doesNotMatch(await page.locator(".pd-list").innerText(), /\d\d:00 – \d\d:00/, "sin horarios inventados");
  assert.match(await page.locator('[data-testid="trend-card"]').innerText(), /Tendencia orientativa/);
  assert.match(await page.locator(".cal-head h3").innerText(), /Enero 2027/);
  // Feriado de la lista: Navidad (viernes 25) con su fin de semana
  await page.locator('[data-hol="2026-12-25"]').click();
  assert.match(await page.locator('[data-testid="range"]').innerText(), /25 – 27 dic/);
  assert.match(await page.locator(".cal-head h3").innerText(), /Diciembre 2026/);
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
  assert.deepEqual(errors.filter((e) => !/Failed to load resource/.test(e)), [], "solo el aviso de red de la consulta de feriados bloqueada");
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
  await page.locator('[data-hol="2026-12-25"]').click();
  await page.locator("#save-period").click();
  await page.locator("#event-name").fill("Asado de Navidad con la familia");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  const ev = page.locator('[data-event="Asado de Navidad con la familia"]');
  await ev.waitFor();
  assert.match(await ev.innerText(), /25 – 27 dic[\s\S]*Todavía es pronto para recomendar un horario/);
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
  // fondo carbón aun con el visor en claro, el teléfono en modo claro y un tema viejo guardado
  await page.evaluate(() => { document.documentElement.setAttribute("data-theme", "light"); localStorage.setItem("dpa:theme:v1", JSON.stringify("sistema")); });
  await page.reload();
  await page.locator(".hero .verdict").waitFor();
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(12, 8, 6)");
  assert.match(await page.locator(".hero").evaluate((e) => getComputedStyle(e).backgroundImage), /rgba\(40, 26, 18/);
  for (const t of ["dias", "planificar"]) {
    await tab(page, t);
    const light = await page.evaluate(() => [...document.querySelectorAll(".card, .dl-item, .hero, details, .notice, .tile, .cal-cell")].filter((e) => {
      const c = getComputedStyle(e).backgroundColor.match(/\d+(\.\d+)?/g).map(Number);
      return (c[3] === undefined || c[3] > 0.5) && (c[0] + c[1] + c[2]) / 3 > 140;
    }).length);
    assert.equal(light, 0, "sin fondos claros en " + t);
  }
  await tab(page, "hoy");
  assert.equal(await page.evaluate(() => localStorage.getItem("dpa:theme:v1")), null, "se descarta el tema viejo");
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
  await page.locator('[data-hol="2026-12-25"]').click(); // 25–27 dic
  await page.getByRole("button", { name: "Ver cómo fue en años anteriores" }).click();
  const c = page.locator('[data-testid="clim"]');
  await c.waitFor();
  const t = await c.innerText();
  assert.match(t, /En 2024–2025, para estas fechas: ráfaga máxima diaria promedio de 81 km\/h; en el 100 % de los días superó los 40 km\/h/);
  assert.match(t, /no es una medición de la estación/);
  assert.match(t, /Es estadística de años anteriores, no un pronóstico\./);
  await page.locator('[data-hol="2027-01-01"]').click();
  assert.equal(await page.locator('[data-testid="clim"]').count(), 0, "al cambiar el período no queda la estadística vieja");
  await ctx.close();
});

/* ===== v5: experiencia simplificada ===== */
const calmH = { temp: 17, feels: 15, prob: 0, precip: 0, code: 1, wind: 8, gust: 15, dir: 250 };
const T = (page, sel) => page.locator(sel).first().innerText().then((t) => t.replace(/\s+/g, " ").trim());

test("v5 Hoy: «ahora» no se confunde con el futuro (10:05 con ráfagas de 45, mejora a las 12)", async () => {
  const { page, ctx, errors } = await open();
  await page.locator(".now-answer .verdict").waitFor();
  assert.equal(await page.locator(".tab").count(), 3);
  assert.match(await T(page, ".now-answer .verdict"), /^Ahora no conviene$/);
  assert.match(await T(page, ".now-answer .lead"), /Las ráfagas son demasiado fuertes para cocinar con brasas/);
  assert.match(await T(page, ".now-answer .eyebrow"), /10:00/);
  assert.equal(await page.locator(".now-answer .tile.flag").count(), 1, "solo ráfagas en rojo");
  assert.match(await T(page, ".now-answer .srcline"), /Pronóstico para esta hora · Medido en el aeropuerto a las 10:00/);
  const bt = await T(page, '[data-testid="best-today"]');
  assert.match(bt, /La mejor oportunidad de hoy 12:00 – 15:00 Ideal/i);
  assert.match(await T(page, '[data-testid="best-today"] .ring .n'), /^100$/);
  assert.match(await T(page, '[data-testid="week-best"]'), /Mejor día de la semana Hoy · 12:00–15:00 Ideal · 100\/100/i);
  assert.match(await T(page, '[data-testid="risk"]'), /Agradable, pero no para brasas/, "el riesgo se ve sin expandir nada");
  // lo técnico queda plegado
  assert.equal(await page.locator("#detalles").evaluate((e) => e.open), false);
  assert.equal(await page.locator("#detalles .src-box").first().isVisible(), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("v5 Hoy: estado ideal y con precauciones en este momento", async () => {
  const a = await open({ at: new Date("2026-11-14T15:05:00Z") }); // 12:05
  await a.page.locator(".now-answer .verdict").waitFor();
  assert.match(await T(a.page, ".now-answer .verdict"), /^Ahora da para asado$/);
  assert.match(await T(a.page, ".now-answer .lead2"), /Alcanza para tu asado de 3 h \(bien hasta las 18:00\)/);
  assert.equal(await a.page.locator(".now-answer.ideal").count(), 1);
  await a.ctx.close();
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await c.addInitScript(() => localStorage.setItem("dpa:prefs:v1", JSON.stringify({ duration: 3, minFeels: 16, maxWind: 20, maxGust: 30, slot: "libre", exposure: "expuesta" })));
  const b = await open({ ctx: c, at: new Date("2026-11-14T15:05:00Z") });
  await b.page.locator(".now-answer .verdict").waitFor();
  assert.match(await T(b.page, ".now-answer .verdict"), /^Ahora se puede, con cuidado$/);
  assert.match(await T(b.page, ".now-answer .lead"), /Va a estar fresco: llevá abrigo/);
  await c.close();
});

test("v5 Hoy: sin ventanas por hoy ofrece la próxima de otro día", async () => {
  const { page, ctx } = await open({ at: new Date("2026-11-15T02:30:00Z") }); // 23:30
  await page.locator(".now-answer .verdict").waitFor();
  assert.match(await T(page, ".now-answer .verdict"), /^Ahora no conviene$/);
  const bt = await T(page, '[data-testid="best-today"]');
  assert.match(bt, /Hoy ya no quedan horarios recomendables/);
  assert.match(bt, /Próxima oportunidad Lunes, lunes 16\/11 · 09:00–12:00|Próxima oportunidad Lunes 16\/11 · 09:00–12:00/);
  assert.equal(await page.locator('[data-testid="best-today"] .ring').count(), 0, "sin puntaje para hoy");
  await page.locator(".next-row").click();
  assert.equal(await page.locator("#tab-dias").getAttribute("aria-current"), "page");
  assert.equal(await page.locator('.dl-item[data-date="2026-11-16"] .dl-row').getAttribute("aria-expanded"), "true");
  await ctx.close();
});

test("v5 Próximos días: lista compacta, estados, motivo y detalle expandible", async () => {
  const { page, ctx, errors } = await open();
  await page.locator(".now-answer .verdict").waitFor();
  await tab(page, "dias");
  assert.equal(await page.locator(".dl-item").count(), 7);
  const lv = await page.locator(".dl-item").evaluateAll((l) => l.map((e) => e.dataset.date.slice(5) + ":" + e.dataset.level).join(","));
  assert.equal(lv, "11-14:ideal,11-15:no,11-16:precaucion,11-17:no,11-18:precaucion,11-19:no,11-20:sindatos");
  assert.match(await T(page, '.dl-item[data-date="2026-11-15"]'), /Mañana 15\/11 No conviene Las ráfagas son demasiado fuertes para cocinar con brasas/);
  assert.equal(await page.locator('.dl-item[data-date="2026-11-15"] .ring').count(), 0, "un día rojo no tiene puntaje");
  assert.match(await T(page, '.dl-item[data-date="2026-11-14"]'), /12:00–15:00 MEJOR/);
  assert.equal(await page.locator(".day-detail").count(), 0, "nada expandido al inicio");
  await page.locator('.dl-item[data-date="2026-11-16"] .dl-row').click();
  const dd = page.locator('.dl-item[data-date="2026-11-16"] .day-detail');
  await dd.waitFor();
  assert.equal(await dd.locator(".chart-wrap svg").count(), 1, "gráfico detallado");
  assert.match(await T(page, '.dl-item[data-date="2026-11-16"] .hour-detail'), /Valores del pronóstico de Open-Meteo, no mediciones/);
  // explicación de un horario descartado
  await dd.locator(".chart-wrap").scrollIntoViewIfNeeded();
  const box = await dd.locator(".chart-wrap").boundingBox();
  await page.mouse.click(box.x + box.width * ((30 + 6.5 * 12.5) / 360), box.y + box.height / 2);
  await page.getByRole("button", { name: "¿Por qué no me recomendaste este horario?" }).click();
  assert.match(await dd.locator(".why-ans").evaluate((e) => e.textContent), /Ventana 06:00–09:00/);
  // un solo día abierto a la vez
  await page.locator('.dl-item[data-date="2026-11-14"] .dl-row').click();
  assert.equal(await page.locator(".day-detail").count(), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("v5 consistencia: Hoy, Próximos días y Planificar muestran la misma ventana y puntaje", async () => {
  const { page, ctx } = await open();
  await page.locator(".now-answer .verdict").waitFor();
  const hoy = await T(page, '[data-testid="best-today"] .bt-time') + "|" + await T(page, '[data-testid="best-today"] .ring .n');
  await tab(page, "dias");
  const dias = await T(page, '.dl-item[data-date="2026-11-14"] .dl-time') + "|" + await T(page, '.dl-item[data-date="2026-11-14"] .ring .n');
  await tab(page, "planificar");
  await page.locator('[data-date="2026-11-14"]').click();
  await page.locator('[data-date="2026-11-14"]').click();
  const plan = await T(page, '.pd[data-kind="horario"] .opp-time') + "|" + await T(page, '.pd[data-kind="horario"] .ring .n');
  const norm = (x) => x.replace(/\s/g, "").replace(/MEJOR/, "");
  assert.equal(norm(hoy), "12:00–15:00|100");
  assert.equal(norm(dias), norm(hoy));
  assert.equal(norm(plan), norm(hoy));
  await ctx.close();
});

test("v5 sin condiciones favorables: mensaje claro en Hoy y en Próximos días", async () => {
  const storm = {};
  for (let d = 0; d < 7; d++) storm[d] = () => ({ temp: 14, feels: 8, prob: 0, precip: 0, code: 3, wind: 35, gust: 62, dir: 250 });
  const { page, ctx } = await open({ forecast: buildForecast("2026-11-14", storm) });
  await page.locator(".now-answer .verdict").waitFor();
  assert.match(await T(page, ".now-answer .verdict"), /^Ahora no conviene$/);
  assert.match(await T(page, '[data-testid="best-today"]'), /Hoy ya no quedan horarios recomendables[\s\S]*No encontramos condiciones recomendables para hacer asado en los próximos 7 días/);
  assert.match(await T(page, '[data-testid="week-best"]'), /No encontramos condiciones recomendables/);
  await tab(page, "dias");
  assert.equal(await page.locator('.dl-item[data-level="no"]').count(), 7);
  assert.equal(await page.locator(".dl-item .ring").count(), 0);
  await ctx.close();
});

test("v5 ahora: 2, 3 y 4 h desde ahora, cruzando la medianoche", async () => {
  const f = buildForecast("2026-11-14", { 0: (h) => (h >= 22 ? calmH : { ...calmH, gust: 55 }), 1: (h) => (h < 2 ? calmH : { ...calmH, gust: 55 }) });
  const { page, ctx } = await open({ forecast: f, at: new Date("2026-11-14T17:05:00Z") }); // 14:05
  await page.locator(".now-answer .verdict").waitFor();
  await page.locator("#durations > summary").click();
  await page.locator("#now-dur-4").click();
  assert.match(await T(page, '[data-testid="dp-list"]'), /★ Hoy 22:00 – 02:00 del domingo/);
  await page.locator("#now-dur-2").click();
  assert.match(await T(page, '[data-testid="dp-list"]'), /★ Hoy 22:00 – 00:00 \(medianoche\)|★ Hoy 2[23]:00 – 0[01]:00/);
  await page.locator("#now-dur-3").click();
  assert.match(await T(page, '[data-testid="dp-list"]'), /★ Hoy 2[23]:00 – 0[12]:00 del domingo/);
  await ctx.close();
});

test("v5 detalles: fuentes, medición vs estimación, ráfagas observadas y cambios entre consultas", async () => {
  const windy = buildForecast("2026-11-14", { 2: () => ({ ...calmH, wind: 28, gust: 55 }) });
  const { page, ctx, state } = await open({ forecast: windy, metar: "METAR SAWG 141300Z 25025G42KT CAVOK 12/04 Q1016" });
  await page.locator(".now-answer .verdict").waitFor();
  assert.match(await T(page, ".now-answer .lead"), /Se midieron ráfagas demasiado fuertes para las brasas/);
  assert.match(await T(page, ".now-answer .srcline"), /^Según la medición del aeropuerto/);
  await page.locator("#detalles > summary").click();
  const d = await T(page, "#detalles");
  assert.match(d, /Medido · aeropuerto \(SAWG\)/);
  assert.match(d, /Estimación del modelo · Open-Meteo .* no es una medición/);
  assert.match(d, /Observado en el aeropuerto a las 10:00: ráfagas de 78 km\/h/);
  assert.match(d, /Los límites configurados no son una garantía de seguridad/);
  assert.match(d, /Cómo se calcula/);
  state.forecast = buildForecast("2026-11-14", { 2: () => calmH });
  await page.clock.setFixedTime(new Date(FIXED.getTime() + 20 * 60000));
  await page.getByRole("button", { name: "Actualizar pronóstico" }).click();
  await page.locator("#detalles .news-dot").waitFor();
  assert.match(await page.locator("#detalles .changes").evaluate((e) => e.textContent), /Nueva oportunidad: Lunes 16\/11, 09:00–12:00 · ideal para asado \(antes: no conviene\)/);
  await ctx.close();
});

test("v5 conserva preferencias, eventos y enlaces anteriores", async () => {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await c.addInitScript(() => {
    localStorage.setItem("dpa:prefs:v1", JSON.stringify({ duration: 5, minFeels: 10, maxWind: 20, maxGust: 30, slot: "libre", exposure: "protegida" }));
    localStorage.setItem("dpa:events:v1", JSON.stringify([{ id: "e1", name: "Cumple de Juan", start: "2026-12-24", end: "2026-12-25", dur: 3, sig: "pronto", savedAt: 1 }]));
  });
  const { page } = await open({ ctx: c });
  await page.locator(".now-answer .verdict").waitFor();
  assert.match(await T(page, '[data-testid="best-today"] .bt-time'), /12:00 – 17:00/, "duración guardada de 5 h");
  await tab(page, "planificar");
  assert.match(await T(page, '[data-event="Cumple de Juan"]'), /24 – 25 dic/);
  await page.getByRole("button", { name: "Preferencias" }).click();
  assert.equal(await page.locator("#exp-protegida").getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Cerrar" }).click();
  await page.goto("https://app.test/#semana");
  await page.locator(".dl").waitFor();
  assert.equal(await page.locator("#tab-dias").getAttribute("aria-current"), "page", "#semana abre Próximos días");
  await c.close();
});

test("v5 fechas: Hoy según Río Gallegos aunque el teléfono esté en otro huso", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Tokyo" });
  const { page } = await open({ ctx, at: new Date("2026-11-15T02:30:00Z") });
  await page.locator(".now-answer .verdict").waitFor();
  assert.match(await T(page, ".now-answer .eyebrow"), /23:00/);
  await tab(page, "dias");
  assert.match(await T(page, ".dl-item .dl-day"), /^Hoy 14\/11$/);
  assert.match(await T(page, ".dl-item:nth-child(2) .dl-day"), /^Mañana 15\/11$/);
  await ctx.close();
});

test("v5 iPhone: respuesta principal visible sin desplazarse y sin desbordes", async () => {
  for (const w of [320, 375, 390, 430]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 320 ? 568 : 812 }, isMobile: true, hasTouch: true });
    const { page } = await open({ ctx });
    await page.locator(".now-answer .verdict").waitFor();
    const v = await page.locator(".now-answer .verdict").boundingBox();
    const tabbar = await page.locator(".tabbar").boundingBox();
    assert.ok(v.y + v.height <= tabbar.y, `veredicto visible sin scroll a ${w}px`);
    for (const t of ["hoy", "dias", "planificar"]) {
      await tab(page, t);
      if (t === "dias") await page.locator(".dl-row").first().click();
      const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(o <= 0, `overflow ${o}px en ${t} a ${w}px`);
    }
    const small = await page.evaluate(() => [...document.querySelectorAll(".tab, .dl-row, .chip, .cal-cell:not(.empty), .icon-btn")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height < 40; }).length);
    assert.equal(small, 0, "áreas táctiles de al menos 40 px de alto");
    await ctx.close();
  }
});

test("v5.1 próximos feriados: ventana de 6 meses, desaparecen al pasar y se actualizan", async () => {
  // a) 14/11/2026, sin conexión a la API: usa la lista incluida
  const a = await open();
  await a.page.locator(".now-answer .verdict").waitFor();
  await tab(a.page, "planificar");
  const rows = a.page.locator('[data-testid="holidays"] .hol-row');
  await rows.first().waitFor();
  assert.match(await T(a.page, '[data-testid="holidays"] .hol-row'), /21 – 23 nov Día de la Soberanía Nacional Finde largo · 3 días/);
  assert.equal(await rows.count(), 4, "se muestran 4 y el resto a pedido");
  await a.page.getByRole("button", { name: /Ver los \d+ feriados/ }).click();
  const all = await a.page.locator('[data-testid="holidays"] .hol-row').evaluateAll((l) => l.map((e) => e.dataset.hol));
  assert.equal(all[0], "2026-11-21");
  assert.ok(all.includes("2027-01-01"), "cruza el año");
  assert.ok(all.every((d) => d <= "2027-05-14"), "nada más allá de 6 meses");
  assert.match(await T(a.page, '[data-testid="holidays"]'), /lista incluida en la app/);
  await a.ctx.close();
  // b) 24/11/2026: la Soberanía ya pasó y desaparece; aparece lo que entra en la ventana
  const b = await open({ at: new Date("2026-11-24T13:00:00Z") });
  await b.page.locator(".now-answer .verdict").waitFor();
  await tab(b.page, "planificar");
  await b.page.locator('[data-testid="holidays"] .hol-row').first().waitFor();
  assert.equal(await b.page.locator('[data-hol="2026-11-21"]').count(), 0);
  assert.equal(await b.page.locator('[data-testid="holidays"] .hol-row').first().getAttribute("data-hol"), "2026-12-05");
  await b.ctx.close();
  // c) Datos SINTÉTICOS de la API (formato real): 2027 con un puente nuevo; reemplaza la lista incluida
  const feriados = {
    2026: [{ fecha: "2026-11-23", tipo: "trasladable", nombre: "Día de la Soberanía Nacional (20/11)" }, { fecha: "2026-12-25", tipo: "inamovible", nombre: "Navidad" }],
    2027: [{ fecha: "2027-01-01", tipo: "inamovible", nombre: "Año nuevo" }, { fecha: "2027-03-22", tipo: "puente", nombre: "Puente turístico no laborable" }, { fecha: "2027-03-24", tipo: "inamovible", nombre: "Día de la Memoria" }]
  };
  const c = await open({ feriados });
  await c.page.locator(".now-answer .verdict").waitFor();
  await tab(c.page, "planificar");
  await c.page.locator('[data-hol="2027-03-20"]').waitFor(); // sáb 20 + dom 21 + puente lun 22
  assert.match(await T(c.page, '[data-hol="2027-03-20"]'), /20 – 22 mar Puente turístico no laborable Finde largo · 3 días/);
  assert.match(await T(c.page, '[data-testid="holidays"]'), /\(actualizados\)/);
  assert.equal(c.state.feriadoCalls, 2, "consulta el año actual y el de dentro de 6 meses");
  // segunda apertura: usa lo guardado (no vuelve a consultar)
  await c.page.reload();
  await c.page.locator(".planner").waitFor();
  await c.page.locator('[data-hol="2027-03-20"]').waitFor();
  assert.equal(c.state.feriadoCalls, 2);
  await c.ctx.close();
});
