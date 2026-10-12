import { useState } from "react";
import { EditDiff, Empty, TypeBadge, VoteControls } from "../components/bits";
import { TYPES, typeOf } from "../lib/constants";
import { fmtShort } from "../lib/format";
import { distanceM, fmtDist, hasPos, mapsLink } from "../lib/geo";
import { useHere } from "../lib/position";
import { vote } from "../lib/db";
import { proposalOf, VOTES_NEEDED } from "../lib/votes";
import { ideasOf, pendingsOf, useTrip } from "../store";
import { useUi } from "../ui";
import type { Stop } from "../types";

export function useVote() {
  const { code, me, run } = useTrip();
  return (s: Stop, choice: "yes" | "no" | "withdraw") => {
    if (!me) return;
    run(() => vote(code, s.id, me, choice));
  };
}

export function VotesView() {
  const { stops } = useTrip();
  const { open } = useUi();
  const doVote = useVote();

  const pending = pendingsOf(stops).sort((a, b) => String(proposalOf(b)?.at || "").localeCompare(String(proposalOf(a)?.at || "")));
  const { here, err, busy, locate } = useHere();
  const [near, setNear] = useState(false);
  // "Più vicine a me": prima le idee con posizione, dalla più vicina; poi quelle senza.
  const dist = (s: Stop) => (here && hasPos(s) ? distanceM(here, s) : Infinity);
  const ideas = near && here ? ideasOf(stops).sort((a, b) => dist(a) - dist(b)) : ideasOf(stops);

  return (
    <>
      <div className="section-h"><h2>In votazione</h2><span className="muted" style={{ fontSize: 13 }}>{VOTES_NEEDED} sì su 3 e si parte</span></div>
      {pending.length ? pending.map((s) => {
        const p = proposalOf(s)!;
        const what = s.status === "proposed"
          ? `Nuova tappa · ${s.dayId ? fmtShort(s.dayId) : "Wishlist"}${s.time ? " · " + s.time : ""}`
          : p.remove ? "Eliminare la tappa" : "Modifica alla tappa";
        return (
          <article key={s.id} className="card vcard">
            <div className="vhead">
              <TypeBadge type={s.type} />
              <button className="t plain" onClick={() => open({ kind: "stop", id: s.id })}>
                <b>{s.title}</b><small>{what} · proposta da {p.by}</small>
              </button>
            </div>
            {s.pendingEdit && <EditDiff stop={s} />}
            <VoteControls stop={s} onVote={(c) => doVote(s, c)} />
          </article>
        );
      }) : <Empty title="Niente da votare.">Quando qualcuno propone una tappa o una modifica, la trovi qui.</Empty>}

      <div className="section-h"><h2>Wishlist</h2><span className="muted num" style={{ fontSize: 13 }}>{ideas.length} idee</span></div>
      <button className="add-btn" onClick={() => open({ kind: "stopForm", dayId: "" })}>+ Aggiungi un'idea</button>
      {ideas.length > 1 && (
        <button className="btn block" disabled={busy} aria-pressed={near}
          onClick={() => (near ? setNear(false) : locate().then((p) => p && setNear(true)))}>
          {busy ? "Cerco dove sei…" : near ? "Ordina per data" : "📍 Più vicine a me"}
        </button>
      )}
      {err && <p className="err">{err}</p>}
      {ideas.length ? ideas.map((s) => (
        <article key={s.id} className="card vcard">
          <div className="vhead">
            <TypeBadge type={s.type} />
            <button className="t plain" onClick={() => open({ kind: "stop", id: s.id })}>
              <b>{s.title}</b><small>{near && isFinite(dist(s)) && <span className="num">{fmtDist(dist(s))} · </span>}{s.place || TYPES[typeOf(s.type)].label}{s.createdBy ? ` · idea di ${s.createdBy}` : ""}</small>
            </button>
          </div>
          {s.pendingEdit ? (
            <span className="chip vote">In votazione{s.pendingEdit.changes?.dayId ? ` per ${fmtShort(s.pendingEdit.changes.dayId)}` : ""}</span>
          ) : (
            <div className="actions">
              <button className="btn small" onClick={() => open({ kind: "schedule", id: s.id })}>Metti in un giorno</button>
              <a className="btn small ghost" href={mapsLink(s)} target="_blank" rel="noopener">Portami lì</a>
            </div>
          )}
        </article>
      )) : <Empty title="La wishlist è vuota.">Salva qui i posti "se avanza tempo".</Empty>}
    </>
  );
}
