import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEngine, buildForecast } from "./fixture.mjs";

const A = loadEngine();
const P = A.sanitizePrefs({});
const here = fileURLToPath(new URL(".", import.meta.url));
const REAL = JSON.parse(readFileSync(here + "data/open-meteo-2026-11-14.json", "utf8"));
const calm = { temp: 17, feels: 15, prob: 0, precip: 0, code: 1, wind: 8, gust: 15, dir: 250 };

// Modelo de un solo día (14/11) con los datos reales capturados. La corrida del 14/11 no trae
// is_day; se usa el de la corrida anterior (depende solo de la posición del sol, no del modelo).
function realModel(run) {
  const H = run.hourly;
  const time = [...Array(24)].map((_, h) => "2026-11-14T" + String(h).padStart(2, "0") + ":00");
  return A.normalize({
    hourly: { time, ...H, is_day: H.is_day || REAL.corrida_13nov_2330.hourly.is_day },
    daily: { time: ["2026-11-14"], sunrise: ["2026-11-14T05:36"], sunset: ["2026-11-14T21:07"], weather_code: [3] },
  });
}

test("caso real 14/11: el mediodía se descarta por ráfagas, no por temperatura", () => {
  const a = A.analyze(realModel(REAL.corrida_14nov_1415), P, "2026-11-14T08:00");
  const d = a.days[0];
  const at = (hr) => d.hours.find((h) => h.hour === hr);
  for (const hr of [11, 12, 14, 15]) {
    assert.equal(at(hr).cls.level, "no", hr + " h");
    assert.ok(at(hr).cls.reasons.some((r) => r.key === "gust" && r.sev === "no"));
    assert.ok(at(hr).gust > 40);
  }
  assert.equal(at(13).cls.level, "precaucion");
  assert.ok(at(13).feels >= 20 && at(14).temp >= 24, "hacía calor");
  assert.ok(d.windows.filter((w) => w.startHour >= 11 && w.startHour <= 12).every((w) => w.level === "no"));
  const ex = A.explainWindow(a, "2026-11-14", 11, 3);
  assert.equal(ex.status, "descartada");
  assert.match(ex.text, /^Aunque la temperatura prevista era agradable \(17–24 °C, sensación 13–21 °C\) y no se esperaba lluvia, las ráfagas previstas superaban el límite configurado de 40 km\/h\.$/);
  assert.equal(ex.lines.length, 2, "11 y 12 en rojo; 13 solo precaución");
  assert.match(ex.lines[0].texts[0], /Ráfagas de hasta 44 km\/h/);
});

test("caso real 14/11: 20–23 tenía 59 y 19–22 (de día) 58; ahora se prefiere la de día", () => {
  const a = A.analyze(realModel(REAL.corrida_14nov_1415), P, "2026-11-14T08:00");
  const d = a.days[0];
  const w2023 = d.windows.find((w) => w.startHour === 20);
  const w1922 = d.windows.find((w) => w.startHour === 19);
  assert.equal(w2023.score, 59);
  assert.equal(w1922.score, 58);
  assert.equal(w1922.stats.dayFrac, 1);
  assert.equal(d.top.startHour + "-" + d.top.endHour, "19-22");
  assert.equal(d.top.level, "precaucion", "la preferencia diurna no cambia la categoría");
  // corrida del 13/11 23:30: no hay ventana diurna aceptable cerca, se mantiene la nocturna
  const b = A.analyze(realModel(REAL.corrida_13nov_2330), P, "2026-11-14T08:00");
  assert.equal(b.days[0].top.startHour + "-" + b.days[0].top.endHour, "21-24");
});

