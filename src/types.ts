export const TRAVELERS = ["Marty", "Ema", "Antonio"] as const;
export type Traveler = (typeof TRAVELERS)[number];

export type StopType =
  | "tempio" | "cibo" | "anime" | "shopping" | "natura"
  | "esperienza" | "hotel" | "trasporti" | "altro";

/** Una votazione: chi propone conta già come primo sì. Servono 2 sì su 3. */
export interface Proposal {
  by: Traveler;
  yes: Traveler[];
  no: Traveler[];
  at: string;
  /** Solo per le modifiche: i campi che cambiano. */
  changes?: Partial<Pick<Stop, "title" | "type" | "dayId" | "time" | "place" | "lat" | "lng">>;
  /** Solo per le modifiche: proposta di eliminare la tappa. */
  remove?: boolean;
}

/**
 * Una tappa.
 * - status "ok": è nel programma del giorno `dayId`.
 * - status "proposed": tappa nuova in votazione (vedi `proposal`).
 * - status "idea": in wishlist, senza giorno (dayId "").
 * Una tappa "ok" o "idea" può avere una `pendingEdit` in votazione.
 */
export interface Stop {
  id: string;
  title: string;
  type: StopType;
  dayId: string;
  time: string;
  place: string;
  lat?: number;
  lng?: number;
  notes: string;
  url: string;
  status: "ok" | "proposed" | "idea";
  done: boolean;
  order: number;
  proposal?: Proposal;
  pendingEdit?: Proposal;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface Day {
  id: string; // YYYY-MM-DD
  city: string;
  title: string;
  hotel: string;
  /** Indirizzo dell'hotel in giapponese, da mostrare al tassista. */
  hotelAddressJp?: string;
  notes: string;
  updatedBy?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: "JPY" | "EUR";
  paidBy: Traveler;
  split: Traveler[];
  cat: string;
  date: string;
  /** "settle" = rimborso tra due persone per pareggiare i conti. */
  kind?: "settle";
  /** Id delle foto (scontrini) in photos/{id}. */
  photos?: string[];
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
}

export type BookingType = "volo" | "hotel" | "biglietto" | "treno" | "ristorante" | "esperienza" | "altro";

export interface Booking {
  id: string;
  type: BookingType;
  title: string;
  date: string;
  time: string;
  endDate: string;
  code: string;
  place: string;
  /** Indirizzo in giapponese, da mostrare al tassista. */
  addressJp?: string;
  details: string;
  /** Id delle foto (biglietti, QR, conferme) in photos/{id}. */
  photos?: string[];
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
}

export interface TripMeta {
  /** Quanti yen per 1 euro. */
  rate: number;
  rateDate?: string;
  /** Budget al giorno a persona, in yen (facoltativo). */
  dailyBudget?: number;
  /** Cassaforte dei biglietti: sale e controllo del PIN (il PIN non è mai salvato). */
  vault?: import("./lib/vault").VaultInfo;
  updatedBy?: string;
}

/** Una foto compressa (JPEG in base64), in photos/{id}. */
export interface Photo {
  id: string;
  /** JPEG/PNG in base64, oppure testo cifrato ("nqv1.…") per i biglietti: vedi lib/vault.ts. */
  data: string;
  /** true se `data` è cifrato con il PIN dei biglietti. */
  enc?: boolean;
  w: number;
  h: number;
  createdBy?: string;
  createdAt?: string;
}

export type Tab = "giorni" | "mappa" | "voti" | "spese" | "kit";
