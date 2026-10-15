import { describe, expect, it } from "vitest";
import { createVault, isSealed, openVault, seal, unseal } from "./vault";
import { countTickets, openPhoto, qrPhotoId, sealTickets, type ImportBooking } from "./tickets";

// Poche iterazioni nei test: la logica è la stessa, solo più veloce.
const ITER = 1000;

describe("cassaforte dei biglietti", () => {
  it("cifra e decifra con il PIN giusto", async () => {
    const { info, key } = await createVault("sakura-ninja-2026", ITER);
    const s = await seal(key, "QR segreto");
    expect(isSealed(s)).toBe(true);
    expect(s).not.toContain("QR segreto");
    expect(await unseal(key, s)).toBe("QR segreto");
    const again = await openVault("sakura-ninja-2026", info);
    expect(again).not.toBeNull();
    expect(await unseal(again!, s)).toBe("QR segreto");
  });
  it("rifiuta un PIN sbagliato", async () => {
    const { info } = await createVault("sakura-ninja-2026", ITER);
    expect(await openVault("sakura-ninja-2025", info)).toBeNull();
  });
  it("due cifrature dello stesso testo sono diverse", async () => {
    const { key } = await createVault("sakura-ninja-2026", ITER);
    expect(await seal(key, "x")).not.toBe(await seal(key, "x"));
  });
});

describe("biglietti dal file", () => {
  const bookings: Record<string, ImportBooking> = {
    usj: { type: "biglietto", title: "USJ", date: "2026-11-05", time: "", endDate: "", code: "", place: "", details: "",
      qr: [{ seat: "Studio Pass 1", code: "ABC", image: "data:image/png;base64,QUJD" }, { seat: "Studio Pass 2", code: "DEF", image: "data:image/png;base64,REVG" }],
      photos: ["vecchia"] },
    hotel: { type: "hotel", title: "Hotel", date: "", time: "", endDate: "", code: "", place: "", details: "" },
  };
  it("conta i QR", () => expect(countTickets(bookings)).toBe(2));
  it("li cifra e non lascia niente in chiaro", async () => {
    const { key } = await createVault("sakura-ninja-2026", ITER);
    const r = await sealTickets(bookings, key);
    expect(countTickets(r.bookings)).toBe(0);
    expect(JSON.stringify(r)).not.toContain("QUJD");
    expect(JSON.stringify(r)).not.toContain("ABC");
    expect(r.bookings.usj.photos).toEqual([qrPhotoId("usj", 0), qrPhotoId("usj", 1), "vecchia"]);
    expect(r.photos.every((p) => p.enc && isSealed(p.data))).toBe(true);
    expect(await openPhoto(key, r.photos[0])).toEqual({ img: "data:image/png;base64,QUJD", label: "Studio Pass 1", code: "ABC" });
    expect(await openPhoto(null, r.photos[0])).toBe("locked");
  });
  it("toglie i codici dei QR anche dai campi in chiaro", async () => {
    const { key } = await createVault("sakura-ninja-2026", ITER);
    const pass: Record<string, ImportBooking> = { pass: { ...bookings.hotel, code: "F111111 · F222222", details: "Pass F111111 per Marty", qr: [
      { seat: "1", code: "F111111", image: "data:image/png;base64,AAA" }, { seat: "2", code: "F222222", image: "data:image/png;base64,BBB" }] } };
    const r = await sealTickets(pass, key);
    expect(JSON.stringify(r)).not.toMatch(/F111111|F222222/);
    expect(r.bookings.pass.code).toBe("🔒 nel biglietto");
    expect(r.bookings.pass.details).toBe("Pass 🔒 per Marty");
  });
  it("le foto vecchie in chiaro si leggono comunque", async () => {
    expect(await openPhoto(null, { data: "data:image/jpeg;base64,xyz" })).toEqual({ img: "data:image/jpeg;base64,xyz" });
  });
});
