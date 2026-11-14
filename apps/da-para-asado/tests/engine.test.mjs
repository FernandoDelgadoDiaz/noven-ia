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

const calm = { temp: 17, feels: 15, prob: 0, precip: 0, code: 1, wind: 8, gust: 15, dir: 250 };
const keyOf = (w) => w.date + " " + w.startHour + "-" + w.endHour;

test("el viento manda: un día soleado con ráfagas de 55 nunca se recomienda y queda descartado", () => {
  const a = A.analyze(model, P, NOW);
  const d1 = a.days[1];
  assert.ok(d1.windows.length > 0 && d1.windows.every((w) => w.level === "no"));
  assert.equal(d1.recs.length, 0);
  assert.equal(d1.discard.kind, "clima");
  assert.equal(d1.discard.reasons[0].key, "gust");
  assert.match(A.discardText(d1, a.prefs), /Ráfagas de hasta 55 km\/h.*en 15 de 15 horas/);
  assert.ok(a.discarded.some((d) => d.date === d1.date));
});

test("caso reportado: viento 22 y ráfagas 48 de 13 a 16 nunca aparece como recomendado", () => {
  const f = buildForecast(TODAY, { 2: (h) => (h >= 13 && h < 16 ? { ...calm, wind: 22, gust: 48 } : { ...calm, wind: 26, gust: 52 }) });
  const a = A.analyze(A.normalize(f), P, NOW);
  const d = a.days[2];
  const w = d.windows.find((x) => x.startHour === 13);
  assert.equal(w.level, "no");
  assert.ok(w.score <= 39);
  assert.equal(d.recs.length, 0);
  assert.ok(!a.recs.some((r) => r.stats.maxGust > 40), "ninguna recomendación supera 40 km/h de ráfagas");
  assert.ok(a.recs.every((r) => r.level === "ideal" || r.level === "precaucion"));
  assert.match(A.discardText(d, a.prefs), /Ráfagas de hasta 52 km\/h/);
});

test("la ventana toma la peor hora: una sola hora mala la descalifica", () => {
  const f = buildForecast(TODAY, { 2: (h) => ({ ...calm, gust: h === 15 ? 45 : 15 }) });
  const a = A.analyze(A.normalize(f), { ...P, slot: "tarde" }, NOW);
  const d = a.days[2];
  const inc15 = d.windows.filter((w) => w.startHour <= 15 && w.endHour > 15);
  assert.ok(inc15.length && inc15.every((w) => w.level === "no"));
  assert.ok(d.recs.length >= 1);
  assert.ok(d.recs.every((r) => r.startHour >= 16), "ninguna recomendación incluye las 15 h");
});

test("un día con varias ventanas favorables devuelve todas las alternativas, sin superponerse", () => {
  // ideal 9–12 y 16–20, con precaución (ráfagas 35) entre medio y rojo a la noche
  const f = buildForecast(TODAY, { 2: (h) => (h >= 9 && h < 12) || (h >= 16 && h < 20) ? calm : h >= 12 && h < 16 ? { ...calm, gust: 35 } : { ...calm, gust: 50 } });
  const a = A.analyze(A.normalize(f), P, NOW);
  const d = a.days[2];
  const ideal = d.recs.filter((r) => r.level === "ideal");
  assert.equal(ideal.length, 2);
  assert.deepEqual(Array.from(ideal, (r) => r.startHour).sort((x, y) => x - y).join(","), "9,16");
  const caution = d.recs.filter((r) => r.level === "precaucion");
  assert.equal(caution.length, 1);
  assert.ok(caution[0].startHour >= 12 && caution[0].endHour <= 16);
  for (let i = 0; i < d.recs.length; i++) for (let j = i + 1; j < d.recs.length; j++) {
    const x = d.recs[i], y = d.recs[j];
    assert.ok(!(x.startHour < y.endHour && y.startHour < x.endHour), "superpuestas: " + keyOf(x) + " / " + keyOf(y));
  }
  assert.ok(d.recs.length <= A.MAX_RECS_PER_DAY);
  const scores = Array.from(a.recs, (r) => r.score);
  assert.equal(scores.join(","), [...scores].sort((x, y) => y - x).join(","));
});

