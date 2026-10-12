import { createContext, useContext } from "react";

/** Quale "bottom sheet" è aperto. */
export type SheetState =
  | { kind: "stop"; id: string }
  | { kind: "stopForm"; id?: string; dayId?: string }
  | { kind: "schedule"; id: string }
  | { kind: "day"; id: string }
  | { kind: "expense"; id?: string }
  | { kind: "booking"; id?: string }
  | { kind: "settings" }
  /** Testo giapponese a tutto schermo (frasi, indirizzo per il tassista). */
  | { kind: "big"; title: string; jp: string; sub?: string }
  | null;

export interface Ui {
  open: (s: SheetState) => void;
  close: () => void;
  /** Giorno selezionato (condiviso tra Giorni e Mappa). */
  day: string | null;
  setDay: (d: string) => void;
}

export const UiCtx = createContext<Ui | null>(null);

export function useUi(): Ui {
  const v = useContext(UiCtx);
  if (!v) throw new Error("useUi fuori da UiCtx");
  return v;
}
