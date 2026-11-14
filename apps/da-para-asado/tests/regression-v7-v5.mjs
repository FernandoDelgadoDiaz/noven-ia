// Regresión antes/después: misma respuesta REAL (14/11 14:40), interfaz v7 contra v5.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const V = process.env.VENDOR_DIR;
const D = new URL("./data/", import.meta.url);
const LIVE = JSON.parse(readFileSync(new URL("live-2026-11-14T1440.json", D)));
const fc = structuredClone(LIVE.forecast); fc.hourly.time = [];
for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) fc.hourly.time.push(fc.daily.time[d] + "T" + String(h).padStart(2, "0") + ":00");
const browser = await chromium.launch();
async function load(file, at) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(at);
  const PAGE = readFileSync(file, "utf8");
  await p.route("**/*", (r) => { const u = r.request().url();
    if (u.startsWith("https://app.test/")) return r.fulfill({ contentType: "text/html", body: "<!doctype html><html><head><meta charset=utf-8></head><body>" + PAGE + "</body></html>" });
    if (u.includes("react-dom.production")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(V + "/react-dom-18.3.1/package/umd/react-dom.production.min.js") });
    if (u.includes("react.production")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(V + "/react-18.3.1/package/umd/react.production.min.js") });
    if (u.includes("htm.umd")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(V + "/htm-3.1.1/package/dist/htm.umd.js") });
    if (u.includes("aviationweather")) return r.fulfill({ contentType: "text/plain", body: LIVE.metar_raw, headers: { "access-control-allow-origin": "*" } });
    if (u.includes("api.open-meteo.com") && u.includes("hourly=")) return r.fulfill({ contentType: "application/json", body: JSON.stringify(fc), headers: { "access-control-allow-origin": "*" } });
    return r.abort(); });
  await p.goto("https://app.test/"); await p.waitForTimeout(1500);
  return { p, ctx };
}
const T = (p, s) => p.locator(s).first().innerText().then((t) => t.replace(/\s+/g, " ").trim()).catch(() => null);
const out = {};
for (const [name, at] of [["14:40", new Date("2026-11-14T17:40:27Z")], ["10:05", new Date("2026-11-14T13:05:00Z")]]) {
  // v7
  let { p, ctx } = await load(process.env.V7, at);
  const v7 = { hoy: (await T(p, ".hero .best-time .big"))?.replace(/\s/g, "") + "|" + await T(p, ".hero .ring .n") };
  const now7 = {}; for (const d of [2, 3, 4]) { await p.locator("#now-dur-" + d).click(); now7[d] = (await T(p, ".now-best .opp-time"))?.replace(/\s/g, "").replace("(medianoche)", "") + "|" + await T(p, ".now-best .ring .n"); }
  await p.locator("#tab-semana").click();
  const opps = await p.locator(".opps .opp").evaluateAll((l) => l.map((e) => e.innerText));
  const perDay7 = {}; opps.forEach((t) => { const m = t.match(/(\d+\/\d+)[\s\S]*?(\d\d:00 – \d\d:00)[\s\S]*?\n(\d+)\n+de 100/i); if (m && !perDay7[m[1]]) perDay7[m[1]] = m[2].replace(/\s/g, "") + "|" + m[3]; });
  await ctx.close();
  // v5
  ({ p, ctx } = await load(process.env.V5, at));
  const v5 = { hoy: (await T(p, '[data-testid="best-today"] .bt-time'))?.replace(/\s/g, "") + "|" + await T(p, '[data-testid="best-today"] .ring .n') };
  await p.locator("#durations > summary").click();
  const now5 = {}; for (const d of [2, 3, 4]) { await p.locator("#now-dur-" + d).click(); const t = await T(p, '[data-testid="dp-list"] .alt-row'); const m = t && t.match(/(\d\d:00 – \d\d:00)[^\d]*?(\d+)$/); now5[d] = m ? m[1].replace(/\s/g, "") + "|" + m[2] : t; }
  await p.locator("#tab-dias").click();
  const rows = await p.locator(".dl-item").evaluateAll((l) => l.map((e) => ({ d: e.querySelector(".dl-day span").textContent, t: e.querySelector(".dl-time").childNodes[0].textContent, s: e.querySelector(".ring .n") ? e.querySelector(".ring .n").textContent : null })));
  const perDay5 = {}; rows.forEach((r) => { if (r.s) perDay5[r.d] = r.t.replace("–", "–") + "|" + r.s; });
  await ctx.close();
  const norm = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort().map(([k, v]) => [k, String(v).replace(/–/g, "-")])));
  console.log(`== Hora ${name}`);
  console.log("Mejor de hoy     v7:", v7.hoy, " v5:", v5.hoy, v7.hoy.replace(/–/g, "-") === v5.hoy.replace(/–/g, "-") ? "IGUAL" : "DISTINTO");
  for (const d of [2, 3, 4]) console.log(`Ahora ${d} h       v7:`, now7[d], " v5:", now5[d], now7[d].replace(/–/g, "-") === String(now5[d]).replace(/–/g, "-") ? "IGUAL" : "DISTINTO");
  console.log("Por día v7       ", norm(perDay7));
  console.log("Por día v5       ", norm(perDay5), norm(perDay7) === norm(perDay5) ? "IGUAL" : "DISTINTO");
}
await browser.close();