test("METAR real de SAWG: unidades, hora local y ráfagas", () => {
  const ref = new Date("2026-11-14T17:24:00Z");
  const list = A.parseMetar(REAL.metar_sawg.raw.join("\n"), ref);
  assert.equal(list.length, 8);
  assert.equal(list[0].local, "2026-11-14T14:00");
  const o11 = list.find((o) => o.local === "2026-11-14T11:00");
  assert.equal(o11.wind, 33.3); // 18 kt
  assert.equal(o11.gust, null);
  assert.equal(o11.temp, 17);
  assert.equal(o11.dir, 320);
  assert.equal(o11.sky, "despejado");
  const g = list.find((o) => o.local === "2026-11-13T17:00");
  assert.equal(g.wind, 51.9); // 28 kt
  assert.equal(g.gust, 75.9); // 41 kt
  assert.deepEqual(A.parseMetar("texto sin metar", ref).length, 0);
});

test("la observación solo empeora la hora actual y la siguiente", () => {
  const model = A.normalize(buildForecast("2026-11-14"));
  const now = "2026-11-14T12:40";
  const gusty = A.parseMetar("METAR SAWG 141530Z 25025G40KT CAVOK 17/04 Q1016", new Date("2026-11-14T15:45:00Z"))[0];
  assert.equal(gusty.local, "2026-11-14T12:30");
  const a = A.analyze(model, P, now, { obs: gusty });
  const at = (hr) => a.days[0].hours.find((h) => h.hour === hr);
  assert.equal(at(12).cls.level, "no");
  assert.equal(at(13).cls.level, "no");
  assert.ok(at(13).cls.reasons.some((r) => r.key === "obsGust"));
  assert.equal(at(14).cls.level, "ideal", "más allá de la hora siguiente decide el pronóstico");
  assert.match(A.reasonText(at(13).cls.reasons.find((r) => r.key === "obsGust"), a.prefs), /Observado en el aeropuerto a las 12:30: ráfagas de 74 km\/h/);
  // una observación calma no mejora una hora roja
  const calmObs = A.parseMetar("METAR SAWG 141900Z 00000KT CAVOK 15/04 Q1016", new Date("2026-11-14T19:10:00Z"))[0];
  const b = A.analyze(model, P, "2026-11-14T16:05", { obs: calmObs });
  assert.equal(b.days[0].hours.find((h) => h.hour === 18).cls.level, "no");
  // una observación vieja (más de 90 min) se ignora
  const old = A.analyze(model, P, "2026-11-14T15:00", { obs: gusty });
  assert.equal(old.days[0].hours.find((h) => h.hour === 15).cls.level, "ideal");
});

test("ahora: ventanas de 2, 3 y 4 h, incluso las que cruzan la medianoche", () => {
  // día 0: viento fuerte hasta las 22; calmo de 22 a 02; después rojo otra vez
  const f = buildForecast("2026-11-14", {
    0: (h) => (h >= 22 ? calm : { ...calm, gust: 55 }),
    1: (h) => (h < 2 ? calm : { ...calm, gust: 55 }),
  });
  const n = A.analyzeNow(A.normalize(f), P, "2026-11-14T14:05");
  const b3 = n.byDur[3].best;
  assert.ok(b3, "hay ventana de 3 h");
  assert.equal(b3.level, "ideal");
  assert.ok(b3.crossesMidnight);
  assert.equal(b3.startTime.slice(0, 10), "2026-11-14");
  assert.ok(b3.startHour >= 22 && b3.endHour <= 26);
  const b4 = n.byDur[4].best;
  assert.equal(b4.startHour + "-" + b4.endHour, "22-26", "22:00 a 02:00");
  assert.equal(A.hh(b4.endHour), "02:00");
  assert.ok(n.byDur[2].best);
  for (const d of [2, 3, 4]) {
    n.byDur[d].windows.forEach((w) => w.hours.forEach((h) => assert.ok(h.hour >= 9 || h.hour <= 1, "sin horas de 02 a 09")));
    assert.ok(n.byDur[d].windows.every((w) => w.hours[0].time >= "2026-11-14T14:00"), "solo desde ahora");
  }
});

