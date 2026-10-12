import { useState } from "react";
import { Empty } from "../components/bits";
import { BTYPES } from "../lib/constants";
import { fmtShort } from "../lib/format";
import { mapsLink } from "../lib/geo";
import { local } from "../lib/storage";
import { CHECKLIST, EMERGENCY, PHRASES, TIPS } from "../content/kit";
import { useTrip } from "../store";
import { useUi } from "../ui";

type Seg = "pren" | "prima" | "frasi" | "sos" | "tips";
const SEGS: [Seg, string][] = [["pren", "Prenotazioni"], ["prima", "Prima di partire"], ["frasi", "Frasi"], ["sos", "Emergenze"], ["tips", "Consigli"]];

export function KitView() {
  const saved = local.get("kit") as Seg;
  const [seg, setSegState] = useState<Seg>(SEGS.some(([k]) => k === saved) ? saved : "pren");
  const setSeg = (s: Seg) => { local.set("kit", s); setSegState(s); };
  return (
    <>
      <div className="seg" role="tablist">
        {SEGS.map(([k, l]) => <button key={k} className="mchip" aria-pressed={seg === k} onClick={() => setSeg(k)}>{l}</button>)}
      </div>
      {seg === "pren" && <Bookings />}
      {seg === "prima" && <Checklist />}
      {seg === "frasi" && <Phrases />}
      {seg === "sos" && <Sos />}
      {seg === "tips" && <ul className="tips">{TIPS.map(([t, d]) => <li key={t}><b>{t}</b>{d}</li>)}</ul>}
    </>
  );
}

/** Checklist personale: le spunte restano su questo telefono. */
function Checklist() {
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(local.get("check") || "{}"); } catch { return {}; }
  });
  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    local.set("check", JSON.stringify(next));
  };
  const n = CHECKLIST.filter((c) => done[c.id]).length;
  return (
    <>
      <p className="hint" style={{ margin: 0 }}>{n} di {CHECKLIST.length} fatte. Le spunte restano solo su questo telefono: ognuno ha la sua lista.</p>
      <div className="tl">
        {CHECKLIST.map((c) => (
          <div key={c.id} className={`stop ${done[c.id] ? "isdone" : ""}`} style={{ gridTemplateColumns: "1fr 44px" }}>
            <div className="st-main"><span className="st-title">{c.title}</span><span className="muted" style={{ fontSize: 13 }}>{c.text}</span></div>
            <button className="check" aria-pressed={!!done[c.id]} aria-label={`Segna "${c.title}" come fatto`} onClick={() => toggle(c.id)}>{done[c.id] ? "✓" : ""}</button>
          </div>
        ))}
      </div>
    </>
  );
}

function copy(text: string, toast: (m: string) => void) {
  navigator.clipboard?.writeText(text).then(() => toast("Copiato: " + text), () => toast(text));
}

function Bookings() {
  const { bookings, toast } = useTrip();
  const { open } = useUi();
  const list = bookings.slice().sort((a, b) =>
    String(a.date || "9").localeCompare(String(b.date || "9")) || String(a.time || "").localeCompare(String(b.time || "")));
  return (
    <>
      <button className="btn primary block" onClick={() => open({ kind: "booking" })}>+ Aggiungi prenotazione</button>
      {list.length ? list.map((b) => {
        const t = BTYPES[b.type] || BTYPES.altro;
        const when = [b.date ? fmtShort(b.date) : "", b.time, b.endDate ? "→ " + fmtShort(b.endDate) : ""].filter(Boolean).join(" ");
        return (
          <article key={b.id} className="ticket" style={{ ["--tc" as string]: `var(--t-${t.color})` }}>
            <div className="l">
              <span className="kind">{t.icon} {t.label}</span>
              <b className="tt">{b.title}</b>
              {when && <span className="when num">{when}</span>}
              {b.details && <span className="det">{b.details}</span>}
              <div className="row" style={{ marginTop: 4 }}>
                {b.place && <a className="btn small" href={mapsLink({ place: b.place })} target="_blank" rel="noopener">Portami lì</a>}
                <button className="btn small ghost" onClick={() => open({ kind: "booking", id: b.id })}>Modifica</button>
              </div>
            </div>
            <div className="r">
              <span className="eyebrow">Codice</span>
              {b.code ? (
                <><span className="code">{b.code}</span><button className="btn small" onClick={() => copy(b.code, toast)}>Copia</button></>
              ) : <span className="muted" style={{ fontSize: 12, textAlign: "center" }}>da aggiungere</span>}
            </div>
          </article>
        );
      }) : <Empty title="Nessuna prenotazione salvata.">Aggiungete voli, hotel e biglietti con i codici.</Empty>}
    </>
  );
}

function Phrases() {
  const { open } = useUi();
  return (
    <>
      {PHRASES.map(([g, ps], gi) => (
        <div key={g} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="daylabel">{g}</div>
          {ps.map((p, pi) => (
            <button key={pi} className="phrase" onClick={() => open({ kind: "phrase", group: gi, index: pi })}>
              <span className="it">{p[0]}</span><span className="jp" lang="ja">{p[1]}</span><span className="ro">{p[2]}</span><span className="go">Mostra</span>
            </button>
          ))}
        </div>
      ))}
    </>
  );
}

function Sos() {
  const { toast } = useTrip();
  return (
    <>
      {EMERGENCY.map((e) => (
        <div key={e.number} className="card emg">
          {e.number.length <= 4 && <span className="nr num">{e.number}</span>}
          <div className="t">
            <b>{e.title}</b><br />
            {e.number.length > 4 && <span className="code" style={{ textAlign: "left", display: "block" }}>{e.number}</span>}
            <span className="muted">{e.text}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <a className="btn small" href={`tel:${e.number.replace(/[^+\d]/g, "")}`}>Chiama</a>
            <button className="btn small ghost" onClick={() => copy(e.number, toast)}>Copia</button>
          </div>
        </div>
      ))}
      <p className="hint">Prima di partire registrate il viaggio su "Dove siamo nel mondo" della Farnesina.</p>
    </>
  );
}