test("un tramo ideal largo no se repite en ventanas duplicadas", () => {
  const a = A.analyze(model, P, NOW);
  const t = a.todayInfo;
  assert.equal(t.recs.length, 1, "12–18 ideal genera una sola recomendación");
  assert.equal(t.top.level, "ideal");
  assert.equal(t.top.startHour + "-" + t.top.endHour, "12-15");
  assert.equal(t.top.span.start + "-" + t.top.span.end, "12-18");
  assert.equal(t.top.spanKind, "ideal");
});

test("hoy no usa horas pasadas", () => {
  const a = A.analyze(model, P, TODAY + "T12:40");
  assert.ok(a.todayInfo.windows.every((w) => w.startHour >= 13));
  assert.equal(a.todayInfo.top.startHour, 13);
  const night = A.analyze(model, P, TODAY + "T23:30");
  assert.equal(night.todayInfo.recs.length, 0);
  assert.equal(night.todayInfo.discard.kind, "pasado");
});

test("clasificación de días: precaución, lluvia, frío y datos faltantes", () => {
  const a = A.analyze(model, P, NOW);
  assert.equal(a.days[2].top.level, "precaucion");
  assert.ok(a.days[2].top.score >= 40 && a.days[2].top.score <= 69);
  assert.equal(a.days[3].recs.length, 0);
  assert.ok(["precip", "prob"].includes(a.days[3].discard.reasons[0].key));
  assert.equal(a.days[4].top.level, "precaucion");
  assert.ok(a.days[4].top.startHour >= 9 && a.days[4].top.endHour <= 15);
  assert.equal(a.days[5].recs.length, 0, "solo 2 h ideales no alcanzan para 3 h");
  assert.equal(a.days[6].recs.length, 0);
  assert.equal(a.days[6].discard.kind, "sindatos");
  assert.equal(Array.from(a.discarded, (d) => d.date).join(","), [1, 3, 5, 6].map((i) => a.days[i].date).join(","));
  assert.ok(a.recs.every((r) => r.level !== "no" && r.level !== "sindatos"));
});

test("sin condiciones favorables en 7 días: lista vacía, nada inventado", () => {
  const storm = {};
  for (let d = 0; d < 7; d++) storm[d] = () => ({ ...calm, wind: 35, gust: 70 });
  const a = A.analyze(A.normalize(buildForecast(TODAY, storm)), P, NOW);
  assert.equal(a.recs.length, 0);
  assert.equal(a.overall, null);
  assert.equal(a.discarded.length, 7);
});

test("las recomendaciones reflejan las preferencias", () => {
  const d3 = A.analyze(model, { ...P, duration: 3 }, NOW).days[5];
  const d2 = A.analyze(model, { ...P, duration: 2 }, NOW).days[5];
  assert.equal(d3.recs.length, 0);
  assert.equal(d2.top.level, "ideal");
  assert.equal(d2.top.startHour + "-" + d2.top.endHour, "14-16");
  const five = A.analyze(model, { ...P, duration: 5 }, NOW).todayInfo.top;
  assert.equal(five.endHour - five.startHour, 5);
  const strict = A.analyze(model, { ...P, minFeels: 16 }, NOW);
  assert.equal(strict.todayInfo.top.level, "precaucion", "sensación 15 < 16");
  const loose = A.analyze(model, { ...P, maxWind: 25, maxGust: 35 }, NOW);
  assert.equal(loose.days[2].top.level, "ideal");
  const tight = A.analyze(model, { ...P, maxGust: 20 }, NOW);
  assert.equal(tight.todayInfo.top.level, "ideal", "ráfagas de 15 siguen dentro");
});

