import { useEffect, useState } from "react";
import { CITIES } from "./constants";
import { local } from "./storage";

/** Previsioni di un giorno. */
export interface DayWeather { code: number; max: number; min: number; rain: number | null }

/** Codici meteo WMO (quelli di Open-Meteo) → icona e descrizione. */
export function wmo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "☀️", label: "Sereno" };
  if (code === 1) return { icon: "🌤️", label: "Poco nuvoloso" };
  if (code === 2) return { icon: "⛅", label: "Parz. nuvoloso" };
  if (code === 3) return { icon: "☁️", label: "Nuvoloso" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "Nebbia" };
  if (code >= 51 && code <= 57) return { icon: "🌦️", label: "Pioviggine" };
  if (code >= 61 && code <= 67) return { icon: "🌧️", label: code >= 65 ? "Pioggia forte" : "Pioggia" };
  if (code >= 71 && code <= 77) return { icon: "❄️", label: "Neve" };
  if (code >= 80 && code <= 82) return { icon: "🌦️", label: "Rovesci" };
  if (code === 85 || code === 86) return { icon: "🌨️", label: "Rovesci di neve" };
  if (code >= 95) return { icon: "⛈️", label: "Temporale" };
  return { icon: "🌡️", label: "Meteo" };
}

/** La città del giorno tra quelle note: "Kyoto · Nara" → Kyoto, "Tokyo → Kyoto" → Tokyo. */
export function cityOf(dayCity: string) {
  const first = (dayCity || "").split(/[·,/→>-]/)[0].trim().toLowerCase();
  return CITIES.find((c) => c.name.toLowerCase() === first);
}

interface ForecastJson {
  daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max?: (number | null)[] };
}

export function parseForecast(j: ForecastJson): Record<string, DayWeather> {
  const d = j.daily, out: Record<string, DayWeather> = {};
  if (!d) return out;
  d.time.forEach((t, i) => {
    if (d.weather_code[i] == null || d.temperature_2m_max[i] == null) return;
    out[t] = { code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], rain: d.precipitation_probability_max?.[i] ?? null };
  });
  return out;
}

const TTL = 3 * 60 * 60 * 1000;
const inFlight = new Map<string, Promise<Record<string, DayWeather>>>();

/** Previsioni a 16 giorni per una città, con cache di 3 ore. Senza rete restituisce l'ultima previsione salvata. */
function forecast(city: (typeof CITIES)[number]): Promise<Record<string, DayWeather>> {
  const key = "wx_" + city.name;
  let cached: { at: number; days: Record<string, DayWeather> } | null = null;
  try { cached = JSON.parse(local.get(key) || "null"); } catch { /* cache rovinata */ }
  if (cached && Date.now() - cached.at < TTL) return Promise.resolve(cached.days);
  if (!inFlight.has(key)) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}` +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=16";
    inFlight.set(key, fetch(url)
      .then((r) => { if (!r.ok) throw new Error("meteo " + r.status); return r.json(); })
      .then((j: ForecastJson) => { const days = parseForecast(j); local.set(key, JSON.stringify({ at: Date.now(), days })); return days; })
      .catch(() => cached?.days || {})
      .finally(() => inFlight.delete(key)));
  }
  return inFlight.get(key)!;
}

/** Meteo previsto per un giorno del viaggio, o null se è troppo lontano o la città non è nota. */
export function useWeather(dayCity: string, dayId: string): DayWeather | null {
  const [w, setW] = useState<DayWeather | null>(null);
  useEffect(() => {
    setW(null);
    const city = cityOf(dayCity);
    if (!city) return;
    let alive = true;
    forecast(city).then((days) => { if (alive) setW(days[dayId] || null); });
    return () => { alive = false; };
  }, [dayCity, dayId]);
  return w;
}
