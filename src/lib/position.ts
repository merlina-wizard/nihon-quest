import { useCallback, useState } from "react";
import type { LatLng } from "./geo";

/** Ultima posizione letta, condivisa tra Mappa e Wishlist (vale 5 minuti). */
let last: { pos: LatLng; at: number } | null = null;
const fresh = () => (last && Date.now() - last.at < 5 * 60 * 1000 ? last.pos : null);

/** Dove sono adesso. `locate()` chiede la posizione al telefono e la restituisce. */
export function useHere() {
  const [here, setHere] = useState<LatLng | null>(fresh);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const locate = useCallback((): Promise<LatLng | null> => {
    setErr(null);
    if (!navigator.geolocation) { setErr("Il telefono non condivide la posizione."); return Promise.resolve(null); }
    setBusy(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
          last = { pos, at: Date.now() };
          setHere(pos); setBusy(false); resolve(pos);
        },
        () => { setErr("Posizione non disponibile: controlla i permessi del browser."); setBusy(false); resolve(null); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  }, []);

  return { here, err, busy, locate };
}
