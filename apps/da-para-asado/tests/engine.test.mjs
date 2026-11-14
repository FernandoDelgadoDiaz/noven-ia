import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEngine, buildForecast } from "./fixture.mjs";

const A = loadEngine();
const TODAY = "2026-11-14";
const NOW = TODAY + "T10:05";
const P = A.sanitizePrefs({});
const model = A.normalize(buildForecast(TODAY));
const hour = (o) => ({ wind: 10, gust: 20, feels: 15, prob: 0, precip: 0, code: 1, temp: 16, dir: 250, isDay: 1, ...o });

test("umbrales por hora (valores por defecto)", () => {
  assert.equal(A.classifyHour(hour({ wind: 20, gust: 30, prob: 19, feels: 10 }), P).level, "ideal");
  assert.equal(A.classifyHour(hour({ gust: 30.1 }), P).level, "precaucion");
  assert.equal(A.classifyHour(hour({ gust: 40 }), P).level, "precaucion");
  assert.equal(A.classifyHour(hour({ gust: 40.1 }), P).level, "no");
  assert.equal(A.classifyHour(hour({ wind: 20.5 }), P).level, "precaucion");
  assert.equal(A.classifyHour(hour({ wind: 30.1, gust: 35 }), P).level, "no");
  assert.equal(A.classifyHour(hour({ prob: 20 }), P).level, "precaucion");
  assert.equal(A.classifyHour(hour({ prob: 50 }), P).level, "no");
  assert.equal(A.classifyHour(hour({ precip: 0.2 }), P).level, "precaucion");
  assert.equal(A.classifyHour(hour({ precip: 0.5 }), P).level, "no");
  assert.equal(A.classifyHour(hour({ feels: 9.9 }), P).level, "precaucion");
  assert.equal(A.classifyHour(hour({ feels: 5 }), P).level, "precaucion");
  assert.equal(A.classifyHour(hour({ feels: 4.9 }), P).level, "no");
  assert.equal(A.classifyHour(hour({ code: 95 }), P).level, "no");
  assert.equal(A.classifyHour(hour({ code: 73 }), P).level, "no");
  assert.equal(A.classifyHour(hour({ wind: null }), P).level, "sindatos");
});

test("el viento manda: un día soleado y templado con ráfagas fuertes nunca es ideal", () => {
  const a = A.analyze(model, P, NOW);
  const d1 = a.days[1];
  assert.ok(d1.windows.length > 0);
  assert.ok(d1.windows.every((w) => w.level === "no"));
  assert.ok(d1.best.score <= 39);
  assert.match(A.reasonText(d1.best.reasons[0], a.prefs), /Ráfagas de hasta 55/);
});

test("la ventana toma la peor hora: una sola hora mala la descalifica", () => {
  const f = buildForecast(TODAY, { 2: (h) => ({ temp: 17, feels: 15, prob: 0, precip: 0, code: 1, wind: 8, gust: h === 15 ? 45 : 15, dir: 250 }) });
  const a = A.analyze(A.normalize(f), { ...P, slot: "tarde" }, NOW);
  const d = a.days[2];
  const inc15 = d.windows.filter((w) => w.startHour <= 15 && w.endHour > 15);
  const exc15 = d.windows.filter((w) => !(w.startHour <= 15 && w.endHour > 15));
  assert.ok(inc15.length && inc15.every((w) => w.level === "no"));
  assert.ok(exc15.length && exc15.every((w) => w.level === "ideal"));
  assert.ok(d.best.startHour >= 16, "la mejor ventana evita las 15 h");
});

test("hoy: la mejor ventana está en el tramo calmo y no usa horas pasadas", () => {
  const a = A.analyze(model, P, NOW);
  const t = a.todayInfo;
  assert.equal(t.best.level, "ideal");
  assert.ok(t.best.startHour >= 12 && t.best.endHour <= 18);
  assert.equal(t.best.run.start + "-" + t.best.run.end, "12-18");
  assert.ok(t.windows.every((w) => w.startHour >= 10));
  const late = A.analyze(model, P, TODAY + "T10:40");
  assert.ok(late.todayInfo.windows.every((w) => w.startHour >= 11));
  const night = A.analyze(model, P, TODAY + "T23:30");
  assert.equal(night.todayInfo.best, null);
});

test("precaución, lluvia, frío y datos faltantes", () => {
  const a = A.analyze(model, P, NOW);
  assert.equal(a.days[2].best.level, "precaucion");
  assert.ok(a.days[2].best.score >= 40 && a.days[2].best.score <= 69);
  assert.equal(a.days[3].best.level, "no");
  assert.ok(a.days[3].best.reasons.some((r) => r.key === "precip" && r.sev === "no"));
  assert.equal(a.days[4].best.level, "precaucion");
  assert.ok(a.days[4].best.startHour >= 9 && a.days[4].best.endHour <= 15);
  assert.equal(a.days[6].best.level, "sindatos");
  assert.equal(a.days[6].best.score, null);
  assert.equal(a.ranked.at(-1).level, "sindatos", "los días sin datos quedan al final");
});

