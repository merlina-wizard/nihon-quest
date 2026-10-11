/** Data di oggi (YYYY-MM-DD) in un fuso orario. */
export const ymd = (tz: string, d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export const todayTokyo = () => ymd("Asia/Tokyo");
export const todayRome = () => ymd("Europe/Rome");

/** Mezzogiorno locale: evita che il fuso sposti la data. */
export const dt = (id: string) => new Date(id + "T12:00:00");

export const fmtDay = (id: string, o: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) =>
  id ? new Intl.DateTimeFormat("it-IT", o).format(dt(id)) : "";

export const fmtShort = (id: string) => fmtDay(id, { weekday: "short", day: "numeric", month: "short" });

export const daysBetween = (from: string, to: string) => Math.round((dt(to).getTime() - dt(from).getTime()) / 864e5);

export const yen = (n: number) => "¥" + Math.round(n).toLocaleString("it-IT");

export const eur = (n: number) =>
  "€" + (Math.round(n * 100) / 100).toLocaleString("it-IT", { minimumFractionDigits: n < 100 ? 2 : 0, maximumFractionDigits: 2 });

/** Legge numeri scritti all'italiana: "1.200", "12,50", "3 000". */
export function parseNum(v: string): number {
  const s = String(v).replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  return s === "" ? NaN : Number(s);
}

export const nowIso = () => new Date().toISOString();
