import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEngine, buildForecast } from "./fixture.mjs";

const A = loadEngine();
const P = A.sanitizePrefs({});
const s = (x) => JSON.stringify(x);

test("calendario: grilla lunes a domingo y fechas locales", () => {
  const dic = A.monthGrid(2026, 12);
  assert.equal(dic[0].indexOf("2026-12-01"), 1, "el 1/12/2026 es martes");
  assert.equal(dic[dic.length - 1].filter(Boolean).pop(), "2026-12-31");
  const feb = A.monthGrid(2028, 2).flat().filter(Boolean);
  assert.equal(feb.length, 29, "2028 es bisiesto");
  assert.equal(A.monthGrid(2027, 2).flat().filter(Boolean).length, 28);
  assert.equal(A.dateAdd("2026-12-31", 1), "2027-01-01");
  assert.equal(A.dateAdd("2027-03-01", -1), "2027-02-28");
  assert.equal(A.dowMon("2026-11-14"), 5, "sábado");
});

test("selección de rangos: inicio, fin, invertido, un día y tope", () => {
  let sel = A.pickDate(null, "2026-12-27");
  assert.equal(s(sel), s({ start: "2026-12-27", end: "2026-12-27", done: false }));
  sel = A.pickDate(sel, "2026-12-24");
  assert.equal(s(sel), s({ start: "2026-12-24", end: "2026-12-27", done: true }), "un fin anterior se invierte");
  sel = A.pickDate(sel, "2026-12-30");
  assert.equal(s(sel), s({ start: "2026-12-30", end: "2026-12-30", done: false }), "tercer toque empieza de nuevo");
  sel = A.pickDate(sel, "2026-12-30");
  assert.equal(s(sel), s({ start: "2026-12-30", end: "2026-12-30", done: true }), "mismo día = un solo día");
  const big = A.normRange("2026-01-01", "2026-12-31");
  assert.equal(A.rangeDates(big).length, A.MAX_RANGE);
  assert.equal(A.rangeDates(A.normRange("2026-12-30", "2027-01-02")).join(","), "2026-12-30,2026-12-31,2027-01-01,2027-01-02");
});

test("accesos rápidos: Navidad, Año Nuevo (cruza el año) y feriado largo real", () => {
  assert.equal(s(A.quickRange("navidad", "2026-11-14")), s({ start: "2026-12-24", end: "2026-12-25", label: "Navidad" }));
  assert.equal(A.quickRange("navidad", "2026-12-26").start, "2027-12-24", "pasada la Navidad, la del año siguiente");
  const an = A.quickRange("anionuevo", "2026-11-14");
  assert.equal(an.start + "|" + an.end, "2026-12-31|2027-01-01");
  const an1 = A.quickRange("anionuevo", "2027-01-01");
  assert.equal(an1.start + "|" + an1.end, "2026-12-31|2027-01-01", "el 1/1 sigue siendo ese Año Nuevo");
  const fl = A.quickRange("feriado", "2026-11-14");
  assert.equal(fl.start + "|" + fl.end, "2026-11-21|2026-11-23");
  assert.match(fl.label, /Soberanía Nacional/);
  const lw = A.longWeekends("2026-11-14").map((b) => b.start + "|" + b.end);
  assert.ok(lw.includes("2026-12-05|2026-12-08"), "puente del 7/12 + Inmaculada Concepción");
  assert.ok(lw.includes("2027-01-01|2027-01-03"), "cruce de año: Año nuevo 2027 cae viernes");
  const mid = A.quickRange("feriado", "2026-11-22");
  assert.equal(mid.start + "|" + mid.end, "2026-11-22|2026-11-23", "si ya empezó, desde hoy");
});

function byDurFor(model, now) {
  const o = {};
  [2, 3, 4].forEach((k) => { o[k] = A.analyze(model, { ...P, duration: k }, now); });
  return o;
}

