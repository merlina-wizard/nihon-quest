import type { Proposal, Stop, Traveler } from "../types";
import { nowIso } from "./format";

export const VOTES_NEEDED = 2;

export const proposalOf = (s: Stop): Proposal | undefined =>
  s.status === "proposed" ? s.proposal : s.pendingEdit;

export type VoteChoice = "yes" | "no" | "withdraw";

/** Risultato di un voto: il nuovo documento, oppure null se la tappa va eliminata. */
export type VoteOutcome =
  | { kind: "update"; next: Omit<Stop, "id">; message?: string }
  | { kind: "delete"; message: string }
  | { kind: "noop" };

/**
 * Logica pura del voto (testata in votes.test.ts).
 * 2 sì → la proposta passa. 2 no, o il ritiro di chi l'ha fatta → la proposta cade.
 */
export function applyVote(stop: Omit<Stop, "id">, me: Traveler, choice: VoteChoice): VoteOutcome {
  const s: Omit<Stop, "id"> = JSON.parse(JSON.stringify(stop));
  const key = s.status === "proposed" ? "proposal" : "pendingEdit";
  const p = s[key];
  if (!p) return { kind: "noop" };

  const yes = (p.yes || []).filter((n) => n !== me);
  const no = (p.no || []).filter((n) => n !== me);
  if (choice === "yes") yes.push(me);
  if (choice === "no") no.push(me);
  p.yes = yes;
  p.no = no;

  const rejected = choice === "withdraw" || no.length >= VOTES_NEEDED;
  if (yes.length >= VOTES_NEEDED && !rejected) {
    if (key === "proposal") {
      delete s.proposal;
      s.status = "ok";
      return { kind: "update", next: s, message: "Approvata! La tappa è nel programma." };
    }
    delete s.pendingEdit;
    if (p.remove) return { kind: "delete", message: "Approvato: tappa tolta." };
    Object.assign(s, p.changes || {});
    if (s.status === "idea" && s.dayId) s.status = "ok";
    s.updatedBy = p.by;
    s.updatedAt = nowIso();
    return { kind: "update", next: s, message: "Approvata! Modifica applicata." };
  }
  if (rejected) {
    const msg = choice === "withdraw" ? "Proposta ritirata." : "Proposta bocciata.";
    if (key === "proposal") return { kind: "delete", message: msg };
    delete s.pendingEdit;
    return { kind: "update", next: s, message: msg };
  }
  return { kind: "update", next: s };
}

export const newProposal = (by: Traveler, extra: Partial<Proposal> = {}): Proposal => ({
  by, yes: [by], no: [], at: nowIso(), ...extra,
});
