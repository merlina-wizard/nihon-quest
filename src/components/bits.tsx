import { useEffect, useRef, type ReactNode } from "react";
import { TYPES, typeOf } from "../lib/constants";
import { fmtDay, todayTokyo, dt } from "../lib/format";
import { proposalOf } from "../lib/votes";
import { useTrip } from "../store";
import { TRAVELERS, type Day, type Stop, type Traveler } from "../types";
import { fmtShort } from "../lib/format";
import { hasPos } from "../lib/geo";

export function Avatar({ name, small }: { name?: string; small?: boolean }) {
  if (!name) return null;
  return <span className={`av ${name.toLowerCase()} ${small ? "sm" : ""}`} title={name}>{name[0]}</span>;
}

export function TypeBadge({ type, size }: { type?: string; size?: number }) {
  const t = typeOf(type);
  const style = size ? { width: size, height: size, fontSize: size / 2 } : undefined;
  return <span className={`tbadge type-${t}`} style={style} aria-hidden="true">{TYPES[t].icon}</span>;
}

/** Striscia orizzontale dei giorni. */
export function DayStrip({ days, isSelected, onPick }: { days: Day[]; isSelected: (id: string) => boolean; onPick: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const today = todayTokyo();
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
    // solo al primo render con i giorni caricati
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length]);
  return (
    <div className="strip" role="toolbar" aria-label="Giorni del viaggio" ref={ref}>
      {days.map((d) => (
        <button key={d.id} className={`dchip ${d.id === today ? "today" : ""}`} aria-pressed={isSelected(d.id)} onClick={() => onPick(d.id)}>
          <small>{fmtDay(d.id, { weekday: "short" })}</small>
          <b className="num">{dt(d.id).getDate()}</b>
          <span>{(d.city || "").split(/[·,/]/)[0].trim()}</span>
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><b>{title}</b>{children}</div>;
}

export function Voters({ stop }: { stop: Stop }) {
  const p = proposalOf(stop);
  if (!p) return null;
  return (
    <div className="voters">
      {TRAVELERS.map((n) => {
        const y = p.yes?.includes(n), no = p.no?.includes(n);
        return (
          <span key={n} className={`voter ${y ? "y" : no ? "n" : ""}`}>
            <Avatar name={n} small /><em>{y ? "sì" : no ? "no" : "…"}</em>
          </span>
        );
      })}
    </div>
  );
}

const FIELD_L: Record<string, string> = { title: "Nome", type: "Tipo", dayId: "Giorno", time: "Ora", place: "Luogo", lat: "Posizione" };

export function EditDiff({ stop }: { stop: Stop }) {
  const p = stop.pendingEdit;
  if (!p) return null;
  if (p.remove) return <div className="diff"><b>Proposta: eliminare questa tappa</b></div>;
  const ch = p.changes || {};
  const rows = Object.keys(ch).filter((f) => f !== "lng").map((f) => {
    let o: string = String((stop as unknown as Record<string, unknown>)[f] ?? "");
    let n: string = String((ch as Record<string, unknown>)[f] ?? "");
    if (f === "dayId") { o = o ? fmtShort(o) : "Wishlist"; n = n ? fmtShort(n) : "Wishlist"; }
    if (f === "type") { o = TYPES[typeOf(o)].label; n = TYPES[typeOf(n)].label; }
    if (f === "lat") { o = hasPos(stop) ? "impostata" : ""; n = "nuova posizione"; }
    return <div key={f}><b>{FIELD_L[f]}:</b> {o && <><s>{o}</s> → </>}{n || "—"}</div>;
  });
  return <div className="diff">{rows}</div>;
}

export function VoteControls({ stop, onVote }: { stop: Stop; onVote: (choice: "yes" | "no" | "withdraw") => void }) {
  const { me } = useTrip();
  const p = proposalOf(stop);
  if (!p || !me) return null;
  const mine = p.yes?.includes(me) ? "yes" : p.no?.includes(me) ? "no" : null;
  return (
    <>
      <Voters stop={stop} />
      <div className="actions">
        {p.by === me ? (
          <button className="btn small ghost wide" onClick={() => onVote("withdraw")}>Ritira la proposta</button>
        ) : (
          <>
            <button className="btn yes" disabled={mine === "yes"} onClick={() => onVote("yes")}>{mine === "yes" ? "Hai detto sì" : "👍 Sì"}</button>
            <button className="btn no" disabled={mine === "no"} onClick={() => onVote("no")}>{mine === "no" ? "Hai detto no" : "👎 No"}</button>
          </>
        )}
      </div>
    </>
  );
}

/** Pulsante con conferma integrata (al posto di confirm(), che sui telefoni è scomodo). */
export function ConfirmButton({ className, label, confirmLabel, onConfirm }: { className?: string; label: string; confirmLabel: string; onConfirm: () => void }) {
  const armed = useRef(false);
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        if (!armed.current) { armed.current = true; e.currentTarget.textContent = confirmLabel; return; }
        onConfirm();
      }}
    >{label}</button>
  );
}

export const isTraveler = (n: string | null | undefined): n is Traveler => !!n && (TRAVELERS as readonly string[]).includes(n);