test("plan: pronóstico horario, tendencia, «todavía es pronto» y pasado", () => {
  const model = A.normalize(buildForecast("2026-11-14"));
  const now = "2026-11-14T10:05";
  const plan = A.planRange(A.normRange("2026-11-12", "2026-12-25"), "2026-11-14", byDurFor(model, now), null);
  const kind = (d) => plan.find((p) => p.date === d).kind;
  assert.equal(kind("2026-11-13"), "pasado");
  assert.equal(kind("2026-11-14"), "horario");
  assert.equal(kind("2026-11-20"), "horario", "día 7 del pronóstico horario");
  assert.equal(kind("2026-11-21"), "tendencia");
  assert.equal(kind("2026-11-29"), "tendencia", "día 16");
  assert.equal(kind("2026-11-30"), "pronto");
  assert.equal(kind("2026-12-25"), "pronto");
  // horario: las recomendaciones salen del mismo motor y nunca hay ventanas rojas
  const today = plan.find((p) => p.date === "2026-11-14");
  assert.equal(today.byDur[3].recs[0].startHour + "-" + today.byDur[3].recs[0].endHour, "12-15");
  assert.equal(today.byDur[2].recs[0].endHour - today.byDur[2].recs[0].startHour, 2);
  plan.filter((p) => p.kind === "horario").forEach((p) => [2, 3, 4].forEach((k) => p.byDur[k].recs.forEach((r) => assert.notEqual(r.level, "no"))));
  // lejos: ni puntaje ni horario
  plan.filter((p) => p.kind !== "horario").forEach((p) => { assert.equal(p.byDur, undefined); assert.equal(p.score, undefined); });
  const sum = A.planSummary(plan, 3);
  assert.equal(s([sum.past, sum.hourly, sum.trend, sum.early]), s([2, 7, 9, 26]));
  assert.equal(sum.best.score, 100);
});

test("plan sin pronóstico cargado: nunca inventa horarios", () => {
  const plan = A.planRange(A.normRange("2026-11-14", "2026-11-16"), "2026-11-14", null, null);
  assert.ok(plan.every((p) => p.kind === "tendencia"));
  assert.equal(A.planSummary(plan, 3).best, null);
});

test("tendencia diaria y estadística histórica", () => {
  const tr = A.normalizeTrend({ daily: { time: ["2026-11-21"], temperature_2m_max: [19.4], temperature_2m_min: [8], wind_speed_10m_max: [30], wind_gusts_10m_max: [62.3], precipitation_probability_max: [20], precipitation_sum: [0.4] } });
  assert.equal(A.trendText(tr["2026-11-21"]), "Ráfagas fuertes en algún momento del día (hasta 62 km/h), lluvia 20 % (0,4 mm), máxima 19 °C.");
  assert.equal(A.trendText(null), "Sin datos de tendencia para este día.");
  assert.throws(() => A.normalizeTrend({}));
  // archivo: dos años sintéticos
  const time = [], g = [], t = [], p = [];
  for (const y of [2024, 2025]) for (const d of ["12-24", "12-25", "12-26"]) { time.push(y + "-" + d); g.push(y === 2024 ? 50 : 30); t.push(20); p.push(d === "12-25" ? 2 : 0); }
  const c = A.climatology({ daily: { time, wind_gusts_10m_max: g, temperature_2m_max: t, precipitation_sum: p } }, A.normRange("2026-12-24", "2026-12-25"));
  assert.equal(c.days, 4);
  assert.equal(s(c.years), s([2024, 2025]));
  assert.equal(c.gustAvg, 40);
  assert.equal(c.gustOver40, 0.5);
  assert.equal(c.rainy, 0.5);
  assert.equal(A.climatology({ daily: { time: ["2024-01-01"], wind_gusts_10m_max: [1], temperature_2m_max: [1], precipitation_sum: [0] } }, A.normRange("2026-12-24", "2026-12-25")), null);
});

