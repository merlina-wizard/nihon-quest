import {
  collection, deleteDoc, doc, getDocs, onSnapshot, runTransaction, setDoc, writeBatch,
  type DocumentData, type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";
import { applyVote, type VoteChoice } from "./votes";
import type { Booking, Day, Expense, Stop, Traveler, TripMeta } from "../types";

/**
 * Tutti i dati di un viaggio stanno sotto trips/{codice}/…
 * Il codice segreto è la chiave: chi non lo conosce non può leggere né scrivere
 * (vedi firestore.rules, che vietano di elencare i viaggi).
 */
export type Coll = "days" | "stops" | "expenses" | "bookings" | "meta";

const col = (trip: string, c: Coll) => collection(getDb(), "trips", trip, c);
const ref = (trip: string, c: Coll, id: string) => doc(getDb(), "trips", trip, c, id);

export const newId = () => doc(collection(getDb(), "_ids")).id;

/** Rimuove id e campi undefined prima di scrivere. */
function clean<T extends { id?: string }>(o: T): DocumentData {
  const { id: _id, ...rest } = o;
  return JSON.parse(JSON.stringify(rest));
}

export function subscribe<T>(trip: string, c: Coll, cb: (rows: T[]) => void, onErr: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    col(trip, c),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)),
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
