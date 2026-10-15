import { useEffect, useState, type FormEvent } from "react";
import { loadPhoto, savePhoto, saveVault } from "../lib/db";
import { sealPhoto } from "../lib/tickets";
import {
  createVault, isSealed, lockVault, MIN_PIN, openVault, restoreVaultKey, setVaultKey, useVaultVersion, vaultKey,
} from "../lib/vault";
import { useTrip } from "../store";
import { ConfirmButton } from "./bits";

/** Stato della cassaforte dei biglietti per questo viaggio, su questo telefono. */
export function useVault() {
  const { code, meta } = useTrip();
  useVaultVersion();
  const info = meta.vault;
  const [restoring, setRestoring] = useState(!!info);
  useEffect(() => {
    if (!info) { setRestoring(false); return; }
    let alive = true;
    restoreVaultKey(code, info).finally(() => { if (alive) setRestoring(false); });
    return () => { alive = false; };
  }, [code, info?.salt]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = vaultKey(code, info);
  const status: "none" | "locked" | "open" = !info ? "none" : key ? "open" : "locked";
  return { info, key, status, restoring };
}

/**
 * Inserimento del PIN dei biglietti: crea la cassaforte se non c'è, altrimenti la apre.
 * `onOpen` riceve la chiave aperta.
 */
export function PinForm({ onOpen, compact }: { onOpen?: (key: CryptoKey) => void; compact?: boolean }) {
  const { code, run } = useTrip();
  const { info } = useVault();
  const creating = !info;
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (creating) {
      if (pin.length < MIN_PIN) { setErr(`Il PIN deve avere almeno ${MIN_PIN} caratteri.`); return; }
      if (pin !== pin2) { setErr("I due PIN non coincidono."); return; }
    }
    setBusy(true);
    try {
      if (creating) {
        const { info: v, key } = await createVault(pin);
        const ok = await run(() => saveVault(code, v), "Cassaforte creata: i biglietti si salvano cifrati.");
        if (!ok) return;
        await setVaultKey(code, v, key, remember);
        onOpen?.(key);
      } else {
        const key = await openVault(pin, info!);
        if (!key) { setErr("PIN sbagliato."); return; }
        await setVaultKey(code, info!, key, remember);
        onOpen?.(key);
      }
      setPin(""); setPin2("");
    } finally { setBusy(false); }
  };

  return (
    <form className="vault-form" onSubmit={submit} noValidate>
      {!compact && (
        <p className="hint" style={{ margin: 0 }}>
          {creating
            ? "Scegliete un PIN lungo (almeno 8 caratteri, meglio una frase) e ditevelo a voce, non per chat. Senza PIN i biglietti non si possono più leggere: segnatelo in un posto sicuro."
            : "Inserisci il PIN dei biglietti che vi siete detti."}
        </p>
      )}
      <label className="f">{creating ? "Nuovo PIN dei biglietti" : "PIN dei biglietti"}
        <input className="inp" id="vault_pin" type={show ? "text" : "password"} autoComplete={creating ? "new-password" : "current-password"}
          value={pin} onChange={(e) => setPin(e.target.value)} />
      </label>
      {creating && (
        <label className="f">Ripeti il PIN
          <input className="inp" id="vault_pin2" type={show ? "text" : "password"} autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value)} />
        </label>
      )}
      <div className="pick">
        <span><input type="checkbox" id="vault_show" checked={show} onChange={(e) => setShow(e.target.checked)} /><label htmlFor="vault_show">Mostra</label></span>
        <span><input type="checkbox" id="vault_remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><label htmlFor="vault_remember">Ricorda su questo telefono</label></span>
      </div>
      {err && <p className="err" style={{ margin: 0 }}>{err}</p>}
      <button className="btn primary block" type="submit" disabled={busy}>
        {busy ? "Un attimo…" : creating ? "Crea la cassaforte" : "Sblocca i biglietti"}
      </button>
    </form>
  );
}

/** Sezione delle impostazioni: stato, sblocco, blocco e protezione delle foto già caricate in chiaro. */
export function VaultSettings() {
  const { code, bookings, run, toast } = useTrip();
  const { info, key, status, restoring } = useVault();
  const [plain, setPlain] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = bookings.flatMap((b) => b.photos || []);
  const idsKey = ids.join(",");

  // Quante foto di prenotazioni sono ancora in chiaro (caricate prima della cassaforte)?
  useEffect(() => {
    if (status !== "open") { setPlain(null); return; }
    let alive = true;
    Promise.all(ids.map((id) => loadPhoto(code, id).catch(() => null)))
      .then((ps) => { if (alive) setPlain(ps.filter((p) => p && !isSealed(p.data)).length); });
    return () => { alive = false; };
  }, [status, code, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const protect = async () => {
    if (!key) return;
    setBusy(true);
    await run(async () => {
      let n = 0;
      for (const b of bookings) {
        for (const id of b.photos || []) {
          const p = await loadPhoto(code, id);
          if (!p || isSealed(p.data)) continue;
          await savePhoto(code, { ...p, data: await sealPhoto(key, { img: p.data }), enc: true });
          n++;
        }
      }
      setPlain(0);
      return `${n} foto di biglietti ora sono cifrate.`;
    });
    setBusy(false);
  };

  return (
    <div className="card vault-card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>🔒 Biglietti protetti</b>
        <span className={`chip ${status === "open" ? "done" : status === "locked" ? "vote" : ""}`}>
          {restoring ? "…" : status === "open" ? "Sbloccati" : status === "locked" ? "Bloccati" : "Da attivare"}
        </span>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        QR e foto dei biglietti si cifrano sul telefono prima di essere salvati. Chi ha il link e il codice del viaggio, ma non il PIN, non li può aprire.
      </p>
      {status !== "open" && !restoring && <PinForm />}
      {status === "open" && (
        <>
          {plain !== null && plain > 0 && (
            <button className="btn block" disabled={busy} onClick={protect}>
              {busy ? "Cifro…" : `Proteggi ${plain} ${plain === 1 ? "foto caricata" : "foto caricate"} prima`}
            </button>
          )}
          <ConfirmButton className="btn ghost block" label="Blocca su questo telefono" confirmLabel="Tocca di nuovo per bloccare"
            onConfirm={() => { lockVault(code, info); toast("Biglietti bloccati su questo telefono."); }} />
        </>
      )}
    </div>
  );
}
