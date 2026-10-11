import { DayStrip, Empty, TypeBadge } from "../components/bits";
import { daysBetween, fmtDay, todayRome } from "../lib/format";
import { hasPos, mapsLink } from "../lib/geo";
import { saveStop } from "../lib/db";
import { dayStops, useTrip } from "../store";
import { useUi } from "../ui";
import type { Stop } from "../types";

export function DaysView() {
  const { days, stops, loaded, code, run, me } = useTrip();
  const { day, setDay, open } = useUi();

  if (!loaded) return <Empty title="Carico il viaggio…" />;
  if (!days.length) return <Empty title="Il viaggio è vuoto.">Importa i dati da Kit → Impostazioni, oppure aggiungi i giorni.</Empty>;

  const left = daysBetween(todayRome(), days[0].id);
  const d = days.find((x) => x.id === day) || days[0];
  const idx = days.findIndex((x) => x.id === d.id) + 1;
  const list = dayStops(stops, d.id);
  const ok = list.filter((s) => s.status === "ok");
  const done = ok.filter((s) => s.done).length;
  const pct = ok.length ? Math.round((done / ok.length) * 100) : 0;

  const toggle = (s: Stop) =>
    run(() => saveStop(code, { ...s, done: !s.done, updatedBy: me || undefined }));

  return (
    <>
      {left > 0 && (
        <div className="countdown"><b className="num">{left}</b><span>{left === 1 ? "giorno" : "giorni"} alla partenza.<br />Zaini pronti?</span></div>
      )}
      <DayStrip days={days} isSelected={(id) => id === d.id} onPick={setDay} />

      <section className="card dayhero">
        <div className="stage">
          <span className="lvl num">STAGE {String(idx).padStart(2, "0")} / {days.length}</span>
          <span className="chip">{d.city}</span>
        </div>
        <h2>{fmtDay(d.id)}</h2>
        {d.title && <div className="title">{d.title}</div>}
        {d.notes && <div className="daynote">{d.notes}</div>}
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
            <a className="btn small" href={mapsLink({ place: d.hotel })} target="_blank" rel="noopener">Portami lì</a>
          </div>
        )}
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
