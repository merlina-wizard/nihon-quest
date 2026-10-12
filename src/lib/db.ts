import {
  collection, deleteDoc, doc, getDoc, getDocFromCache, getDocs, onSnapshot, runTransaction, setDoc, writeBatch,
  type DocumentData, type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";
import { applyVote, type VoteChoice } from "./votes";
import type { Booking, Day, Expense, Photo, Stop, Traveler, TripMeta } from "../types";

/**
 * Tutti i dati di un viaggio stanno sotto trips/{codice}/…
 * Il codice segreto è la chiave: chi non lo conosce non può leggere né scrivere
 * (vedi firestore.rules, che vietano di elencare i viaggi).
 */
export type Coll = "days" | "stops" | "expenses" | "bookings" | "meta" | "photos";

const col = (trip: string, c: Coll) => collection(getDb(), "trips", trip, c);
const ref = (trip: string, c: Coll, id: string) => doc(getDb(), "trips", trip, c, id);

export const newId = () => doc(collection(getDb(), "_ids")).id;

/** Rimuove id e campi undefined prima di scrivere. */
function clean<T extends { id?: string }>(o: T): DocumentData {
  const { id: _id, ...rest } = o;
  return JSON.parse(JSON.stringify(rest));
}

/** Stato della sincronizzazione: `fromCache` = dati non confermati dal server, `pending` = modifiche in attesa. */
export interface SyncInfo { fromCache: boolean; pending: boolean }

export function subscribe<T>(
  trip: string, c: Coll, cb: (rows: T[], sync: SyncInfo) => void, onErr: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    col(trip, c),
    { includeMetadataChanges: true },
    (snap) => cb(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T),
      { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites },
    ),
    onErr,
  );
}

export const saveDoc = <T extends { id?: string }>(trip: string, c: Coll, id: string, data: T) =>
  setDoc(ref(trip, c, id), clean(data));

export const removeDoc = (trip: string, c: Coll, id: string) => deleteDoc(ref(trip, c, id));

export const saveStop = (trip: string, s: Stop) => saveDoc(trip, "stops", s.id, s);
export const saveDay = (trip: string, d: Day) => saveDoc(trip, "days", d.id, d);
export const saveExpense = (trip: string, e: Expense) => saveDoc(trip, "expenses", e.id, e);
export const saveBooking = (trip: string, b: Booking) => saveDoc(trip, "bookings", b.id, b);
export const saveMeta = (trip: string, m: TripMeta) => saveDoc(trip, "meta", "trip", m as TripMeta & { id?: string });

/* ---- Foto (scontrini, biglietti) ----
 * Stanno in photos/{id} e non hanno un listener: si leggono una alla volta quando servono.
 * Spese e prenotazioni tengono solo gli id in `photos`.
 */
export const savePhoto = (trip: string, p: Photo) => saveDoc(trip, "photos", p.id, p);

/** Le foto non cambiano mai: prima si guarda la cache locale (funziona offline), poi il server. */
export async function loadPhoto(trip: string, id: string): Promise<Photo | null> {
  const r = ref(trip, "photos", id);
  try {
    const c = await getDocFromCache(r);
    if (c.exists()) return { id, ...c.data() } as Photo;
  } catch { /* non in cache */ }
  const snap = await getDoc(r);
  return snap.exists() ? ({ id, ...snap.data() } as Photo) : null;
}

export async function removePhotos(trip: string, ids: string[]) {
  if (!ids.length) return;
  const b = writeBatch(getDb());
  for (const id of ids) b.delete(ref(trip, "photos", id));
  await b.commit();
}

type WithPhotos = (Expense | Booking) & { id: string };

/** Elimina una spesa o una prenotazione con le sue foto. Restituisce le foto tolte, per poterle rimettere. */
export async function removeWithPhotos(trip: string, c: "expenses" | "bookings", item: WithPhotos): Promise<Photo[]> {
  const ids = item.photos || [];
  const saved = (await Promise.all(ids.map((id) => loadPhoto(trip, id).catch(() => null)))).filter((p): p is Photo => !!p);
  const b = writeBatch(getDb());
  b.delete(ref(trip, c, item.id));
  for (const id of ids) b.delete(ref(trip, "photos", id));
  await b.commit();
  return saved;
}

/** "Annulla" dopo removeWithPhotos. */
export async function restoreWithPhotos(trip: string, c: "expenses" | "bookings", item: WithPhotos, photos: Photo[]) {
  const b = writeBatch(getDb());
  b.set(ref(trip, c, item.id), clean(item));
  for (const p of photos) b.set(ref(trip, "photos", p.id), clean(p));
  await b.commit();
}

