import { useEffect, useState } from "react";
import { copyText, DayStrip, Empty, Linked, taxiSheet, TypeBadge } from "../components/bits";
import { BTYPES } from "../lib/constants";
import { daysBetween, fmtDay, fmtShort, todayRome, todayTokyo } from "../lib/format";
import { hasPos, mapsLink } from "../lib/geo";
import { bookingsOn, fmtIn, nextUp, nowTokyoHM } from "../lib/today";
import { useWeather, wmo } from "../lib/weather";
import { dayStops, useToggleDone, useTrip } from "../store";
import { useUi } from "../ui";
import type { Booking, Day, Stop } from "../types";

/** Ridisegna ogni 30 secondi: per l'ora corrente e i minuti mancanti. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export function DaysView() {
  const { days, stops, loaded } = useTrip();
  const toggle = useToggleDone();
  const { day, setDay, open } = useUi();

  if (!loaded) return <Empty title="Carico il viaggio…" />;
  if (!days.length) return <Empty title="Il viaggio è vuoto.">Tocca il tuo nome in alto a destra → Importa JSON per caricare l'itinerario.</Empty>;

  const left = daysBetween(todayRome(), days[0].id);
  const d = days.find((x) => x.id === day) || days[0];
  const idx = days.findIndex((x) => x.id === d.id) + 1;
  const list = dayStops(stops, d.id);
  const ok = list.filter((s) => s.status === "ok");
  const done = ok.filter((s) => s.done).length;
  const pct = ok.length ? Math.round((done / ok.length) * 100) : 0;

  return (
    <>
      {left > 0 && (
        <div className="countdown"><b className="num">{left}</b><span>{left === 1 ? "giorno" : "giorni"} alla partenza.<br />Zaini pronti?</span></div>
      )}
      <NowCard days={days} />
      <DayStrip days={days} isSelected={(id) => id === d.id} onPick={setDay} />

      <section className="card dayhero">
        <div className="stage">
          <span className="lvl num">STAGE {String(idx).padStart(2, "0")} / {days.length}</span>
          <span className="chip">{d.city}</span>
        </div>
        <h2>{fmtDay(d.id)}</h2>
        {d.title && <div className="title">{d.title}</div>}
        <WeatherLine city={d.city} dayId={d.id} />
        {d.notes && <div className="daynote"><Linked text={d.notes} /></div>}
        {ok.length > 0 && (
          <div className="xp">
            <span>XP</span>
            <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + "%" }} /></div>
            <span className="num">{done}/{ok.length}</span>
          </div>
        )}
        {d.hotel && (
          <div className="hotel">
            <TypeBadge type="hotel" />
            <div className="t"><b>{d.hotel}</b><small>Si dorme qui</small></div>
            <div className="hotel-btns">
              <a className="btn small" href={mapsLink({ place: d.hotel })} target="_blank" rel="noopener">Portami lì</a>
              {d.hotelAddressJp && <button className="btn small" onClick={() => open(taxiSheet(d.hotel, d.hotelAddressJp!))}>🚕 Tassista</button>}
            </div>
          </div>
        )}
        <DayBookings dayId={d.id} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn small ghost" onClick={() => open({ kind: "day", id: d.id })}>Modifica giorno</button>
        </div>
      </section>

      <div className="section-h"><h2>Tappe</h2><span className="muted" style={{ fontSize: 13 }}>{ok.length} in programma</span></div>
      {list.length ? (
        <div className="tl">{list.map((s) => <StopRow key={s.id} s={s} onToggle={() => toggle(s)} />)}</div>
      ) : (
        <Empty title="Ancora nessuna tappa per questo giorno.">Proponine una: entra nel programma con 2 sì su 3.</Empty>
      )}
      <button className="add-btn" onClick={() => open({ kind: "stopForm", dayId: d.id })}>+ Proponi una tappa</button>
    </>
  );
}

/** In viaggio: la prossima tappa di oggi e la prossima prenotazione con orario. */
function NowCard({ days }: { days: Day[] }) {
  const { stops, bookings, toast } = useTrip();
  const { open } = useUi();
  const now = useClock();
  const today = todayTokyo();
  if (!days.some((x) => x.id === today)) return null;
  const hm = nowTokyoHM(now);
  const list = dayStops(stops, today);
  const n = nextUp(list, hm);
  const nb = bookingsOn(bookings, today).find((b) => b.date === today && b.time && b.time >= hm);
  return (
    <section className="card now" aria-label="Adesso">
      <div className="eyebrow">Adesso · <span className="num">{hm}</span></div>
      {n ? (
        <>
          <button className="now-main plain" onClick={() => open({ kind: "stop", id: n.stop.id })}>
            <TypeBadge type={n.stop.type} size={38} />
            <span className="t">
              <b>{n.stop.title}</b>
              <small>{n.stop.time ? <>ore <span className="num">{n.stop.time}</span>{n.inMin !== null && ` · ${fmtIn(n.inMin)}`}</> : "Prossima tappa"}{n.stop.place && ` · ${n.stop.place}`}</small>
            </span>
          </button>
          <a className="btn primary block" href={mapsLink(n.stop)} target="_blank" rel="noopener">Portami lì</a>
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {!list.some((s) => s.status === "ok") ? "Nessuna tappa in programma oggi."
            : list.every((s) => s.status !== "ok" || s.done) ? "Tappe di oggi completate. Bel lavoro!"
              : "Niente in programma nelle prossime ore. Spunta qui sotto le tappe già fatte."}
        </p>
      )}
      {nb && (
        <div className="now-book">
          <span aria-hidden="true">{(BTYPES[nb.type] || BTYPES.altro).icon}</span>
          <button className="t plain" onClick={() => open({ kind: "booking", id: nb.id })}><b>{nb.title}</b><small>ore <span className="num">{nb.time}</span>{nb.code && ` · ${nb.code}`}</small></button>
          {nb.code && <button className="btn small" onClick={() => copyText(nb.code, toast)}>Copia</button>}
        </div>
      )}
    </section>
  );
}

