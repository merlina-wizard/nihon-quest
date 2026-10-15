import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadPhoto, newId, removePhotos, savePhoto } from "../lib/db";
import { useWakeLock } from "../lib/device";
import { nowIso } from "../lib/format";
import { compressImage, MAX_CHARS_SEALED } from "../lib/image";
import { openPhoto, sealPhoto, type PhotoContent } from "../lib/tickets";
import { useVaultVersion, vaultKey } from "../lib/vault";
import { useTrip } from "../store";
import type { Photo } from "../types";
import { PinForm } from "./Vault";

export const MAX_PHOTOS = 3;

/** Foto già lette in questa sessione, così come stanno su Firestore (anche cifrate). */
const raw = new Map<string, Photo>();
/** Foto già decifrate in questa sessione. Si svuota quando la cassaforte si chiude. */
const opened = new Map<string, PhotoContent>();

export type PhotoState =
  | { state: "loading" } | { state: "missing" } | { state: "locked" }
  | ({ state: "ok" } & PhotoContent);

/**
 * Una foto pronta da mostrare. Le foto cifrate (biglietti) si aprono solo con la cassaforte sbloccata;
 * altrimenti lo stato è "locked".
 */
export function usePhoto(id: string): PhotoState {
  const { code, meta } = useTrip();
  const v = useVaultVersion();
  const key = vaultKey(code, meta.vault);
  const [st, setSt] = useState<PhotoState>(() => {
    const o = opened.get(id);
    return o ? { state: "ok", ...o } : { state: "loading" };
  });
  useEffect(() => {
    if (!key) opened.clear();
    const hit = opened.get(id);
    if (hit) { setSt({ state: "ok", ...hit }); return; }
    let alive = true;
    setSt({ state: "loading" });
    (async () => {
      const p = raw.get(id) ?? (await loadPhoto(code, id).catch(() => null));
      if (!p) { if (alive) setSt({ state: "missing" }); return; }
      raw.set(id, p);
      const c = await openPhoto(key, p).catch(() => null);
      if (!alive) return;
      if (c === "locked") setSt({ state: "locked" });
      else if (!c) setSt({ state: "missing" });
      else { opened.set(id, c); setSt({ state: "ok", ...c }); }
    })();
    return () => { alive = false; };
  }, [code, id, key, v]);
  return st;
}

/** Scarica in anticipo le foto (es. i biglietti di oggi e domani), così si aprono anche senza rete. */
export function preloadPhotos(code: string, ids: string[]) {
  for (const id of ids) {
    if (!raw.has(id)) loadPhoto(code, id).then((p) => { if (p) raw.set(id, p); }, () => {});
  }
}

/**
 * Foto di una spesa o prenotazione mentre la si modifica.
 * Le nuove si caricano subito; se si chiude il modulo senza salvare vengono cancellate.
 * Quelle già salvate e tolte si cancellano solo al salvataggio (`commit`).
 */
export function usePhotoDraft(initial: string[] = [], secure = false) {
  const { code, me, meta, toast } = useTrip();
  const [ids, setIds] = useState(initial);
  const [busy, setBusy] = useState(false);
  const fresh = useRef<string[]>([]);
  const dropped = useRef<string[]>([]);

  useEffect(() => () => {
    if (fresh.current.length) removePhotos(code, fresh.current).catch(() => {});
    fresh.current = [];
  }, [code]);

  const add = async (file: File) => {
    // I biglietti si salvano solo cifrati: serve la cassaforte aperta.
    const key = secure ? vaultKey(code, meta.vault) : null;
    if (secure && !key) {
      toast(meta.vault ? "Per aggiungere un biglietto sblocca prima i biglietti (in alto qui sopra)." : "Per aggiungere un biglietto crea prima il PIN dei biglietti (in alto qui sopra).");
      return;
    }
    setBusy(true);
    try {
      const img = await compressImage(file, key ? MAX_CHARS_SEALED : undefined);
      const id = newId();
      const photo: Photo = key
        ? { id, data: await sealPhoto(key, { img: img.data }), w: img.w, h: img.h, enc: true }
        : { id, ...img };
      raw.set(id, photo);
      opened.set(id, { img: img.data });
      // Non si aspetta il server: senza rete la foto resta in coda sul telefono.
      savePhoto(code, { ...photo, createdBy: me || undefined, createdAt: nowIso() }).catch((e) => {
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
  const p = usePhoto(id);
  if (p.state === "ok") return <img src={p.img} alt="" />;
  return <span className="ph-miss">{p.state === "loading" ? "…" : p.state === "locked" ? "🔒" : "Offline"}</span>;
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
  const p = usePhoto(id);
  if (p.state === "ok") {
    return (
      <figure className={`viewer-fig ${p.label || p.code ? "qr" : ""}`}>
        <img src={p.img} alt={p.label || ""} />
        {(p.label || p.code) && (
          <figcaption>
            {p.label && <b>{p.label}</b>}
            {p.code && <span className="code">{p.code}</span>}
          </figcaption>
        )}
      </figure>
    );
  }
  if (p.state === "locked") {
    return (
      <div className="ph-lock">
        <b>🔒 Biglietto protetto</b>
        <PinForm compact />
      </div>
    );
  }
  return <p className="ph-msg">{p.state === "loading" ? "Carico la foto…" : "Foto non disponibile senza rete: aprila una volta quando sei online e resterà sul telefono."}</p>;
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
