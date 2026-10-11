import { describe, expect, it } from "vitest";
import { applyVote, newProposal } from "./votes";
import { balances } from "./money";
import { parseCoords, nearestCity } from "./geo";
import { parseNum } from "./format";
import type { Expense, Stop } from "../types";

const base: Omit<Stop, "id"> = {
  title: "Pokémon Café", type: "anime", dayId: "2026-11-09", time: "15:00", place: "", notes: "", url: "",
  status: "proposed", done: false, order: 1, proposal: newProposal("Marty"),
};

describe("voti", () => {
  it("una nuova tappa passa con il secondo sì", () => {
    const r = applyVote(base, "Ema", "yes");
    expect(r.kind).toBe("update");
    if (r.kind === "update") { expect(r.next.status).toBe("ok"); expect(r.next.proposal).toBeUndefined(); }
  });
  it("due no la bocciano", () => {
    const r1 = applyVote(base, "Ema", "no");
    if (r1.kind !== "update") throw new Error();
    expect(applyVote(r1.next, "Antonio", "no").kind).toBe("delete");
  });
  it("chi propone può ritirare", () => {
    expect(applyVote(base, "Marty", "withdraw").kind).toBe("delete");
  });
  it("una modifica approvata applica i cambi", () => {
    const ok: Omit<Stop, "id"> = { ...base, status: "ok", proposal: undefined, pendingEdit: newProposal("Ema", { changes: { time: "17:00" } }) };
    const r = applyVote(ok, "Antonio", "yes");
    if (r.kind !== "update") throw new Error();
    expect(r.next.time).toBe("17:00");
    expect(r.next.pendingEdit).toBeUndefined();
  });
  it("un'idea spostata in un giorno diventa ok", () => {
    const idea: Omit<Stop, "id"> = { ...base, status: "idea", dayId: "", proposal: undefined, pendingEdit: newProposal("Ema", { changes: { dayId: "2026-11-02", time: "" } }) };
    const r = applyVote(idea, "Marty", "yes");
    if (r.kind !== "update") throw new Error();
    expect(r.next.status).toBe("ok");
    expect(r.next.dayId).toBe("2026-11-02");
  });
});

describe("spese", () => {
  const e = (x: Partial<Expense>): Expense => ({ id: "x", title: "t", amount: 0, currency: "JPY", paidBy: "Marty", split: ["Marty", "Ema", "Antonio"], cat: "cibo", date: "", ...x });
  it("divide in tre e calcola chi deve a chi", () => {
    const { transfers } = balances([e({ amount: 3000 })], 177);
    expect(transfers).toEqual([{ from: "Ema", to: "Marty", amount: 1000 }, { from: "Antonio", to: "Marty", amount: 1000 }]);
  });
  it("un rimborso pareggia", () => {
    const { transfers } = balances([e({ amount: 3000 }), e({ kind: "settle", amount: 1000, paidBy: "Ema", split: ["Marty"] })], 177);
    expect(transfers).toEqual([{ from: "Antonio", to: "Marty", amount: 1000 }]);
  });
  it("converte gli euro", () => {
    const { spent } = balances([e({ amount: 30, currency: "EUR" })], 100);
    expect(Math.round(spent.Ema)).toBe(1000);
  });
});

describe("utilità", () => {
  it("legge le coordinate da un link di Google Maps", () => {
    expect(parseCoords("https://www.google.com/maps/place/x/@35.7148,139.7967,17z")).toEqual({ lat: 35.7148, lng: 139.7967 });
    expect(parseCoords("roma @41.9,12.5")).toBeNull();
  });
  it("trova la città più vicina", () => {
    expect(nearestCity({ lat: 34.9671, lng: 135.7727 })).toBe("Kyoto");
  });
  it("legge i numeri all'italiana", () => {
    expect(parseNum("1.200")).toBe(1200);
    expect(parseNum("12,50")).toBe(12.5);
  });
});