/** Previsioni per la città del giorno (disponibili da circa 16 giorni prima). */
function WeatherLine({ city, dayId }: { city: string; dayId: string }) {
  const w = useWeather(city, dayId);
  if (!w) return null;
  const { icon, label } = wmo(w.code);
  return (
    <div className="wx">
      <span aria-hidden="true">{icon}</span>
      <span>{label} · <b className="num">{Math.round(w.max)}°</b> / <span className="num">{Math.round(w.min)}°</span>{w.rain !== null && w.rain >= 10 && <> · pioggia <span className="num">{w.rain}%</span></>}</span>
    </div>
  );
}

/** Prenotazioni del giorno. Gli hotel compaiono solo il giorno del check-in e del check-out. */
function DayBookings({ dayId }: { dayId: string }) {
  const { bookings } = useTrip();
  const { open } = useUi();
  const list = bookingsOn(bookings, dayId).filter((b) => b.type !== "hotel" || b.date === dayId || b.endDate === dayId);
  if (!list.length) return null;
  const when = (b: Booking) =>
    b.date === dayId ? (b.time ? `ore ${b.time}` : b.endDate ? `fino a ${fmtShort(b.endDate)}` : "oggi")
      : b.endDate === dayId ? (b.type === "hotel" ? "check-out" : "ultimo giorno") : "in corso";
  return (
    <div className="dbooks">
      {list.map((b) => (
        <button key={b.id} className="dbook plain" onClick={() => open({ kind: "booking", id: b.id })}>
          <span className="ic" aria-hidden="true">{(BTYPES[b.type] || BTYPES.altro).icon}</span>
          <span className="t"><b>{b.title}</b><small className="num">{when(b)}{b.code && ` · ${b.code}`}</small></span>
        </button>
      ))}
    </div>
  );
}

function StopRow({ s, onToggle }: { s: Stop; onToggle: () => void }) {
  const { open } = useUi();
  const pending = s.status === "proposed";
  return (
    <div className={`stop ${pending ? "pending" : ""} ${s.done ? "isdone" : ""}`}>
      <div className="st-time num">{s.time || "—"}<TypeBadge type={s.type} /></div>
      <button className="st-main plain" onClick={() => open({ kind: "stop", id: s.id })}>
        <span className="st-title">{s.title}</span>
        {s.place && <span className="st-place">{s.place}</span>}
        <span className="st-chips">
          {pending && <span className="chip vote">In votazione {s.proposal?.yes.length ?? 1}/2</span>}
          {s.pendingEdit && <span className="chip vote">{s.pendingEdit.remove ? "Da eliminare?" : "Modifica proposta"}</span>}
          {!hasPos(s) && !s.place && <span className="chip">Senza posizione</span>}
        </span>
      </button>
      {pending ? <span /> : (
        <button className="check" aria-pressed={!!s.done} aria-label="Segna come fatta" onClick={onToggle}>{s.done ? "✓" : ""}</button>
      )}
    </div>
  );
}
