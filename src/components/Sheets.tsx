import { useEffect, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from "react";
import { Avatar, ConfirmButton, EditDiff, Linked, TypeBadge, VoteControls } from "./bits";
import { BTYPES, DEFAULT_RATE, ECATS, TYPES, typeOf } from "../lib/constants";
import { fmtDay, fmtShort, nowIso, parseNum, todayTokyo } from "../lib/format";
import { geocode, hasPos, mapsLink, parseCoords } from "../lib/geo";
import {
  clearCollections, exportAll, importAll, ITINERARY_COLLS, newId, removeDoc, removeWithPhotos, replaceItinerary,
  restoreWithPhotos, saveBooking, saveDay, saveExpense, saveMeta, saveStop, type ExportFile,
} from "../lib/db";
import { newProposal } from "../lib/votes";
import { fetchRate } from "../lib/money";
import { speakJa, useJaVoice, useWakeLock } from "../lib/device";
import { useVote } from "../views/VotesView";
import { useToggleDone, useTrip } from "../store";
import { PhotoField, usePhotoDraft } from "./Photos";
import { useUi, type SheetState } from "../ui";
import { TRAVELERS, type Booking, type BookingType, type Expense, type Photo, type Proposal, type Stop, type StopType, type Traveler } from "../types";

export function SheetHost({ sheet }: { sheet: SheetState }) {
  const { close } = useUi();
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [sheet, close]);
  // Trascinando la maniglia verso il basso il pannello si chiude.
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* puntatore già rilasciato */ }
    drag.current = { y: e.clientY, dy: 0 };
    if (panel.current) panel.current.style.transition = "none";
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !panel.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    panel.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onUp = () => {
    const dy = drag.current?.dy ?? 0;
    drag.current = null;
    if (dy > 90) { close(); return; }
    if (panel.current) { panel.current.style.transition = ""; panel.current.style.transform = ""; }
  };
  if (!sheet) return null;
  return (
    <div className="sheet">
      <button className="sheet-bg" aria-label="Chiudi" onClick={close} />
      <div className="sheet-panel" role="dialog" aria-modal="true" ref={panel}>
        <div className="grab-zone" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden="true"><div className="grab" /></div>
        <SheetBody sheet={sheet} />
      </div>
    </div>
  );
}

function SheetBody({ sheet }: { sheet: NonNullable<SheetState> }) {
  switch (sheet.kind) {
    case "stop": return <StopDetail id={sheet.id} />;
    case "stopForm": return <StopForm id={sheet.id} dayId={sheet.dayId} />;
    case "schedule": return <ScheduleForm id={sheet.id} />;
    case "day": return <DayForm id={sheet.id} />;
    case "expense": return <ExpenseForm id={sheet.id} />;
    case "booking": return <BookingForm id={sheet.id} />;
    case "settings": return <Settings />;
    case "big": return <BigText title={sheet.title} jp={sheet.jp} sub={sheet.sub} />;
  }
}

const Title = ({ children }: { children: ReactNode }) => <div className="sh-title"><h3>{children}</h3></div>;
const Err = ({ msg }: { msg: string | null }) => (msg ? <p className="err">{msg}</p> : null);

