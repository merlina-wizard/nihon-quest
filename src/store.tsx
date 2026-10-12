import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { saveStop, subscribe } from "./lib/db";
import { nowIso } from "./lib/format";
import { DEFAULT_RATE } from "./lib/constants";
import { local } from "./lib/storage";
import { TRAVELERS, type Booking, type Day, type Expense, type Stop, type Traveler, type TripMeta } from "./types";

interface TripState {
  code: string;
  me: Traveler | null;
  setMe: (t: Traveler) => void;
  leave: () => void;
  days: Day[];
  stops: Stop[];
  expenses: Expense[];
  bookings: Booking[];
  meta: TripMeta;
  loaded: boolean;
  error: string | null;
  /** Il server ha confermato i dati e non ci sono modifiche in attesa. */
  synced: boolean;
  /** Il server non risponde da più di 12 secondi. */
  slow: boolean;
  toast: (msg: string, action?: ToastAction) => void;
  /**
   * Esegue una scrittura e mostra un messaggio; restituisce false se fallisce.
   * Con `undo` il messaggio ha il pulsante "Annulla", che esegue `undo`.
   */
  run: (fn: () => Promise<unknown>, ok?: string, undo?: () => Promise<unknown>) => Promise<boolean>;
}

/** Dopo quanti millisecondi una scrittura senza risposta si considera in coda (offline). */
const OFFLINE_WAIT = 4000;

export interface ToastAction { label: string; fn: () => void }

const Ctx = createContext<TripState | null>(null);

export function useTrip(): TripState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTrip fuori da TripProvider");
  return v;
}

export function TripProvider({ code, onLeave, children }: { code: string; onLeave: () => void; children: ReactNode }) {
  const saved = local.get("me");
  const [me, setMeState] = useState<Traveler | null>(TRAVELERS.includes(saved as Traveler) ? (saved as Traveler) : null);
  const [days, setDays] = useState<Day[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meta, setMeta] = useState<TripMeta>({ rate: DEFAULT_RATE });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** true quando i dati sono confermati dal server e non ci sono modifiche in attesa. */
  const [synced, setSynced] = useState(false);
  const [slow, setSlow] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ msg: string; action?: ToastAction } | null>(null);
  const timer = useRef<number>();

  const toast = useCallback((msg: string, action?: ToastAction) => {
    setToastMsg({ msg, action });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(null), action ? 5000 : 2800);
  }, []);

  useEffect(() => {
    const onErr = (e: Error) => {
      console.warn(e);
      setError("Non riesco a leggere i dati. Controlla la connessione o il codice del viaggio.");
    };
    // Se dopo 12 secondi il server non ha ancora risposto, lo diciamo invece di restare su "Carico…".
    const slowTimer = window.setTimeout(() => setSlow(true), 12000);
    const offs = [
      subscribe<Day>(code, "days", (r, sync) => {
        setDays(r.sort((a, b) => a.id.localeCompare(b.id)));
        if (!sync.fromCache) { setLoaded(true); window.clearTimeout(slowTimer); setSlow(false); }
        else if (r.length) setLoaded(true);
        setSynced(!sync.fromCache && !sync.pending);
      }, onErr),
      subscribe<Stop>(code, "stops", setStops, onErr),
      subscribe<Expense>(code, "expenses", setExpenses, onErr),
      subscribe<Booking>(code, "bookings", setBookings, onErr),
      subscribe<TripMeta & { id: string }>(code, "meta", (r) => {
        const m = r.find((x) => x.id === "trip");
        setMeta({ rate: DEFAULT_RATE, ...(m || {}) });
      }, onErr),
    ];
    return () => { window.clearTimeout(slowTimer); offs.forEach((off) => off()); };
  }, [code]);

  const run = useCallback(async (fn: () => Promise<unknown>, ok?: string, undo?: () => Promise<unknown>): Promise<boolean> => {
    const done = (res: unknown) => {
      const msg = typeof res === "string" ? res : ok;
      if (msg) toast(msg, undo && { label: "Annulla", fn: () => { setToastMsg(null); run(undo, "Ripristinato."); } });
    };
    const fail = (e: unknown) => {
      console.warn(e);
      toast("Salvataggio non riuscito. Controlla la connessione e riprova.");
    };
    // Firestore conferma una scrittura solo quando arriva al server: senza rete la promessa resta in attesa,
    // ma la modifica è già nella cache del telefono e partirà da sola. Dopo qualche secondo si va avanti.
    const p = Promise.resolve().then(fn);
    const timeout = new Promise<"late">((r) => window.setTimeout(() => r("late"), OFFLINE_WAIT));
    try {
      const res = await Promise.race([p, timeout]);
      if (res !== "late") { done(res); return true; }
    } catch (e) { fail(e); return false; }
    toast("Salvato sul telefono: parte appena c'è rete.");
    p.then(done, fail);
    return true;
  }, [toast]);

  const value = useMemo<TripState>(() => ({
    code, me,
    setMe: (t) => { local.set("me", t); setMeState(t); },
    leave: () => { local.set("code", null); onLeave(); },
    days, stops, expenses, bookings, meta, loaded, error, synced, slow, toast, run,
  }), [code, me, days, stops, expenses, bookings, meta, loaded, error, synced, slow, toast, run, onLeave]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && (
        <div className={`toast ${toastMsg.action ? "with-action" : ""}`} role="status">
          <span>{toastMsg.msg}</span>
          {toastMsg.action && <button className="toast-btn" onClick={toastMsg.action.fn}>{toastMsg.action.label}</button>}
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Selettori comuni */
export const sortStops = (arr: Stop[]) =>
  arr.slice().sort((a, b) =>
    (a.time || "99:99").localeCompare(b.time || "99:99") || (a.order || 0) - (b.order || 0) ||
    String(a.createdAt || "").localeCompare(String(b.createdAt || "")));

export const dayStops = (stops: Stop[], dayId: string) => sortStops(stops.filter((s) => s.dayId === dayId && s.status !== "idea"));

export const ideasOf = (stops: Stop[]) =>
  stops.filter((s) => !s.dayId || s.status === "idea").sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

export const pendingsOf = (stops: Stop[]) => stops.filter((s) => s.status === "proposed" || s.pendingEdit);

/** Segna una tappa come fatta (o da rifare), firmando la modifica. */
export function useToggleDone() {
  const { code, me, run } = useTrip();
  return (s: Stop) => run(() => saveStop(code, { ...s, done: !s.done, updatedBy: me || undefined, updatedAt: nowIso() }));
}
