import { TRAVELERS, type Expense, type Traveler } from "../types";

export const toJPY = (e: Pick<Expense, "amount" | "currency">, rate: number) =>
  (Number(e.amount) || 0) * (e.currency === "EUR" ? rate : 1);

export interface Transfer { from: Traveler; to: Traveler; amount: number }

/**
 * Saldi del gruppo in yen.
 * - spent: quanto ha "consumato" ciascuno (i rimborsi non contano).
 * - transfers: il minimo di passaggi per pareggiare i conti.
 */
export function balances(expenses: Expense[], rate: number) {
  const bal = Object.fromEntries(TRAVELERS.map((n) => [n, 0])) as Record<Traveler, number>;
  const spent = Object.fromEntries(TRAVELERS.map((n) => [n, 0])) as Record<Traveler, number>;
  for (const e of expenses) {
    const a = toJPY(e, rate);
    const split = (e.split?.length ? e.split : [...TRAVELERS]).filter((n) => TRAVELERS.includes(n));
    if (!split.length || !TRAVELERS.includes(e.paidBy)) continue;
    bal[e.paidBy] += a;
    for (const n of split) {
      bal[n] -= a / split.length;
      if (e.kind !== "settle") spent[n] += a / split.length;
    }
  }
  const debtors = TRAVELERS.filter((n) => bal[n] < -0.5).map((n) => ({ n, v: -bal[n] }));
  const creditors = TRAVELERS.filter((n) => bal[n] > 0.5).map((n) => ({ n, v: bal[n] }));
  const transfers: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const v = Math.min(debtors[i].v, creditors[j].v);
    if (v >= 1) transfers.push({ from: debtors[i].n, to: creditors[j].n, amount: Math.round(v) });
    debtors[i].v -= v;
    creditors[j].v -= v;
    if (debtors[i].v < 0.5) i++;
    if (creditors[j].v < 0.5) j++;
  }
  return { spent, transfers, balance: bal };
}

const shareOf = (e: Expense, rate: number) => toJPY(e, rate) / (e.split?.length ? e.split.length : TRAVELERS.length);
const splitOf = (e: Expense): Traveler[] => (e.split?.length ? e.split : [...TRAVELERS]);

/**
 * Riepilogo delle spese vere (i rimborsi non contano), in yen:
 * totale, per categoria (dalla più alta), per giorno (in ordine) e media per giorno con spese.
 */
export function summary(expenses: Expense[], rate: number) {
  const real = expenses.filter((e) => e.kind !== "settle");
  const cats: Record<string, number> = {}, days: Record<string, number> = {};
  let total = 0;
  for (const e of real) {
    const a = toJPY(e, rate);
    total += a;
    cats[e.cat || "altro"] = (cats[e.cat || "altro"] || 0) + a;
    days[e.date || ""] = (days[e.date || ""] || 0) + a;
  }
  const byCat = Object.entries(cats).map(([cat, amount]) => ({ cat, amount })).sort((a, b) => b.amount - a.amount);
  const byDay = Object.entries(days).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
  const dated = byDay.filter((d) => d.date).length;
  return { total, byCat, byDay, avgPerDay: dated ? byDay.filter((d) => d.date).reduce((t, d) => t + d.amount, 0) / dated : 0 };
}

/** La parte di una persona nelle spese di un giorno (per il budget giornaliero). */
export const shareOn = (expenses: Expense[], rate: number, who: Traveler, date: string) =>
  expenses.filter((e) => e.kind !== "settle" && e.date === date && splitOf(e).includes(who)).reduce((t, e) => t + shareOf(e, rate), 0);

/** Cambio euro → yen di oggi (Banca Centrale Europea, via Frankfurter). */
export async function fetchRate(): Promise<number> {
  const r = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=JPY");
  if (!r.ok) throw new Error("cambio " + r.status);
  const j = (await r.json()) as { rates?: { JPY?: number } };
  if (!j.rates?.JPY) throw new Error("cambio assente");
  return j.rates.JPY;
}
