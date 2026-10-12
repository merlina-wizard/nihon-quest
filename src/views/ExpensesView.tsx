import { useState } from "react";
import { local } from "../lib/storage";
import { Avatar, ConfirmButton, Empty } from "../components/bits";
import { DEFAULT_RATE, ECATS } from "../lib/constants";
import { eur, fmtDay, nowIso, parseNum, todayTokyo, yen } from "../lib/format";
import { balances, shareOn, summary, toJPY } from "../lib/money";
import { newId, saveExpense } from "../lib/db";
import { useTrip } from "../store";
import { useUi } from "../ui";
import { TRAVELERS, type Expense } from "../types";

export function ExpensesView() {
  const { expenses, meta, me, code, run } = useTrip();
  const { open } = useUi();
  const rate = meta.rate || DEFAULT_RATE;
  const [cvY, setCvY] = useState("");
  const [cvE, setCvE] = useState("");
  const [seg, setSegState] = useState<"mov" | "sum">(() => (local.get("exp") === "sum" ? "sum" : "mov"));
  const setSeg = (v: "mov" | "sum") => { local.set("exp", v); setSegState(v); };
  const budget = meta.dailyBudget || 0;
  const today = me && budget ? shareOn(expenses, rate, me, todayTokyo()) : 0;

  const real = expenses.filter((e) => e.kind !== "settle");
  const total = real.reduce((t, e) => t + toJPY(e, rate), 0);
  const { spent, transfers } = balances(expenses, rate);
  const mine = me ? spent[me] : 0;

  const sorted = expenses.slice().sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || "")) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  let last: string | null = null;

  return (
    <>
      <div className="totals">
        <div className="tot hl"><small>Spesa del gruppo</small><b className="num">{yen(total)}</b><small className="num">{eur(total / rate)}</small></div>
        <div className="tot"><small>{me ? `La parte di ${me}` : "La tua parte"}</small><b className="num">{yen(mine)}</b><small className="num">{eur(mine / rate)}</small></div>
      </div>
      {me && budget > 0 && (
        <div className="budget">
          <span>Oggi hai speso <b className="num">{yen(today)}</b> di <span className="num">{yen(budget)}</span></span>
          <div className={`mbar ${today > budget ? "over" : ""}`} role="progressbar" aria-valuenow={Math.round(today)} aria-valuemin={0} aria-valuemax={budget}>
            <i style={{ width: Math.min(100, (today / budget) * 100) + "%" }} />
          </div>
        </div>
      )}
      <button className="btn primary block" onClick={() => open({ kind: "expense" })}>+ Aggiungi una spesa</button>
      <div className="seg" role="tablist">
        <button className="mchip" aria-pressed={seg === "mov"} onClick={() => setSeg("mov")}>Movimenti</button>
        <button className="mchip" aria-pressed={seg === "sum"} onClick={() => setSeg("sum")}>Riepilogo</button>
      </div>
      {seg === "sum" ? <Summary expenses={expenses} rate={rate} spent={spent} /> : <>

      <section className="card">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Per pareggiare i conti</div>
        {transfers.length ? transfers.map((t) => (
          <div className="settle" key={t.from + t.to}>
            <Avatar name={t.from} />
            <div className="t"><b className="num">{yen(t.amount)}</b> da {t.from} a {t.to} <span className="muted num">({eur(t.amount / rate)})</span></div>
            <ConfirmButton className="btn small" label="Saldato" confirmLabel="Confermi?" onConfirm={() =>
              run(() => saveExpense(code, {
                id: newId(), kind: "settle", title: "Rimborso", amount: t.amount, currency: "JPY",
                paidBy: t.from, split: [t.to], cat: "altro", date: todayTokyo(), createdBy: me || undefined, createdAt: nowIso(),
              }), "Conto pareggiato.")} />
          </div>
        )) : <p className="muted" style={{ margin: 0 }}>Tutti pari. Nessuno deve niente a nessuno.</p>}
      </section>

      <section className="card">
        <div className="eyebrow" style={{ marginBottom: 8 }}>Convertitore · 1 € = {rate} ¥</div>
        <div className="conv">
          <input className="inp num" id="cvY" inputMode="decimal" placeholder="¥ yen" aria-label="Yen" value={cvY}
            onChange={(e) => { setCvY(e.target.value); const v = parseNum(e.target.value); setCvE(isFinite(v) ? (v / rate).toFixed(2) : ""); }} />
          <span>⇄</span>
          <input className="inp num" id="cvE" inputMode="decimal" placeholder="€ euro" aria-label="Euro" value={cvE}
            onChange={(e) => { setCvE(e.target.value); const v = parseNum(e.target.value); setCvY(isFinite(v) ? String(Math.round(v * rate)) : ""); }} />
        </div>
      </section>

      <div className="section-h"><h2>Movimenti</h2><span className="muted num" style={{ fontSize: 13 }}>{real.length} spese</span></div>
      {sorted.length ? sorted.map((e) => {
        const header = e.date !== last ? (
          <div className="daylabel" key={"h" + e.id}>{e.date ? fmtDay(e.date, { weekday: "short", day: "numeric", month: "long" }) : "Senza data"}</div>
        ) : null;
        last = e.date;
        const a = toJPY(e, rate), settle = e.kind === "settle";
        const split = e.split?.length ? e.split : [...TRAVELERS];
        return [header,
          <button key={e.id} className={`exp ${settle ? "settled" : ""}`} onClick={() => open({ kind: "expense", id: e.id })}>
            <Avatar name={e.paidBy} />
            <span className="t">
              <b>{settle ? `Rimborso a ${split[0]}` : e.title}{!!e.photos?.length && <span aria-label="con scontrino"> 📎</span>}</b>
              <small>{settle ? `pagato da ${e.paidBy}` : `${ECATS[e.cat] || ""} · ${split.length === 3 ? "divisa in 3" : "tra " + split.join(", ")}`}</small>
            </span>
            <span className="a num">{e.currency === "EUR" ? eur(+e.amount) : yen(a)}<small>{e.currency === "EUR" ? yen(a) : eur(a / rate)}</small></span>
          </button>,
        ];
      }) : <Empty title="Nessuna spesa ancora.">Segna chi paga cena, biglietti o taxi: l'app calcola chi deve quanto a chi.</Empty>}
      </>}
    </>
  );
}

