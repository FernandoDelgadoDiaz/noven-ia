// Pronóstico SINTÉTICO, solo para pruebas automáticas. Nunca se usa en la app.
// Construye una respuesta con la forma exacta de Open-Meteo y escenarios controlados.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = fileURLToPath(new URL(".", import.meta.url));

export function loadEngine() {
  const html = readFileSync(here + "../index.html", "utf8");
  const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
  const ctx = { Intl, Math, Date, Object, Array, Number, String, JSON, isFinite, encodeURIComponent };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(m[1], ctx);
  return ctx.Asado;
}

function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

const calm = { temp: 17, feels: 15, prob: 0, precip: 0, code: 1, wind: 8, gust: 15, dir: 250 };

// Escenarios por día (índice 0 = hoy). Cada uno devuelve los valores de una hora.
const SCENARIOS = [
  // 0 hoy: calmo de 12 a 18, ventoso el resto
  (h) => (h >= 12 && h < 18 ? calm : { ...calm, wind: 28, gust: 45 }),
  // 1: soleado y templado, pero ráfagas de 55 todo el día → nunca ideal
  (h) => ({ ...calm, code: 0, temp: 22, feels: 21, wind: 18, gust: 55 }),
  // 2: viento 25 / ráfagas 35 → con precauciones
  (h) => ({ ...calm, wind: 25, gust: 35 }),
  // 3: lluvia
  (h) => ({ ...calm, code: 63, prob: 80, precip: 1.2 }),
  // 4: frío: sensación 7 de 9 a 15 (precaución), 3 el resto (no conviene)
  (h) => ({ ...calm, temp: 9, feels: h >= 9 && h < 15 ? 7 : 3 }),
  // 5: solo 2 h ideales (14–16), el resto con ráfagas fuertes
  (h) => (h >= 14 && h < 16 ? calm : { ...calm, wind: 20, gust: 48 }),
  // 6: falta el dato de viento a la tarde
  (h) => (h >= 9 && h < 24 ? { ...calm, wind: null } : calm),
];

export function buildForecast(today, overrides = {}) {
  const hourly = {
    time: [], temperature_2m: [], apparent_temperature: [], precipitation_probability: [], precipitation: [],
    weather_code: [], wind_speed_10m: [], wind_gusts_10m: [], wind_direction_10m: [], is_day: [],
  };
  const daily = { time: [], sunrise: [], sunset: [], weather_code: [] };
  for (let d = 0; d < 7; d++) {
    const date = addDays(today, d);
    daily.time.push(date);
    daily.sunrise.push(date + "T05:35");
    daily.sunset.push(date + "T21:08");
    daily.weather_code.push(3);
    for (let h = 0; h < 24; h++) {
      const f = (overrides[d] || SCENARIOS[d])(h);
      hourly.time.push(date + "T" + String(h).padStart(2, "0") + ":00");
      hourly.temperature_2m.push(f.temp);
      hourly.apparent_temperature.push(f.feels);
      hourly.precipitation_probability.push(f.prob);
      hourly.precipitation.push(f.precip);
      hourly.weather_code.push(f.code);
      hourly.wind_speed_10m.push(f.wind);
      hourly.wind_gusts_10m.push(f.gust);
      hourly.wind_direction_10m.push(f.dir);
      hourly.is_day.push(h >= 6 && h < 21 ? 1 : 0);
    }
  }
  return {
    latitude: -51.63, longitude: -69.22, timezone: "America/Argentina/Rio_Gallegos", utc_offset_seconds: -10800,
    current: { time: today + "T10:00", temperature_2m: 12, apparent_temperature: 9, wind_speed_10m: 14, wind_gusts_10m: 26, wind_direction_10m: 260, weather_code: 2 },
    hourly, daily,
  };
}