/* ---------------- Dettaglio tappa ---------------- */
function StopDetail({ id }: { id: string }) {
  const { stops, days, code, me, run, toast } = useTrip();
  const { open, close } = useUi();
  const doVote = useVote();
  const toggleDone = useToggleDone();
  const [busy, setBusy] = useState(false);
  const s = stops.find((x) => x.id === id);
  useEffect(() => { if (!s) close(); }, [s, close]);
  if (!s) return null;
  const t = TYPES[typeOf(s.type)];
  const prop = s.status === "proposed";

  const findPos = async () => {
    setBusy(true);
    try {
      const city = days.find((d) => d.id === s.dayId)?.city.split(/[·,]/)[0] || "";
      const r = (await geocode([s.place || s.title, city].filter(Boolean).join(", "))) || (s.place ? await geocode(s.title) : null);
      if (!r) { toast("Non l'ho trovato: incolla un link di Google Maps in Modifica."); return; }
      await run(() => saveStop(code, { ...s, lat: r.lat, lng: r.lng, updatedBy: me || undefined, updatedAt: nowIso() }), "Posizione trovata: controllala con Portami lì.");
    } catch { toast("Ricerca non riuscita, riprova tra poco."); }
    finally { setBusy(false); }
  };

  const proposeDelete = () => {
    if (!me) return;
    if (s.status === "idea") { run(() => removeDoc(code, "stops", s.id), "Idea eliminata.", () => saveStop(code, s)).then((ok) => ok && close()); return; }
    run(() => saveStop(code, { ...s, pendingEdit: newProposal(me, { remove: true }) }), "Proposta inviata: serve un altro sì.");
  };

  return (
    <>
      <div className="sh-title">
        <TypeBadge type={s.type} size={42} />
        <div style={{ minWidth: 0 }}><span className="eyebrow">{t.label}</span><h3>{s.title}</h3></div>
      </div>
      <div className="sh-body">
        <dl className="kv">
          <dt>Quando</dt><dd>{s.dayId ? fmtDay(s.dayId) : "Wishlist, senza giorno"}{s.time ? ` · ore ${s.time}` : ""}</dd>
          {s.place && <><dt>Dove</dt><dd>{s.place}</dd></>}
          <dt>Mappa</dt><dd>{hasPos(s) ? <>Sulla mappa <span className="muted num">({s.lat!.toFixed(4)}, {s.lng!.toFixed(4)})</span></> : "Non sulla mappa: Portami lì cerca per nome"}</dd>
          {s.url && <><dt>Link</dt><dd><a href={s.url} target="_blank" rel="noopener">{s.url.replace(/^https?:\/\//, "").slice(0, 40)}</a></dd></>}
        </dl>
        {s.notes && <div className="notes"><Linked text={s.notes} /></div>}
        {prop && <><div className="diff"><b>Proposta di {s.proposal?.by}: entra nel programma con 2 sì su 3.</b></div><VoteControls stop={s} onVote={(c) => doVote(s, c)} /></>}
        {s.pendingEdit && <><div className="eyebrow">Modifica proposta da {s.pendingEdit.by}</div><EditDiff stop={s} /><VoteControls stop={s} onVote={(c) => doVote(s, c)} /></>}
        <div className="actions">
          <a className="btn primary wide" href={mapsLink(s)} target="_blank" rel="noopener">Portami lì</a>
          {!prop && s.dayId && (
            <button className="btn" onClick={() => toggleDone(s)}>{s.done ? "Da rifare" : "✓ Fatta"}</button>
          )}
          {!s.pendingEdit && <button className="btn" onClick={() => open({ kind: "stopForm", id: s.id })}>Modifica</button>}
          {!hasPos(s) && <button className="btn" disabled={busy} onClick={findPos}>{busy ? "Cerco…" : "📍 Trova posizione"}</button>}
          {!s.pendingEdit && !prop && (
            <ConfirmButton className="btn no" label={s.status === "idea" ? "Elimina" : "Proponi di togliere"}
              confirmLabel={s.status === "idea" ? "Tocca di nuovo per eliminare" : "Tocca di nuovo per proporlo"} onConfirm={proposeDelete} />
          )}
        </div>
        <p className="foot">{s.createdBy && `Aggiunta da ${s.createdBy}`}{s.updatedBy && ` · ultima modifica di ${s.updatedBy}`}</p>
      </div>
    </>
  );
}

/* ---------------- Nuova tappa / modifica ---------------- */
function StopForm({ id, dayId }: { id?: string; dayId?: string }) {
  const { stops, days, code, me, run } = useTrip();
  const { open, close } = useUi();
  const s = id ? stops.find((x) => x.id === id) : undefined;
  const [f, setF] = useState({
    title: s?.title || "", type: (s?.type || "cibo") as StopType, dayId: s ? s.dayId : dayId ?? "",
    time: s?.time || "", place: s?.place || "", pos: s && hasPos(s) ? `${s.lat}, ${s.lng}` : "",
    notes: s?.notes || "", url: s?.url || "",
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const isNew = !s;

  const hint = isNew
    ? f.dayId ? "Diventa una proposta: entra nel programma quando un'altra persona vota sì." : "Le idee in wishlist si salvano subito, senza voto."
    : s!.status === "ok" ? "Cambi a nome, giorno, ora, luogo o tipo vanno al voto. Note e link si salvano subito." : "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!me) return;
    const title = f.title.trim();
    if (!title) { setErr("Scrivi almeno il nome della tappa."); return; }
    let pos: { lat: number; lng: number } | null = null;
    if (f.pos.trim()) {
      pos = parseCoords(f.pos.trim());
      if (!pos) { setErr('Non trovo le coordinate in questo link. Usa il link lungo di Google Maps, oppure svuota il campo e usa "Trova posizione".'); return; }
    }
    const vals = { title, type: f.type, dayId: f.dayId, time: f.time, place: f.place.trim(), notes: f.notes.trim(), url: f.url.trim() };

    if (isNew) {
      const doc: Stop = {
        id: newId(), ...vals, ...(pos || {}), done: false, order: Date.now(), createdBy: me, createdAt: nowIso(),
        status: vals.dayId ? "proposed" : "idea",
        ...(vals.dayId ? { proposal: newProposal(me) } : {}),
      };
      if (await run(() => saveStop(code, doc), vals.dayId ? "Proposta inviata: serve un altro sì." : "Idea salvata in wishlist.")) close();
      return;
    }

    const cur = s!;
    const changes: NonNullable<Proposal["changes"]> = {};
    for (const k of ["title", "type", "dayId", "time", "place"] as const) {
      if ((cur[k] || "") !== (vals[k] || "")) (changes as Record<string, unknown>)[k] = vals[k];
    }
    if (pos && (cur.lat !== pos.lat || cur.lng !== pos.lng)) { changes.lat = pos.lat; changes.lng = pos.lng; }
    const hasChanges = Object.keys(changes).length > 0;
    const next: Stop = { ...cur, notes: vals.notes, url: vals.url, updatedBy: me, updatedAt: nowIso() };
    let needsVote = false;
    if (cur.status === "ok" && hasChanges) {
      needsVote = true;
      next.pendingEdit = newProposal(me, { changes });
    } else if (cur.status === "idea" && changes.dayId) {
      needsVote = true;
      const { dayId: d, time: _t, ...direct } = changes;
      Object.assign(next, direct);
      next.pendingEdit = newProposal(me, { changes: { dayId: d, time: vals.time } });
    } else Object.assign(next, changes);
    if (await run(() => saveStop(code, next), needsVote ? "Modifica proposta: serve un altro sì." : "Salvato.")) open({ kind: "stop", id: cur.id });
  };

  return (
    <>
      <Title>{isNew ? "Nuova tappa" : "Modifica tappa"}</Title>
      <form className="sh-body" onSubmit={submit} noValidate>
        <label className="f">Nome *<input className="inp" id="f_title" value={f.title} onChange={set("title")} maxLength={80} placeholder="Es. Pokémon Café" /></label>
        <div className="f" style={{ fontSize: 13, fontWeight: 800 }}>Tipo
          <div className="pick" style={{ marginTop: 5 }}>
            {Object.entries(TYPES).map(([k, t]) => (
              <span key={k}><input type="radio" name="type" id={"ty_" + k} checked={f.type === k} onChange={() => setF({ ...f, type: k as StopType })} /><label htmlFor={"ty_" + k}>{t.icon} {t.label}</label></span>
            ))}
          </div>
        </div>
        <div className="two">
          <label className="f">Giorno
            <select className="inp" id="f_day" value={f.dayId} onChange={set("dayId")}>
              <option value="">Wishlist (nessun giorno)</option>
              {days.map((d) => <option key={d.id} value={d.id}>{fmtShort(d.id)} · {d.city}</option>)}
            </select>
          </label>
          <label className="f">Ora<input className="inp" type="time" id="f_time" value={f.time} onChange={set("time")} /></label>
        </div>
        <label className="f">Luogo o indirizzo<input className="inp" id="f_place" value={f.place} onChange={set("place")} placeholder="Es. Nihonbashi Takashimaya, Tokyo" /></label>
        <label className="f">Posizione sulla mappa <small>Incolla un link di Google Maps o "lat, lng". Puoi anche lasciarlo vuoto e usare "Trova posizione" dopo.</small>
          <input className="inp" id="f_pos" value={f.pos} onChange={set("pos")} placeholder="https://www.google.com/maps/…@35.68,139.76" /></label>
        <label className="f">Note<textarea className="inp" id="f_notes" value={f.notes} onChange={set("notes")} placeholder="Orari, cosa ordinare, prenotazione…" /></label>
        <label className="f">Link utile<input className="inp" id="f_url" value={f.url} onChange={set("url")} inputMode="url" placeholder="Sito, biglietti…" /></label>
        {hint && <p className="hint">{hint}</p>}
        <Err msg={err} />
        <button className="btn primary block" type="submit">{isNew && f.dayId ? "Proponi la tappa" : "Salva"}</button>
      </form>
    </>
  );
}

/* ---------------- Idea → giorno ---------------- */
function ScheduleForm({ id }: { id: string }) {
  const { stops, days, code, me, run } = useTrip();
  const { close, day } = useUi();
  const s = stops.find((x) => x.id === id);
  const [dayId, setDayId] = useState(day || days[0]?.id || "");
  const [time, setTime] = useState("");
  if (!s) return null;
  return (
    <>
      <Title>Metti "{s.title}" in un giorno</Title>
      <form className="sh-body" onSubmit={async (e) => {
        e.preventDefault();
        if (!me) return;
        if (await run(() => saveStop(code, { ...s, pendingEdit: newProposal(me, { changes: { dayId, time } }) }), "Proposta inviata: serve un altro sì.")) close();
      }}>
        <div className="two">
          <label className="f">Giorno<select className="inp" id="sc_day" value={dayId} onChange={(e) => setDayId(e.target.value)}>
            {days.map((d) => <option key={d.id} value={d.id}>{fmtShort(d.id)} · {d.city}</option>)}
          </select></label>
          <label className="f">Ora<input className="inp" type="time" id="sc_time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
        <p className="hint">Diventa una proposta: entra nel programma quando un'altra persona vota sì.</p>
        <button className="btn primary block" type="submit">Proponi</button>
      </form>
    </>
  );
}

/* ---------------- Giorno ---------------- */
function DayForm({ id }: { id: string }) {
  const { days, code, me, run } = useTrip();
  const { close } = useUi();
  const d = days.find((x) => x.id === id);
  const [f, setF] = useState({ city: d?.city || "", title: d?.title || "", hotel: d?.hotel || "", hotelAddressJp: d?.hotelAddressJp || "", notes: d?.notes || "" });
  if (!d) return null;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <Title>{fmtDay(d.id)}</Title>
      <form className="sh-body" onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => saveDay(code, { ...d, ...f, updatedBy: me || undefined }), "Giorno aggiornato.")) close();
      }}>
        <div className="two">
          <label className="f">Città<input className="inp" id="d_city" value={f.city} onChange={set("city")} /></label>
          <label className="f">Titolo<input className="inp" id="d_title" value={f.title} onChange={set("title")} /></label>
        </div>
        <label className="f">Dove si dorme<input className="inp" id="d_hotel" value={f.hotel} onChange={set("hotel")} /></label>
        <label className="f">Indirizzo in giapponese <small>Per il tassista: copialo dalla conferma o dal sito dell'hotel.</small>
          <input className="inp" id="d_addr" lang="ja" value={f.hotelAddressJp} onChange={set("hotelAddressJp")} placeholder="東京都中央区日本橋…" /></label>
        <label className="f">Note del giorno<textarea className="inp" id="d_notes" value={f.notes} onChange={set("notes")} /></label>
        <button className="btn primary block" type="submit">Salva</button>
      </form>
    </>
  );
}

