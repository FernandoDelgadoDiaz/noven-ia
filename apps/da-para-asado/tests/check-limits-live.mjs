// Verificación independiente: cada ventana recomendada se contrasta con los arreglos crudos de la
// respuesta real de Open-Meteo (no con la clasificación del motor).
import { readFileSync } from "node:fs";
import { loadEngine } from "./fixture.mjs";
const A = loadEngine();
const LIVE = JSON.parse(readFileSync(new URL("./data/live-2026-11-14T1440.json", import.meta.url)));
const fc = structuredClone(LIVE.forecast);
fc.hourly.time = [];
for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) fc.hourly.time.push(fc.daily.time[d] + "T" + String(h).padStart(2, "0") + ":00");
const raw = {}; fc.hourly.time.forEach((t, i) => { raw[t] = Object.fromEntries(Object.keys(fc.hourly).map((k) => [k, fc.hourly[k][i]])); });
const model = A.normalize(fc);
const obs = A.parseMetar(LIVE.metar_raw, new Date("2026-11-14T17:40:27Z"))[0];
const NOW = "2026-11-14T14:40";
let checked = 0, bad = [];
function check(w, p, tag) {
  w.hours.forEach((h) => {
    const r = raw[h.time]; checked++;
    const fail = (m) => bad.push(`${tag} ${h.time}: ${m}`);
    if (r.wind_gusts_10m > 40) fail("ráfaga " + r.wind_gusts_10m + " > 40");
    if (r.wind_speed_10m > 30) fail("viento " + r.wind_speed_10m + " > 30");
    if (r.precipitation >= 0.5) fail("lluvia " + r.precipitation);
    if (r.precipitation_probability >= 50) fail("prob " + r.precipitation_probability);
    if (r.apparent_temperature < p.minFeels - 5) fail("sensación " + r.apparent_temperature);
    if (w.level === "ideal") {
      if (r.wind_gusts_10m > p.maxGust) fail("ideal con ráfaga " + r.wind_gusts_10m + " > " + p.maxGust);
      if (r.wind_speed_10m > p.maxWind) fail("ideal con viento " + r.wind_speed_10m + " > " + p.maxWind);
      if (r.apparent_temperature < p.minFeels) fail("ideal con sensación " + r.apparent_temperature);
      if (r.precipitation > 0 || r.precipitation_probability >= 20) fail("ideal con lluvia");
    }
  });
}
for (const prefs of [{}, { maxWind: 10, maxGust: 20, minFeels: 16 }, { maxWind: 25, maxGust: 35, minFeels: 5 }, { duration: 5, slot: "noche" }]) {
  const p = A.sanitizePrefs(prefs);
  const a = A.analyze(model, p, NOW, { obs });
  a.recs.forEach((w) => check(w, p, "semana " + JSON.stringify(prefs)));
  const n = A.analyzeNow(model, p, NOW, { obs });
  [2, 3, 4].forEach((d) => { const r = n.byDur[d]; [r.best, ...r.alts].filter(Boolean).forEach((w) => check(w, p, "ahora " + d + "h " + JSON.stringify(prefs))); });
  console.log(JSON.stringify(prefs).padEnd(46), "recomendaciones semana:", a.recs.length, "· ahora 2/3/4 h:", [2, 3, 4].map((d) => (n.byDur[d].best ? 1 : 0) + n.byDur[d].alts.length).join("/"));
}
console.log("horas verificadas:", checked, "· violaciones:", bad.length);
bad.slice(0, 10).forEach((b) => console.log("  ", b));
process.exit(bad.length ? 1 : 0);