test("ahora: ráfagas excesivas nunca se recomiendan y la tarde agradable se advierte", () => {
  const model = A.normalize(buildForecast("2026-11-14", { 0: (h) => ({ ...calm, temp: 24, feels: 20, wind: 22, gust: 48 }) }));
  const n = A.analyzeNow(model, P, "2026-11-14T11:05");
  for (const d of [2, 3, 4]) {
    const b = n.byDur[d].best;
    if (b) { assert.ok(b.stats.maxGust <= 40); assert.notEqual(b.date, "2026-11-14"); }
  }
  assert.ok(n.pleasantUnsafe);
  assert.equal(n.pleasantUnsafe.maxGust, 48);
  assert.equal(n.pleasantUnsafe.from, "2026-11-14T11:00");
  const m = A.analyzeNow(A.normalize(buildForecast("2026-11-14")), P, "2026-11-14T10:05");
  assert.equal(m.pleasantUnsafe.spans.map((x) => x.from.slice(11, 16) + "-" + x.to.slice(11, 16)).join(","), "10:00-12:00,18:00-21:00", "no incluye las horas calmas del medio");
});

test("ahora: con datos ausentes no hay recomendación", () => {
  const f = buildForecast("2026-11-14");
  f.hourly.wind_gusts_10m = f.hourly.wind_gusts_10m.map(() => null);
  const n = A.analyzeNow(A.normalize(f), P, "2026-11-14T10:05");
  for (const d of [2, 3, 4]) {
    assert.equal(n.byDur[d].best, null);
    assert.ok(n.byDur[d].counts.sindatos > 0);
  }
});

test("cambios de pronóstico: detecta oportunidades nuevas y las que se caen", () => {
  const windy = A.normalize(buildForecast("2026-11-14", { 2: () => ({ ...calm, gust: 52 }) }));
  const calmer = A.normalize(buildForecast("2026-11-14", { 2: () => calm }));
  const up = A.diffForecast(windy, calmer, P, "2026-11-14T10:05");
  assert.ok(up.changed);
  const nueva = up.added.find((x) => x.w.date === "2026-11-16");
  assert.ok(nueva, "aparece una oportunidad el lunes 16");
  assert.equal(nueva.w.level, "ideal");
  assert.equal(nueva.before, "no");
  const down = A.diffForecast(calmer, windy, P, "2026-11-14T10:05");
  assert.ok(down.removed.some((x) => x.w.date === "2026-11-16" && x.now === "no"));
  const same = A.diffForecast(calmer, calmer, P, "2026-11-14T10:05");
  assert.equal(same.changed, false);
});

test("comparación observado/pronóstico solo con variables comparables", () => {
  const ref = new Date("2026-11-14T17:24:00Z");
  const o = A.parseMetar(REAL.metar_sawg.raw.join("\n"), ref)[0]; // 14:00 local, 13 kt
  const c = A.compareObs(o, realModel(REAL.corrida_14nov_1415));
  assert.equal(c.modelTime, "2026-11-14T14:00");
  assert.equal(c.wind.obs, 24.1);
  assert.equal(c.wind.fc, 21.3);
  assert.equal(c.temp.obs, 22);
  assert.equal(c.gust.obs, null, "el METAR no informó ráfagas: no se compara");
  assert.equal(A.compareObs(o, A.normalize(buildForecast("2026-12-01"))), null, "sin hora equivalente no hay comparación");
});

test("explicación: ventanas superpuestas, fuera de franja y que cruzan medianoche", () => {
  const model = A.normalize(buildForecast("2026-11-14"));
  const a = A.analyze(model, P, "2026-11-14T10:05");
  assert.equal(A.explainWindow(a, "2026-11-14", 12, 3).status, "recomendada");
  const sup = A.explainWindow(a, "2026-11-14", 13, 3);
  assert.equal(sup.status, "superpuesta");
  assert.match(sup.text, /se superpone con 12:00–15:00/);
  assert.equal(A.explainWindow(a, "2026-11-14", 23, 3).status, "incompleta");
  assert.equal(A.explainWindow(a, "2026-11-14", 8, 3).status, "pasado");
  const b = A.analyze(model, { ...P, slot: "almuerzo" }, "2026-11-14T10:05");
  const ff = A.explainWindow(b, "2026-11-14", 15, 2);
  assert.ok(["fuera-franja", "descartada"].includes(ff.status));
});
