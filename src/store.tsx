import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { subscribe } from "./lib/db";
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
  toast: (msg: string) => void;
  /** Esegue una scrittura e mostra un messaggio; restituisce false se fallisce. */
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;
}

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
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timer = useRef<number>();

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  useEffect(() => {
    const onErr = (e: Error) => {
      console.warn(e);
      setError("Non riesco a leggere i dati. Controlla la connessione o il codice del viaggio.");
    };
    const offs = [
      subscribe<Day>(code, "days", (r) => { setDays(r.sort((a, b) => a.id.localeCompare(b.id))); setLoaded(true); }, onErr),
      subscribe<Stop>(code, "stops", setStops, onErr),
      subscribe<Expense>(code, "expenses", setExpenses, onErr),
      subscribe<Booking>(code, "bookings", setBookings, onErr),
      subscribe<TripMeta & { id: string }>(code, "meta", (r) => {
        const m = r.find((x) => x.id === "trip");
        setMeta({ rate: DEFAULT_RATE, ...(m || {}) });
      }, onErr),
    ];
    return () => offs.forEach((off) => off());
  }, [code]);

  const run = useCallback(async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      const res = await fn();
      const msg = typeof res === "string" ? res : ok;
      if (msg) toast(msg);
      return true;
    } catch (e) {
      console.warn(e);
      toast("Salvataggio non riuscito. Controlla la connessione e riprova.");
      return false;
    }
  }, [toast]);

  const value = useMemo<TripState>(() => ({
    code, me,
    setMe: (t) => { local.set("me", t); setMeState(t); },
    leave: () => { local.set("code", null); onLeave(); },
    days, stops, expenses, bookings, meta, loaded, error, toast, run,
  }), [code, me, days, stops, expenses, bookings, meta, loaded, error, toast, run, onLeave]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
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
