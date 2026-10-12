import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadPhoto, newId, removePhotos, savePhoto } from "../lib/db";
import { useWakeLock } from "../lib/device";
import { nowIso } from "../lib/format";
import { compressImage } from "../lib/image";
import { useTrip } from "../store";

export const MAX_PHOTOS = 3;

/** Foto già lette in questa sessione (id → data URL). */
const cache = new Map<string, string>();

/** I dati di una foto: undefined mentre carica, null se non è disponibile (offline e mai aperta). */
export function usePhoto(id: string): string | null | undefined {
  const { code } = useTrip();
  const [data, setData] = useState<string | null | undefined>(() => cache.get(id));
  useEffect(() => {
    const hit = cache.get(id);
    if (hit) { setData(hit); return; }
    let alive = true;
    setData(undefined);
    loadPhoto(code, id).then((p) => p?.data ?? null, () => null).then((d) => {
      if (d) cache.set(id, d);
      if (alive) setData(d);
    });
    return () => { alive = false; };
  }, [code, id]);
  return data;
}

/** Scarica in anticipo le foto (es. i biglietti di oggi e domani), così si aprono anche senza rete. */
export function preloadPhotos(code: string, ids: string[]) {
  for (const id of ids) {
    if (!cache.has(id)) loadPhoto(code, id).then((p) => { if (p) cache.set(id, p.data); }, () => {});
  }
}

/**
 * Foto di una spesa o prenotazione mentre la si modifica.
 * Le nuove si caricano subito; se si chiude il modulo senza salvare vengono cancellate.
 * Quelle già salvate e tolte si cancellano solo al salvataggio (`commit`).
 */
export function usePhotoDraft(initial: string[] = []) {
  const { code, me, toast } = useTrip();
  const [ids, setIds] = useState(initial);
  const [busy, setBusy] = useState(false);
  const fresh = useRef<string[]>([]);
  const dropped = useRef<string[]>([]);

  useEffect(() => () => {
    if (fresh.current.length) removePhotos(code, fresh.current).catch(() => {});
    fresh.current = [];
  }, [code]);

  const add = async (file: File) => {
    setBusy(true);
    try {
      const img = await compressImage(file);
      const id = newId();
      cache.set(id, img.data);
      // Non si aspetta il server: senza rete la foto resta in coda sul telefono.
      savePhoto(code, { id, ...img, createdBy: me || undefined, createdAt: nowIso() }).catch((e) => {
        console.warn(e);
        toast("Foto non salvata: controlla la connessione e riprova.");
      });
      fresh.current.push(id);
      setIds((x) => [...x, id]);
    } catch (e) {
      console.warn(e);
      toast(e instanceof Error && e.message === "formato" ? "Questo formato di foto non si apre qui: prova con uno screenshot." : "Non riesco a usare questa foto.");
    } finally { setBusy(false); }
  };

  const remove = (id: string) => {
    setIds((x) => x.filter((i) => i !== id));
    if (fresh.current.includes(id)) {
      fresh.current = fresh.current.filter((i) => i !== id);
      removePhotos(code, [id]).catch(() => {});
    } else dropped.current.push(id);
  };

  /** Da chiamare dopo aver salvato: le nuove foto restano, quelle tolte si cancellano. */
  const commit = () => {
    fresh.current = [];
    const d = dropped.current;
    dropped.current = [];
    if (d.length) removePhotos(code, d).catch(() => {});
  };

  return { ids, busy, add, remove, commit };
}

export type PhotoDraft = ReturnType<typeof usePhotoDraft>;

function Thumb({ id }: { id: string }) {
  const d = usePhoto(id);
  if (d) return <img src={d} alt="" />;
  return <span className="ph-miss">{d === undefined ? "…" : "Offline"}</span>;
}

/** Campo del modulo: miniature, "+ Foto" e ✕ per toglierne una. */
export function PhotoField({ draft, label, hint }: { draft: PhotoDraft; label: string; hint?: string }) {
  const [view, setView] = useState<number | null>(null);
  return (
    <div className="f" style={{ fontSize: 13, fontWeight: 800 }}>
      <span>{label} {hint && <small>{hint}</small>}</span>
      <div className="photos">
        {draft.ids.map((id, i) => (
          <div key={id} className="ph">
            <button type="button" className="ph-img plain" onClick={() => setView(i)} aria-label={`Apri la foto ${i + 1}`}><Thumb id={id} /></button>
            <button type="button" className="ph-x" onClick={() => draft.remove(id)} aria-label={`Togli la foto ${i + 1}`}>✕</button>
          </div>
        ))}
        {draft.ids.length < MAX_PHOTOS && (
          <label className={`ph-add ${draft.busy ? "busy" : ""}`}>
            {draft.busy ? "Riduco…" : "+ Foto"}
            <input type="file" accept="image/*" hidden disabled={draft.busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) draft.add(f); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {view !== null && <PhotoViewer ids={draft.ids} start={view} onClose={() => setView(null)} />}
    </div>
  );
}

function BigPhoto({ id }: { id: string }) {
  const d = usePhoto(id);
  if (d) return <img src={d} alt="" />;
  return <p className="ph-msg">{d === undefined ? "Carico la foto…" : "Foto non disponibile senza rete: aprila una volta quando sei online e resterà sul telefono."}</p>;
}

/**
 * Foto a tutto schermo, con zoom delle dita. Lo schermo resta acceso (QR all'ingresso).
 * Ha una sua voce nella cronologia: Indietro chiude la foto e lascia aperto il pannello sotto.
 */
export function PhotoViewer({ ids, start = 0, onClose }: { ids: string[]; start?: number; onClose: () => void }) {
  const [i, setI] = useState(Math.min(start, ids.length - 1));
  useWakeLock();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!history.state?.nqPhoto) history.pushState({ nqPhoto: true }, "");
    const onPop = () => { if (!history.state?.nqPhoto) closeRef.current(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("popstate", onPop); document.removeEventListener("keydown", onKey); };
  }, []);
  const close = () => { if (history.state?.nqPhoto) history.back(); else closeRef.current(); };
  if (!ids.length) return null;
  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Foto">
      <div className="viewer-img"><BigPhoto id={ids[i]} /></div>
      <div className="viewer-bar">
        {ids.length > 1 && <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Foto precedente">‹</button>}
        {ids.length > 1 && <span className="num">{i + 1} / {ids.length}</span>}
        {ids.length > 1 && <button className="btn" disabled={i === ids.length - 1} onClick={() => setI(i + 1)} aria-label="Foto successiva">›</button>}
        <button className="btn primary" onClick={close}>Chiudi</button>
      </div>
    </div>,
    document.body,
  );
}
