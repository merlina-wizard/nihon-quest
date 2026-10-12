import type { Booking, Stop } from "../types";

/** Ora attuale a Tokyo, "HH:MM". */
export const nowTokyoHM = (d = new Date()) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/** "14:30" → 870. Restituisce null se l'ora manca o non è valida. */
export function minutesOf(hm: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hm || "");
  return m ? +m[1] * 60 + +m[2] : null;
}

/** Una tappa non spuntata resta "la prossima" fino a un'ora dopo il suo orario, poi si passa oltre. */
export const LATE_LIMIT = 60;

/**
 * La prossima tappa da fare, dato l'elenco del giorno già ordinato (vedi `dayStops`).
 * È la prima tappa nel programma non ancora fatta e non passata da più di un'ora
 * (chi non spunta le tappe non deve vedersi proporre quella del mattino a sera).
 * `inMin` sono i minuti mancanti (negativi se in ritardo), null se la tappa non ha orario.
 */
export function nextUp(list: Stop[], hm: string): { stop: Stop; inMin: number | null } | null {
  const now = minutesOf(hm);
  for (const stop of list) {
    if (stop.status !== "ok" || stop.done) continue;
    const at = minutesOf(stop.time);
    if (at === null || now === null) return { stop, inMin: null };
    if (at - now >= -LATE_LIMIT) return { stop, inMin: at - now };
  }
  return null;
}

/** "tra 40 min", "tra 2 h 5 min", "adesso", "15 min fa". */
export function fmtIn(min: number): string {
  if (Math.abs(min) < 3) return "adesso";
  const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
  const t = h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
  return min > 0 ? `tra ${t}` : `${t} fa`;
}

/**
 * Le prenotazioni che riguardano un giorno: quelle di quel giorno,
 * più quelle di più giorni (hotel, pass) che lo comprendono. Ordinate per ora.
 */
export function bookingsOn(bookings: Booking[], dayId: string): Booking[] {
  return bookings
    .filter((b) => b.date === dayId || (!!b.date && !!b.endDate && b.date <= dayId && dayId <= b.endDate))
    .sort((a, b) => (a.date === dayId && a.time ? a.time : "99").localeCompare(b.date === dayId && b.time ? b.time : "99"));
}
