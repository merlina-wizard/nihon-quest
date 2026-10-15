/**
 * Biglietti: QR del file importato e foto delle prenotazioni, sempre cifrati su Firestore.
 *
 * Nel JSON da importare una prenotazione può avere `qr: [{ seat, code, image }]` con l'immagine in chiaro.
 * Prima di scrivere, `sealTickets` trasforma ogni QR in una foto cifrata (photos/{prenotazione}-qr{n})
 * e lascia nella prenotazione solo gli id. Il testo in chiaro non arriva mai al server.
 */
import { isSealed, seal, unseal } from "./vault";
import type { Booking, Photo } from "../types";

export interface QrEntry { seat?: string; code?: string; image: string }

/** Una prenotazione come può arrivare dal file: con i QR in chiaro. */
export type ImportBooking = Omit<Booking, "id"> & { qr?: QrEntry[] };

/** Il contenuto di una foto, una volta decifrata. */
export interface PhotoContent { img: string; label?: string; code?: string }

export const qrPhotoId = (bookingId: string, i: number) => `${bookingId}-qr${i + 1}`;

export const countTickets = (bookings: Record<string, ImportBooking>) =>
  Object.values(bookings || {}).reduce((n, b) => n + (b.qr?.length || 0), 0);

export async function sealPhoto(key: CryptoKey, c: PhotoContent): Promise<string> {
  return seal(key, JSON.stringify(c));
}

/** Contenuto di una foto: le vecchie in chiaro si leggono così come sono. */
export async function openPhoto(key: CryptoKey | null, p: Pick<Photo, "data">): Promise<PhotoContent | "locked"> {
  if (!isSealed(p.data)) return { img: p.data };
  if (!key) return "locked";
  return JSON.parse(await unseal(key, p.data)) as PhotoContent;
}

/**
 * Cifra i QR del file. Restituisce le prenotazioni senza `qr` (con gli id in `photos`)
 * e le foto cifrate da salvare. Le altre foto della prenotazione restano.
 */
export async function sealTickets(
  bookings: Record<string, ImportBooking>, key: CryptoKey, who?: string, at?: string,
): Promise<{ bookings: Record<string, Omit<Booking, "id">>; photos: Photo[] }> {
  const out: Record<string, Omit<Booking, "id">> = {};
  const photos: Photo[] = [];
  for (const [id, b] of Object.entries(bookings || {})) {
    const { qr, ...rest } = b;
    if (!qr?.length) { out[id] = rest; continue; }
    const ids: string[] = [];
    for (const [i, q] of qr.entries()) {
      if (!q?.image) continue;
      const pid = qrPhotoId(id, i);
      ids.push(pid);
      photos.push({
        id: pid, data: await sealPhoto(key, { img: q.image, label: q.seat, code: q.code }),
        w: 0, h: 0, enc: true, createdBy: who, createdAt: at,
      });
    }
    // I codici dei QR non devono restare in chiaro altrove (es. numeri dei pass nel campo Codice):
    // si leggono solo nel visore, dopo il PIN.
    const secrets = qr.map((q) => q?.code).filter((c): c is string => !!c && c.length >= 4);
    // Prima i QR, poi le eventuali foto già presenti (senza doppioni da un'importazione precedente).
    out[id] = {
      ...rest,
      code: redact(rest.code || "", secrets),
      details: redact(rest.details || "", secrets),
      photos: [...ids, ...(rest.photos || []).filter((p) => !ids.includes(p))],
    };
  }
  return { bookings: out, photos };
}

/** Toglie i codici segreti da un testo in chiaro; se resta solo punteggiatura diventa "🔒 nel biglietto". */
export function redact(text: string, secrets: string[]): string {
  let t = text;
  for (const c of secrets) t = t.split(c).join("🔒");
  return /^[\s·•,;:|/🔒-]*$/u.test(t) ? (t.includes("🔒") ? "🔒 nel biglietto" : t) : t;
}

/** Controllo finale prima di scrivere: nessun QR in chiaro deve arrivare a Firestore. */
export function assertNoPlainTickets(bookings: Record<string, ImportBooking>) {
  if (countTickets(bookings) > 0) throw new Error("biglietti in chiaro");
}
