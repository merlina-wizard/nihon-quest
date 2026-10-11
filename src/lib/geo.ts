import { CITIES } from "./constants";

export interface LatLng { lat: number; lng: number }

export const inJapan = (lat: number, lng: number) => lat > 24 && lat < 46 && lng > 122 && lng < 146;

export const hasPos = (s: { lat?: number; lng?: number }): s is { lat: number; lng: number } =>
  typeof s.lat === "number" && typeof s.lng === "number";

/** Link "Portami lì": Google Maps con i mezzi pubblici. Usa le coordinate se ci sono, altrimenti il nome. */
export function mapsLink(s: { lat?: number; lng?: number; place?: string; title?: string }): string {
  if (hasPos(s)) return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=transit`;
  const q = [s.place || s.title, "Japan"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=transit`;
}

/** Percorso con più tappe su Google Maps (max 9 tappe intermedie). */
export function routeLink(points: LatLng[]): string | null {
  if (points.length < 2) return null;
  const p = points.slice(0, 11);
  const o = p[0], d = p[p.length - 1], w = p.slice(1, -1);
  return (
    `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}` +
    (w.length ? `&waypoints=${w.map((x) => `${x.lat},${x.lng}`).join("%7C")}` : "")
  );
}

/** Estrae le coordinate da un link lungo di Google Maps o da "lat, lng". I link corti (maps.app.goo.gl) non le contengono. */
export function parseCoords(txt: string): LatLng | null {
  if (!txt) return null;
  const pats = [
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|destination)=(-?\d{1,3}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i,
    /^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/,
  ];
  for (const p of pats) {
    const m = txt.match(p);
    if (m) {
      const lat = +m[1], lng = +m[2];
      if (inJapan(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

/** Città più vicina (entro 70 km), per filtrare la mappa. */
export function nearestCity(s: LatLng): string {
  let best = "Altro", bd = Infinity;
  for (const c of CITIES) {
    const d = Math.hypot((s.lat - c.lat) * 111, (s.lng - c.lng) * 91);
    if (d < bd) { bd = d; best = c.name; }
  }
  return bd < 70 ? best : "Altro";
}

/**
 * Cerca le coordinate di un luogo in Giappone con Nominatim (OpenStreetMap).
 * Gratuito, max 1 richiesta al secondo: si usa solo su tocco di un pulsante.
 */
export async function geocode(query: string): Promise<(LatLng & { label: string }) | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=jp&accept-language=it,en&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("geocode " + res.status);
  const arr = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!arr.length) return null;
  const lat = +arr[0].lat, lng = +arr[0].lon;
  return inJapan(lat, lng) ? { lat, lng, label: arr[0].display_name } : null;
}