/* ---------------- Spesa ---------------- */
function ExpenseForm({ id }: { id?: string }) {
  const { expenses, code, me, run } = useTrip();
  const { close } = useUi();
  const e0 = id ? expenses.find((x) => x.id === id) : undefined;
  const settle = e0?.kind === "settle";
  const [f, setF] = useState({
    title: e0?.title || "", amount: e0 ? String(e0.amount) : "", currency: e0?.currency || "JPY",
    paidBy: (e0?.paidBy || me || "Marty") as Traveler, split: (e0?.split || [...TRAVELERS]) as Traveler[],
    cat: e0?.cat || "cibo", date: e0?.date || todayTokyo(),
  });
  const [err, setErr] = useState<string | null>(null);
  const photos = usePhotoDraft(e0?.photos);
  // Id fisso: se si tocca Salva due volte (o senza rete) non si crea una spesa doppia.
  const [docId] = useState(() => e0?.id || newId());

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const amount = parseNum(f.amount);
    const title = settle ? "Rimborso" : f.title.trim();
    if (!title) { setErr("Scrivi cosa avete pagato."); return; }
    if (!isFinite(amount) || amount <= 0) { setErr("Inserisci un importo maggiore di zero."); return; }
    if (!f.split.length) { setErr("Scegli almeno una persona tra cui dividere."); return; }
    const doc: Expense = {
      ...(e0 || { createdBy: me || undefined, createdAt: nowIso() }),
      id: docId, title, amount, currency: f.currency as Expense["currency"], paidBy: f.paidBy,
      split: f.split, cat: settle ? "altro" : f.cat, date: f.date, updatedBy: me || undefined, photos: photos.ids,
      ...(settle ? { kind: "settle" as const } : {}),
    };
    if (await run(() => saveExpense(code, doc), "Spesa salvata.")) { photos.commit(); close(); }
  };

  const remove = () => {
    if (!e0) return;
    let saved: Photo[] = [];
    run(async () => { saved = await removeWithPhotos(code, "expenses", e0); }, "Spesa eliminata.", () => restoreWithPhotos(code, "expenses", e0, saved))
      .then((ok) => ok && close());
  };

  return (
    <>
      <Title>{e0 ? (settle ? "Rimborso" : "Modifica spesa") : "Nuova spesa"}</Title>
      <form className="sh-body" onSubmit={submit} noValidate>
        {!settle && <label className="f">Cosa *<input className="inp" id="e_title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Es. Ramen da Gyumon" maxLength={60} /></label>}
        <div className="two">
          <label className="f">Importo *<input className="inp num" id="e_amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" /></label>
          <label className="f">Valuta<select className="inp" id="e_cur" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as Expense["currency"] })}>
            <option value="JPY">¥ yen</option><option value="EUR">€ euro</option>
          </select></label>
        </div>
        <div className="f" style={{ fontSize: 13, fontWeight: 800 }}>Ha pagato
          <div className="pick" style={{ marginTop: 5 }}>
            {TRAVELERS.map((n) => <span key={n}><input type="radio" name="paid" id={"pb_" + n} checked={f.paidBy === n} onChange={() => setF({ ...f, paidBy: n })} /><label htmlFor={"pb_" + n}>{n}</label></span>)}
          </div>
        </div>
        {!settle && (
          <>
            <div className="f" style={{ fontSize: 13, fontWeight: 800 }}>Da dividere tra
              <div className="pick" style={{ marginTop: 5 }}>
                {TRAVELERS.map((n) => (
                  <span key={n}><input type="checkbox" id={"sp_" + n} checked={f.split.includes(n)}
                    onChange={(e) => setF({ ...f, split: e.target.checked ? [...f.split, n] : f.split.filter((x) => x !== n) })} /><label htmlFor={"sp_" + n}>{n}</label></span>
                ))}
              </div>
            </div>
            <div className="f" style={{ fontSize: 13, fontWeight: 800 }}>Categoria
              <div className="pick" style={{ marginTop: 5 }}>
                {Object.entries(ECATS).map(([k, l]) => <span key={k}><input type="radio" name="cat" id={"ec_" + k} checked={f.cat === k} onChange={() => setF({ ...f, cat: k })} /><label htmlFor={"ec_" + k}>{l}</label></span>)}
              </div>
            </div>
          </>
        )}
        <label className="f">Data<input className="inp" type="date" id="e_date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        {!settle && <PhotoField draft={photos} label="Scontrino" hint="Facoltativo: fino a 3 foto." />}
        <Err msg={err} />
        <button className="btn primary block" type="submit" disabled={photos.busy}>Salva</button>
        {e0 && <ConfirmButton className="btn no block" label="Elimina" confirmLabel="Tocca di nuovo per eliminare" onConfirm={remove} />}
      </form>
    </>
  );
}