/** Voto in transazione: se due persone votano insieme non si perde nessun voto. */
export async function vote(trip: string, stopId: string, me: Traveler, choice: VoteChoice): Promise<string | undefined> {
  const r = ref(trip, "stops", stopId);
  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(r);
    if (!snap.exists()) return undefined;
    const out = applyVote(snap.data() as Omit<Stop, "id">, me, choice);
    if (out.kind === "delete") { tx.delete(r); return out.message; }
    if (out.kind === "update") { tx.set(r, JSON.parse(JSON.stringify(out.next))); return out.message; }
    return undefined;
  });
}

/** Il viaggio è vuoto? (per proporre l'importazione al primo accesso) */
export async function isEmpty(trip: string): Promise<boolean> {
  const snap = await getDocs(col(trip, "days"));
  return snap.empty;
}

export interface ExportFile {
  version: 1;
  meta?: TripMeta;
  days: Record<string, Omit<Day, "id">>;
  stops: Record<string, Omit<Stop, "id">>;
  bookings: Record<string, Omit<Booking, "id">>;
  expenses: Record<string, Omit<Expense, "id">>;
}

/** Importa un file esportato (anche quello generato dalla prima versione su claude.ai). */
export async function importAll(trip: string, data: ExportFile): Promise<number> {
  const entries: [Coll, string, DocumentData][] = [];
  if (data.meta) entries.push(["meta", "trip", data.meta]);
  for (const c of ["days", "stops", "bookings", "expenses"] as const) {
    for (const [id, v] of Object.entries(data[c] || {})) entries.push([c, id, v as DocumentData]);
  }
  for (let i = 0; i < entries.length; i += 400) {
    const b = writeBatch(getDb());
    for (const [c, id, v] of entries.slice(i, i + 400)) b.set(ref(trip, c, id), JSON.parse(JSON.stringify(v)));
    await b.commit();
  }
  return entries.length;
}

/** Le collection dell'itinerario: quelle che il reset svuota. Spese e cambio restano. */
export const ITINERARY_COLLS = ["days", "stops", "bookings"] as const;

/**
 * Cancella tutti i documenti delle collection indicate, con le foto collegate
 * (tranne quelle in `keepPhotos`). Restituisce quanti elementi ha cancellato, foto escluse.
 */
export async function clearCollections(trip: string, colls: readonly Coll[], keepPhotos = new Set<string>()): Promise<number> {
  let n = 0;
  for (const c of colls) {
    const snap = await getDocs(col(trip, c));
    const refs = snap.docs.map((d) => d.ref);
    for (const d of snap.docs) {
      for (const id of (d.data().photos as string[] | undefined) || []) if (!keepPhotos.has(id)) refs.push(ref(trip, "photos", id));
    }
    for (let i = 0; i < refs.length; i += 400) {
      const b = writeBatch(getDb());
      for (const r of refs.slice(i, i + 400)) b.delete(r);
      await b.commit();
    }
    n += snap.docs.length;
  }
  return n;
}

/**
 * Sostituisce l'itinerario con quello del file: svuota giorni, tappe e prenotazioni, poi importa.
 * Spese e cambio non vengono toccati (le spese del file, se ci sono, si ignorano).
 */
export async function replaceItinerary(trip: string, data: ExportFile): Promise<{ removed: number; added: number }> {
  // Le foto delle prenotazioni che restano anche nel file non si cancellano.
  const keep = new Set(Object.values(data.bookings || {}).flatMap((b) => b.photos || []));
  const removed = await clearCollections(trip, ITINERARY_COLLS, keep);
  const added = await importAll(trip, { version: 1, days: data.days, stops: data.stops, bookings: data.bookings || {}, expenses: {} });
  return { removed, added };
}

/** Backup di tutto tranne le foto (resterebbe troppo pesante): spese e prenotazioni tengono gli id. */
export async function exportAll(trip: string): Promise<ExportFile> {
  const out: ExportFile = { version: 1, days: {}, stops: {}, bookings: {}, expenses: {} };
  for (const c of ["days", "stops", "bookings", "expenses"] as const) {
    const snap = await getDocs(col(trip, c));
    snap.forEach((d) => { (out[c] as Record<string, DocumentData>)[d.id] = d.data(); });
  }
  const meta = await getDocs(col(trip, "meta"));
  meta.forEach((d) => { if (d.id === "trip") out.meta = d.data() as TripMeta; });
  return out;
}