test("la franja horaria limita las ventanas y admite cierre a medianoche", () => {
  const a = A.analyze(model, { ...P, slot: "noche" }, NOW);
  a.days.forEach((d) => d.windows.forEach((w) => { assert.ok(w.startHour >= 19 && w.endHour <= 24); }));
  const f = buildForecast(TODAY, { 2: (h) => (h >= 19 ? calm : { ...calm, gust: 60 }) });
  const n = A.analyze(A.normalize(f), { ...P, slot: "noche", duration: 5 }, NOW);
  const r = n.days[2].top;
  assert.equal(r.startHour + "-" + r.endHour, "19-24");
  assert.equal(A.hh(r.endHour), "00:00");
  assert.match(A.describeWindow(r, n.prefs, n.today), /entre las 19:00 y la medianoche/);
  assert.equal(r.date, n.days[2].date, "la ventana pertenece al día en que empieza");
  const b = A.analyze(model, { ...P, slot: "almuerzo" }, NOW);
  b.days.forEach((d) => d.windows.forEach((w) => { assert.ok(w.startHour >= 11 && w.endHour <= 16); }));
});

test("parrilla protegida: mejora el puntaje, nunca la categoría ni las recomendaciones rojas", () => {
  const e = A.analyze(model, { ...P, exposure: "expuesta" }, NOW);
  const p = A.analyze(model, { ...P, exposure: "protegida" }, NOW);
  for (let i = 0; i < 6; i++) {
    const we = e.days[i].windows, wp = p.days[i].windows;
    we.forEach((w, k) => {
      assert.equal(wp[k].level, w.level);
      if (w.score !== null) assert.ok(wp[k].score >= w.score);
    });
  }
  assert.ok(p.days[2].top.score > e.days[2].top.score);
  assert.equal(p.days[1].recs.length, 0, "las ráfagas de 55 siguen descalificando");
});

test("bandas de puntaje", () => {
  assert.equal(A.bandScore("ideal", 0), 70);
  assert.equal(A.bandScore("ideal", 100), 100);
  assert.equal(A.bandScore("precaucion", 100), 69);
  assert.equal(A.bandScore("no", 100), 39);
  const a = A.analyze(model, P, NOW);
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
  const txt = A.describeWindow(a.todayInfo.top, a.prefs, a.today);
  assert.match(txt, /^Hoy entre las 1\d:00 y las 1\d:00 es tu mejor oportunidad\./);
  assert.match(txt, /sin lluvia prevista/);
  assert.equal(A.dayLabel("2026-11-15", TODAY), "Mañana");
  assert.equal(A.dayLabel("2026-11-16", TODAY), "Lunes");
  assert.equal(A.dayPhrase("2026-11-21", TODAY), "el sábado 21/11");
  assert.equal(A.cardinal(250), "OSO");
  assert.equal(A.cardinal(270), "O");
  assert.equal(A.hh(24), "00:00");
  assert.equal(A.dayLabel(TODAY, TODAY), "Hoy");
  assert.equal(A.weekday(TODAY), "sábado");
});

test("normalize rechaza respuestas inválidas", () => {
  assert.throws(() => A.normalize(null));
  assert.throws(() => A.normalize({ error: true, reason: "Parameter invalid" }), /Parameter invalid/);
  assert.throws(() => A.normalize({ hourly: { time: [] } }));
  const m = A.normalize({ hourly: { time: ["2026-11-14T10:00"], wind_speed_10m: ["x"] } });
  assert.equal(m.days[0].hours[0].wind, null);
});

test("hora local de Río Gallegos independiente del huso del dispositivo", () => {
  assert.equal(A.nowLocal(new Date("2026-11-15T02:59:00Z")), "2026-11-14T23:59");
  assert.equal(A.nowLocal(new Date("2026-11-15T03:00:00Z")), "2026-11-15T00:00");
  assert.equal(A.nowLocal(new Date("2026-11-14T13:05:00Z")), "2026-11-14T10:05");
  assert.equal(A.nowLocal(new Date("2026-11-15T02:30:00Z")), "2026-11-14T23:30");
});
