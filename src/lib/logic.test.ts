import { describe, expect, it } from "vitest";
import { applyVote, newProposal } from "./votes";
import { balances, shareOn, summary } from "./money";
import { distanceM, fmtDist, parseCoords, nearestCity } from "./geo";
import { parseNum } from "./format";
import { bookingsOn, fmtIn, nextUp, nowTokyoHM } from "./today";
import { cityOf, parseForecast, wmo } from "./weather";
import type { Booking, Expense, Stop } from "../types";

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
  it("riepiloga per categoria e per giorno, senza i rimborsi", () => {
    const list = [
      e({ amount: 3000, cat: "cibo", date: "2026-11-01" }),
      e({ amount: 10, currency: "EUR", cat: "trasporti", date: "2026-11-01" }),
      e({ amount: 1500, cat: "cibo", date: "2026-11-02" }),
      e({ kind: "settle", amount: 999, date: "2026-11-02" }),
    ];
    const r = summary(list, 100);
    expect(r.total).toBe(5500);
    expect(r.byCat).toEqual([{ cat: "cibo", amount: 4500 }, { cat: "trasporti", amount: 1000 }]);
    expect(r.byDay).toEqual([{ date: "2026-11-01", amount: 4000 }, { date: "2026-11-02", amount: 1500 }]);
    expect(r.avgPerDay).toBe(2750);
  });
  it("calcola la parte di una persona in un giorno", () => {
    const list = [e({ amount: 3000, date: "2026-11-01" }), e({ amount: 2000, date: "2026-11-01", split: ["Ema", "Antonio"] }), e({ amount: 900, date: "2026-11-02" })];
    expect(shareOn(list, 177, "Marty", "2026-11-01")).toBe(1000);
    expect(shareOn(list, 177, "Ema", "2026-11-01")).toBe(2000);
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

describe("oggi", () => {
  const st = (x: Partial<Stop>): Stop => ({ ...base, id: "s", status: "ok", proposal: undefined, ...x });
  it("la prossima tappa è la prima non fatta", () => {
    const list = [st({ id: "a", time: "09:00", done: true }), st({ id: "b", time: "11:00" }), st({ id: "c", time: "15:00" })];
    expect(nextUp(list, "10:20")).toEqual({ stop: list[1], inMin: 40 });
  });
  it("ignora le proposte e segnala il ritardo", () => {
    const list = [st({ id: "a", time: "09:00", status: "proposed" }), st({ id: "b", time: "10:00" })];
    expect(nextUp(list, "10:15")?.inMin).toBe(-15);
    expect(nextUp([st({ done: true })], "10:00")).toBeNull();
    expect(nextUp([st({ time: "" })], "10:00")?.inMin).toBeNull();
  });
  it("salta le tappe passate da più di un'ora", () => {
    const list = [st({ id: "a", time: "09:00" }), st({ id: "b", time: "13:00" }), st({ id: "c", time: "" })];
    expect(nextUp(list, "11:30")?.stop.id).toBe("b");
    expect(nextUp(list, "14:30")?.stop.id).toBe("c");
    expect(nextUp(list.slice(0, 2), "14:30")).toBeNull();
  });
  it("scrive i minuti mancanti", () => {
    expect(fmtIn(40)).toBe("tra 40 min");
    expect(fmtIn(125)).toBe("tra 2 h 5 min");
    expect(fmtIn(-15)).toBe("15 min fa");
    expect(fmtIn(1)).toBe("adesso");
  });
  it("legge l'ora di Tokyo", () => {
    expect(nowTokyoHM(new Date("2026-11-03T01:05:00Z"))).toBe("10:05");
  });
  it("trova le prenotazioni del giorno, anche di più giorni", () => {
    const b = (x: Partial<Booking>): Booking => ({ id: "b", type: "biglietto", title: "", date: "", time: "", endDate: "", code: "", place: "", details: "", ...x });
    const list = [
      b({ id: "hotel", type: "hotel", date: "2026-11-01", endDate: "2026-11-05" }),
      b({ id: "cafe", date: "2026-11-03", time: "11:30" }),
      b({ id: "museo", date: "2026-11-03", time: "09:00" }),
      b({ id: "altro", date: "2026-11-04" }),
    ];
    expect(bookingsOn(list, "2026-11-03").map((x) => x.id)).toEqual(["museo", "cafe", "hotel"]);
    expect(bookingsOn(list, "2026-11-06")).toEqual([]);
  });
});

describe("distanze", () => {
  it("calcola la distanza tra due punti", () => {
    // Stazione di Tokyo → Shibuya: circa 6,4 km in linea d'aria
    const d = distanceM({ lat: 35.6812, lng: 139.7671 }, { lat: 35.658, lng: 139.7016 });
    expect(d).toBeGreaterThan(6000);
    expect(d).toBeLessThan(6800);
  });
  it("scrive le distanze", () => {
    expect(fmtDist(647)).toBe("650 m");
    expect(fmtDist(2345)).toBe("2,3 km");
    expect(fmtDist(27400)).toBe("27 km");
  });
});

describe("meteo", () => {
  it("riconosce la città del giorno", () => {
    expect(cityOf("Kyoto · Nara")?.name).toBe("Kyoto");
    expect(cityOf("Tokyo → Kyoto")?.name).toBe("Tokyo");
    expect(cityOf("Hakone")).toBeUndefined();
  });
  it("traduce i codici meteo", () => {
    expect(wmo(0).label).toBe("Sereno");
    expect(wmo(63).icon).toBe("🌧️");
    expect(wmo(96).label).toBe("Temporale");
  });
  it("legge le previsioni giorno per giorno", () => {
    const r = parseForecast({ daily: { time: ["2026-11-01", "2026-11-02"], weather_code: [1, 61], temperature_2m_max: [20.4, 18], temperature_2m_min: [12, 11], precipitation_probability_max: [5, null] } });
    expect(r["2026-11-01"]).toEqual({ code: 1, max: 20.4, min: 12, rain: 5 });
    expect(r["2026-11-02"].rain).toBeNull();
  });
});
