import type { BookingType, StopType } from "../types";

export const TYPES: Record<StopType, { label: string; icon: string }> = {
  tempio: { label: "Templi e santuari", icon: "⛩️" },
  cibo: { label: "Cibo", icon: "🍜" },
  anime: { label: "Anime e gaming", icon: "🎮" },
  shopping: { label: "Shopping", icon: "🛍️" },
  natura: { label: "Parchi e natura", icon: "🌿" },
  esperienza: { label: "Esperienza", icon: "✨" },
  hotel: { label: "Alloggio", icon: "🛏️" },
  trasporti: { label: "Spostamento", icon: "🚄" },
  altro: { label: "Altro", icon: "📍" },
};

export const typeOf = (t: string | undefined): StopType =>
  t && t in TYPES ? (t as StopType) : "altro";

export const CITIES = [
  { name: "Tokyo", lat: 35.6812, lng: 139.7671 },
  { name: "Kyoto", lat: 35.0116, lng: 135.7681 },
  { name: "Osaka", lat: 34.6937, lng: 135.5023 },
  { name: "Nara", lat: 34.6851, lng: 135.8048 },
] as const;

export const BTYPES: Record<BookingType, { label: string; icon: string; color: StopType }> = {
  volo: { label: "Volo", icon: "✈️", color: "hotel" },
  hotel: { label: "Alloggio", icon: "🛏️", color: "hotel" },
  biglietto: { label: "Biglietto", icon: "🎟️", color: "anime" },
  treno: { label: "Treno", icon: "🚄", color: "trasporti" },
  ristorante: { label: "Ristorante", icon: "🍣", color: "cibo" },
  esperienza: { label: "Esperienza", icon: "✨", color: "esperienza" },
  altro: { label: "Altro", icon: "📌", color: "altro" },
};

export const ECATS: Record<string, string> = {
  cibo: "🍜 Cibo",
  trasporti: "🚄 Trasporti",
  shopping: "🛍️ Shopping",
  biglietti: "🎟️ Biglietti",
  alloggio: "🛏️ Alloggio",
  altro: "📌 Altro",
};

export const DEFAULT_RATE = 177;