/** Colore di ogni categoria di spesa, dai token dei tipi di tappa. */
const CAT_COLOR: Record<string, string> = {
  cibo: "var(--t-cibo)", trasporti: "var(--t-trasporti)", shopping: "var(--t-shopping)",
  biglietti: "var(--t-anime)", alloggio: "var(--t-hotel)", altro: "var(--t-altro)",
};

function Summary({ expenses, rate, spent }: { expenses: Expense[]; rate: number; spent: Record<string, number> }) {
  const { total, byCat, byDay, avgPerDay } = summary(expenses, rate);
  if (!total) return <Empty title="Ancora niente da riassumere.">Il riepilogo si riempie con le spese.</Empty>;
  const maxCat = byCat[0]?.amount || 1, maxDay = Math.max(...byDay.map((d) => d.amount), 1);
  return (
    <>
      <section className="card">
        <div className="eyebrow" style={{ marginBottom: 8 }}>Per categoria</div>
        {byCat.map((c) => (
          <div key={c.cat} className="srow">
            <span className="l">{ECATS[c.cat] || c.cat}</span>
            <span className="v num">{yen(c.amount)} <small>{Math.round((c.amount / total) * 100)}%</small></span>
            <div className="mbar"><i style={{ width: (c.amount / maxCat) * 100 + "%", background: CAT_COLOR[c.cat] || "var(--t-altro)" }} /></div>
          </div>
        ))}
      </section>
      <section className="card">
        <div className="eyebrow" style={{ marginBottom: 8 }}>Per persona</div>
        {TRAVELERS.map((n) => (
          <div key={n} className="srow">
            <span className="l"><Avatar name={n} small /> {n}</span>
            <span className="v num">{yen(spent[n] || 0)} <small>{eur((spent[n] || 0) / rate)}</small></span>
          </div>
        ))}
      </section>
      <section className="card">
        <div className="eyebrow" style={{ marginBottom: 8 }}>Per giorno · media {yen(avgPerDay)} ({yen(avgPerDay / TRAVELERS.length)} a testa)</div>
        {byDay.map((d) => (
          <div key={d.date || "nd"} className="srow">
            <span className="l">{d.date ? fmtDay(d.date, { weekday: "short", day: "numeric", month: "short" }) : "Senza data"}</span>
            <span className="v num">{yen(d.amount)}</span>
            <div className="mbar"><i style={{ width: (d.amount / maxDay) * 100 + "%" }} /></div>
          </div>
        ))}
      </section>
    </>
  );
}