test("cambiar la duración cambia el resultado", () => {
  const d3 = A.analyze(model, { ...P, duration: 3 }, NOW).days[5];
  const d2 = A.analyze(model, { ...P, duration: 2 }, NOW).days[5];
  assert.equal(d3.best.level, "no");
  assert.equal(d2.best.level, "ideal");
  assert.equal(d2.best.startHour + "-" + d2.best.endHour, "14-16");
  const d5h = A.analyze(model, { ...P, duration: 5 }, NOW).todayInfo.best;
  assert.equal(d5h.endHour - d5h.startHour, 5);
});

test("cambiar umbrales cambia la categoría", () => {
  const strict = A.analyze(model, { ...P, maxWind: 10, maxGust: 20, minFeels: 16 }, NOW);
  assert.equal(strict.todayInfo.best.level, "precaucion", "sensación 15 < 16");
  const loose = A.analyze(model, { ...P, maxWind: 25, maxGust: 35 }, NOW);
  assert.equal(loose.days[2].best.level, "ideal", "viento 25 / ráfagas 35 entran en el ideal permisivo");
});

test("la franja horaria limita las ventanas", () => {
  const a = A.analyze(model, { ...P, slot: "noche" }, NOW);
  a.days.forEach((d) => d.windows.forEach((w) => { assert.ok(w.startHour >= 19 && w.endHour <= 24); }));
  const b = A.analyze(model, { ...P, slot: "almuerzo" }, NOW);
  b.days.forEach((d) => d.windows.forEach((w) => { assert.ok(w.startHour >= 11 && w.endHour <= 16); }));
});

test("parrilla protegida: mejora el puntaje, nunca la categoría", () => {
  const e = A.analyze(model, { ...P, exposure: "expuesta" }, NOW);
  const p = A.analyze(model, { ...P, exposure: "protegida" }, NOW);
  for (let i = 0; i < 6; i++) {
    const we = e.days[i].windows, wp = p.days[i].windows;
    we.forEach((w, k) => {
      assert.equal(wp[k].level, w.level);
      if (w.score !== null) assert.ok(wp[k].score >= w.score);
    });
  }
  assert.ok(p.days[2].best.score > e.days[2].best.score);
  assert.ok(p.days[1].windows.every((w) => w.level === "no"), "las ráfagas de 55 siguen descalificando");
});

test("bandas de puntaje y ranking ordenado", () => {
  assert.equal(A.bandScore("ideal", 0), 70);
  assert.equal(A.bandScore("ideal", 100), 100);
  assert.equal(A.bandScore("precaucion", 100), 69);
  assert.equal(A.bandScore("no", 100), 39);
  const a = A.analyze(model, P, NOW);
  const scores = Array.from(a.ranked.filter((w) => w.score !== null), (w) => w.score);
  assert.deepEqual(scores, [...scores].sort((x, y) => y - x));
  assert.equal(a.overall.level, "ideal");
  assert.equal(a.overall.date, TODAY);
});

test("preferencias saneadas: no se pueden relajar los límites duros", () => {
  const s = A.sanitizePrefs({ maxWind: 80, maxGust: 99, minFeels: -20, duration: 7, slot: "x", exposure: "y" });
  assert.equal(s.maxWind, 25);
  assert.equal(s.maxGust, 35);
  assert.equal(s.minFeels, 0);
  assert.equal(s.duration, 3);
  assert.equal(s.slot, "libre");
  assert.equal(s.exposure, "expuesta");
  assert.equal(A.sanitizePrefs({ maxWind: 25, maxGust: 20 }).maxGust, 25);
});

test("textos en español argentino", () => {
  const a = A.analyze(model, P, NOW);
  const txt = A.describeWindow(a.todayInfo.best, a.prefs, a.today);
  assert.match(txt, /^Hoy entre las 1\d:00 y las 1\d:00 es tu mejor oportunidad\./);
  assert.match(txt, /sin lluvia prevista/);
  assert.equal(A.dayLabel("2026-11-15", TODAY), "Mañana");
  assert.equal(A.dayLabel("2026-11-16", TODAY), "Lunes");
  assert.equal(A.dayPhrase("2026-11-21", TODAY), "el sábado 21/11");
  assert.equal(A.cardinal(250), "OSO");
  assert.equal(A.cardinal(270), "O");
  assert.equal(A.hh(24), "00:00");
  const no = A.describeWindow(a.days[3].best, a.prefs, a.today);
  assert.match(no, /no conviene/);
});

test("normalize rechaza respuestas inválidas", () => {
  assert.throws(() => A.normalize(null));
  assert.throws(() => A.normalize({ error: true, reason: "Parameter invalid" }), /Parameter invalid/);
  assert.throws(() => A.normalize({ hourly: { time: [] } }));
  const m = A.normalize({ hourly: { time: ["2026-11-14T10:00"], wind_speed_10m: ["x"] } });
  assert.equal(m.days[0].hours[0].wind, null);
});

test("hora local de Río Gallegos independiente del huso del dispositivo", () => {
  assert.equal(A.nowLocal(new Date("2026-11-14T13:05:00Z")), "2026-11-14T10:05");
  assert.equal(A.nowLocal(new Date("2026-11-15T02:30:00Z")), "2026-11-14T23:30");
});