/* ---------------- Prenotazione ---------------- */
function BookingForm({ id }: { id?: string }) {
  const { bookings, code, me, run } = useTrip();
  const { close } = useUi();
  const b0 = id ? bookings.find((x) => x.id === id) : undefined;
  const [f, setF] = useState({
    type: (b0?.type || "biglietto") as BookingType, title: b0?.title || "", date: b0?.date || "", time: b0?.time || "",
    endDate: b0?.endDate || "", code: b0?.code || "", place: b0?.place || "", addressJp: b0?.addressJp || "", details: b0?.details || "",
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const photos = usePhotoDraft(b0?.photos);
  const [docId] = useState(() => b0?.id || newId());

  const remove = () => {
    if (!b0) return;
    let saved: Photo[] = [];
    run(async () => { saved = await removeWithPhotos(code, "bookings", b0); }, "Prenotazione eliminata.", () => restoreWithPhotos(code, "bookings", b0, saved))
      .then((ok) => ok && close());
  };

  return (
    <>
      <Title>{b0 ? "Modifica prenotazione" : "Nuova prenotazione"}</Title>
      <form className="sh-body" noValidate onSubmit={async (e) => {
        e.preventDefault();
        if (!f.title.trim()) { setErr("Dai un nome alla prenotazione."); return; }
        const doc: Booking = {
          ...(b0 || { createdBy: me || undefined, createdAt: nowIso() }),
          id: docId, ...f, title: f.title.trim(), code: f.code.trim(), updatedBy: me || undefined, photos: photos.ids,
        };
        if (await run(() => saveBooking(code, doc), "Prenotazione salvata.")) { photos.commit(); close(); }
      }}>
        <div className="f" style={{ fontSize: 13, fontWeight: 800 }}>Tipo
          <div className="pick" style={{ marginTop: 5 }}>
            {Object.entries(BTYPES).map(([k, t]) => <span key={k}><input type="radio" name="btype" id={"bt_" + k} checked={f.type === k} onChange={() => setF({ ...f, type: k as BookingType })} /><label htmlFor={"bt_" + k}>{t.icon} {t.label}</label></span>)}
          </div>
        </div>
        <label className="f">Nome *<input className="inp" id="b_title" value={f.title} onChange={set("title")} placeholder="Es. Pokémon Café Nihonbashi" /></label>
        <div className="two">
          <label className="f">Data<input className="inp" type="date" id="b_date" value={f.date} onChange={set("date")} /></label>
          <label className="f">Ora<input className="inp" type="time" id="b_time" value={f.time} onChange={set("time")} /></label>
        </div>
        <label className="f">Fino al <small>per hotel e pass di più giorni</small><input className="inp" type="date" id="b_end" value={f.endDate} onChange={set("endDate")} /></label>
        <label className="f">Codice di conferma<input className="inp" id="b_code" value={f.code} onChange={set("code")} autoCapitalize="characters" /></label>
        <label className="f">Luogo o indirizzo<input className="inp" id="b_place" value={f.place} onChange={set("place")} /></label>
        <label className="f">Indirizzo in giapponese <small>Facoltativo, da mostrare al tassista.</small>
          <input className="inp" id="b_addr" lang="ja" value={f.addressJp} onChange={set("addressJp")} /></label>
        <label className="f">Dettagli<textarea className="inp" id="b_details" value={f.details} onChange={set("details")} placeholder="Terminal, posti, cosa portare…" /></label>
        <PhotoField draft={photos} label="Biglietto o conferma" hint="Foto o screenshot del QR, fino a 3." />
        <Err msg={err} />
        <button className="btn primary block" type="submit" disabled={photos.busy}>Salva</button>
        {b0 && <ConfirmButton className="btn no block" label="Elimina" confirmLabel="Tocca di nuovo per eliminare" onConfirm={remove} />}
      </form>
    </>
  );
}

/* ---------------- Reset dell'itinerario ---------------- */
const RESET_WORD = "RESET";

/**
 * Due azioni distruttive, con conferma scritta:
 * - Sostituisci: svuota giorni, tappe e prenotazioni e importa un file al loro posto.
 * - Svuota: cancella giorni, tappe e prenotazioni.
 * Spese e cambio non vengono mai toccati.
 */
function ResetZone({ onBackup }: { onBackup: () => void }) {
  const { days, stops, bookings, code, run, toast } = useTrip();
  const [mode, setMode] = useState<null | "replace" | "clear">(null);
  const [file, setFile] = useState<{ name: string; data: ExportFile } | null>(null);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setMode(null); setFile(null); setWord(""); };
  const pick = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as ExportFile;
      if (!data || typeof data !== "object" || !data.days || !data.stops) throw new Error("formato");
      setFile({ name: f.name, data });
    } catch { toast("Questo file non sembra un export di Nihon Quest."); }
  };
  const go = async () => {
    setBusy(true);
    const ok = await run(async () => {
      if (mode === "replace" && file) {
        const r = await replaceItinerary(code, file.data);
        return `Itinerario sostituito: tolti ${r.removed} elementi, importati ${r.added}.`;
      }
      const n = await clearCollections(code, ITINERARY_COLLS);
      return `Itinerario svuotato: cancellati ${n} elementi.`;
    });
    setBusy(false);
    if (ok) reset();
  };

  const now = `${days.length} giorni, ${stops.length} tappe e idee, ${bookings.length} prenotazioni`;
  const ready = word.trim().toUpperCase() === RESET_WORD && (mode === "clear" || !!file);

  if (!mode) {
    return (
      <div className="actions">
        <button className="btn" onClick={() => setMode("replace")}>Sostituisci con un file</button>
        <button className="btn no" onClick={() => setMode("clear")}>Svuota itinerario</button>
      </div>
    );
  }
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, boxShadow: "none", borderColor: "var(--red)" }}>
      <b>{mode === "replace" ? "Sostituisci l'itinerario" : "Svuota l'itinerario"}</b>
      <p className="hint" style={{ margin: 0 }}>
        Vengono cancellati per tutti e tre: {now}. Spese e cambio restano. Prima conviene scaricare un backup.
      </p>
      <button className="btn small" onClick={onBackup}>Scarica backup</button>
      {mode === "replace" && (
        <label className="btn" style={{ cursor: "pointer" }}>
          {file ? `File: ${file.name}` : "Scegli il file JSON"}
          <input type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
        </label>
      )}
      {mode === "replace" && file && (
        <p className="hint" style={{ margin: 0 }}>
          Il file contiene {Object.keys(file.data.days).length} giorni, {Object.keys(file.data.stops).length} tappe e idee, {Object.keys(file.data.bookings || {}).length} prenotazioni.
        </p>
      )}
      <label className="f">Scrivi {RESET_WORD} per confermare
        <input className="inp" id="reset_word" autoCapitalize="characters" autoComplete="off" value={word} onChange={(e) => setWord(e.target.value)} />
      </label>
      <div className="actions">
        <button className="btn ghost" onClick={reset} disabled={busy}>Annulla</button>
        <button className="btn no" disabled={!ready || busy} onClick={go}>
          {busy ? "Un attimo…" : mode === "replace" ? "Sostituisci" : "Svuota"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Impostazioni ---------------- */
function Settings() {
  const { me, setMe, meta, code, run, toast, leave } = useTrip();
  const { close } = useUi();
  const [rate, setRate] = useState(String(meta.rate || DEFAULT_RATE));
  const [rateBusy, setRateBusy] = useState(false);
  const [budget, setBudget] = useState(meta.dailyBudget ? String(meta.dailyBudget) : "");
  const [busy, setBusy] = useState(false);

  const doImport = async (file: File) => {
    setBusy(true);
    try {
      const data = JSON.parse(await file.text()) as ExportFile;
      if (!data || typeof data !== "object" || !data.days || !data.stops) throw new Error("formato");
      await run(async () => { const n = await importAll(code, data); return `Importati ${n} elementi.`; });
    } catch { toast("Questo file non sembra un export di Nihon Quest."); }
    finally { setBusy(false); }
  };

  const doExport = async () => {
    const data = await exportAll(code);
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nihon-quest-backup-${todayTokyo()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <Title>Chi sei?</Title>
      <div className="sh-body">
        <div className="chars">
          {TRAVELERS.map((n) => (
            <button key={n} className="char" onClick={() => setMe(n)} style={me === n ? { background: "var(--yellow)", color: "var(--on-yellow)" } : undefined}>
              <Avatar name={n} />{n}
            </button>
          ))}
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const r = parseNum(rate);
          if (!isFinite(r) || r < 50 || r > 400) { toast("Inserisci un cambio plausibile, es. 177."); return; }
          const b = budget.trim() ? parseNum(budget) : 0;
          if (!isFinite(b) || b < 0) { toast("Il budget è un importo in yen, es. 15000."); return; }
          const next = { ...meta, rate: r, rateDate: r !== meta.rate ? todayTokyo() : meta.rateDate, dailyBudget: b || undefined, updatedBy: me || undefined };
          if (await run(() => saveMeta(code, next), "Impostazioni salvate.")) close();
        }}>
          <label className="f">Cambio: quanti yen per 1 euro<input className="inp num" id="r_rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
          <button className="btn small" type="button" disabled={rateBusy} style={{ marginTop: 8 }} onClick={async () => {
            setRateBusy(true);
            try { const r = await fetchRate(); setRate(String(Math.round(r * 10) / 10).replace(".", ",")); toast("Cambio di oggi inserito: ora salvalo."); }
            catch { toast("Non riesco a leggere il cambio: controlla la connessione."); }
            finally { setRateBusy(false); }
          }}>{rateBusy ? "Cerco…" : "Prendi il cambio di oggi"}</button>
          <p className="hint">Vale per tutti e tre{meta.rateDate ? `, ultimo aggiornamento ${fmtShort(meta.rateDate)}` : ""}.</p>
          <label className="f">Budget al giorno a persona, in yen <small>Facoltativo: nelle spese vedi quanto hai speso oggi rispetto al budget.</small>
            <input className="inp num" id="r_budget" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Es. 15000" /></label>
          <button className="btn block" type="submit" style={{ marginTop: 10 }}>Salva cambio e budget</button>
        </form>
        <div className="eyebrow">Dati del viaggio</div>
        <div className="actions">
          <label className="btn" style={{ cursor: "pointer" }}>
            {busy ? "Importo…" : "Importa JSON"}
            <input type="file" accept="application/json,.json" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) doImport(file); e.target.value = ""; }} />
          </label>
          <button className="btn" onClick={doExport}>Scarica backup</button>
        </div>
        <p className="hint">"Importa JSON" aggiunge o aggiorna gli elementi del file, senza cancellare gli altri. Il backup non contiene le foto di scontrini e biglietti.</p>
        <ResetZone onBackup={doExport} />
        <ConfirmButton className="btn ghost block" label="Esci da questo viaggio" confirmLabel="Tocca di nuovo per uscire" onConfirm={() => { close(); leave(); }} />
      </div>
    </>
  );
}

/** Testo giapponese grande da mostrare a qualcuno: lo schermo resta acceso e si può ascoltare. */
function BigText({ title, jp, sub }: { title: string; jp: string; sub?: string }) {
  const { close } = useUi();
  const voice = useJaVoice();
  useWakeLock();
  return (
    <div className="sh-body">
      <p className="muted" style={{ textAlign: "center", margin: 0 }}>{title}</p>
      <div className="bigjp" lang="ja">{jp}</div>
      {sub && <p style={{ textAlign: "center", margin: 0, fontWeight: 800 }}>{sub}</p>}
      <div className="actions">
        {voice && <button className="btn wide" onClick={() => speakJa(jp, voice)}>🔊 Ascolta</button>}
        <button className="btn wide" onClick={close}>Chiudi</button>
      </div>
    </div>
  );
}
