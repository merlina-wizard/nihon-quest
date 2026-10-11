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