test("eventos: detecta cambios entre visitas (base de alertas futuras)", () => {
  const far = A.planRange(A.normRange("2026-12-24", "2026-12-25"), "2026-11-14", null, null);
  const sigFar = A.eventSignature(far, 3);
  assert.equal(sigFar, "pronto");
  const windy = A.normalize(buildForecast("2026-11-14", { 2: () => ({ temp: 17, feels: 15, prob: 0, precip: 0, code: 1, wind: 28, gust: 55, dir: 250 }) }));
  const calm = A.normalize(buildForecast("2026-11-14", { 2: () => ({ temp: 17, feels: 15, prob: 0, precip: 0, code: 1, wind: 8, gust: 15, dir: 250 }) }));
  const r = A.normRange("2026-11-16", "2026-11-16");
  const sWindy = A.eventSignature(A.planRange(r, "2026-11-14", byDurFor(windy, "2026-11-14T10:05"), null), 3);
  const sCalm = A.eventSignature(A.planRange(r, "2026-11-14", byDurFor(calm, "2026-11-14T10:05"), null), 3);
  assert.equal(sWindy, "horario|sin-ventanas");
  assert.match(sCalm, /^horario\|2026-11-16\|\d+\|\d+\|ideal$/);
  assert.equal(A.eventChange(sigFar, sWindy), "Ya hay pronóstico horario para este evento.");
  assert.equal(A.eventChange(sWindy, sCalm), "Apareció una ventana recomendable.");
  assert.equal(A.eventChange(sCalm, sWindy), "La ventana recomendada dejó de cumplir las condiciones.");
  assert.equal(A.eventChange(sCalm, sCalm), null);
  assert.equal(A.eventChange("pronto", "tendencia"), "Ya hay una tendencia diaria para este evento.");
});

test("datos reales del planificador: tendencia de 16 días y archivo histórico", async () => {
  const { readFileSync } = await import("node:fs");
  const R = JSON.parse(readFileSync(new URL("./data/live-planner-2026-11-14.json", import.meta.url)));
  const tr = A.normalizeTrend(R.trend);
  assert.equal(Object.keys(tr).length, 16);
  assert.equal(A.trendText(tr["2026-11-22"]), "Ráfagas fuertes en algún momento del día (hasta 84 km/h), lluvia 22 %, máxima 19 °C.");
  const c = A.climatology(R.archive, A.normRange("2026-12-24", "2026-12-25"));
  assert.equal(c.days, 2);
  assert.equal(c.gustOver40, 1);
  assert.equal(Math.round(c.gustAvg * 10) / 10, 103.5);
});

test("próximos feriados: ventana móvil de 6 meses", () => {
  const ids = (t) => A.upcomingHolidays(A.HOLIDAYS, t, 6).map((b) => b.start + ".." + b.end);
  const a = ids("2026-11-14");
  assert.equal(a[0], "2026-11-21..2026-11-23");
  assert.ok(a.includes("2026-12-05..2026-12-08"), "puente + Inmaculada Concepción");
  assert.ok(a.includes("2027-01-01..2027-01-03"), "cruza el año");
  assert.ok(a.every((x) => x.slice(0, 10) <= "2027-05-14"));
  const b = A.upcomingHolidays(A.HOLIDAYS, "2026-11-22", 6)[0];
  assert.equal(b.start + ".." + b.end + "|" + b.days + "|" + b.started, "2026-11-22..2026-11-23|2|true", "ya empezado: desde hoy");
  assert.ok(!ids("2026-11-24").some((x) => x.startsWith("2026-11-2")), "al pasar desaparece");
  assert.equal(A.upcomingHolidays([], "2026-11-14", 6).length, 0);
  assert.equal(A.addMonths("2026-08-31", 6), "2027-02-28");
  // feriado entre semana: 1 día
  const mid = A.upcomingHolidays([["2027-03-24", "Día de la Memoria"]], "2027-03-01", 6)[0];
  assert.equal(mid.days + "|" + mid.long, "1|false");
});
