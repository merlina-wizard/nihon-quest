/**
 * Cassaforte dei biglietti.
 *
 * I biglietti (QR e foto delle prenotazioni) si cifrano SUL TELEFONO prima di andare su Firestore,
 * con una chiave ricavata dal "PIN dei biglietti" (PBKDF2-SHA256 → AES-GCM 256).
 * Su Firestore finisce solo testo cifrato: chi conosce il codice del viaggio ma non il PIN
 * vede dati illeggibili. Il PIN non viene mai salvato da nessuna parte.
 *
 * In meta/trip.vault ci sono solo sale, numero di iterazioni e un testo di controllo cifrato,
 * che serve a capire se il PIN inserito è giusto.
 * Sul telefono, se lo si sceglie, resta la chiave (non esportabile) in IndexedDB,
 * così all'ingresso il QR si apre subito, anche offline.
 */
import { useSyncExternalStore } from "react";

export interface VaultInfo {
  v: 1;
  salt: string;
  iter: number;
  check: string;
}

const PREFIX = "nqv1.";
const CHECK_TEXT = "nihon-quest-biglietti";
export const VAULT_ITER = 600_000;
export const MIN_PIN = 8;

/* ---------- base64 ---------- */
const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/* ---------- primitive ---------- */
export async function deriveKey(pin: string, salt: string, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromB64(salt), iterations: iter },
    base,
    { name: "AES-GCM", length: 256 },
    false, // non esportabile: nemmeno il codice della pagina può leggerla
    ["encrypt", "decrypt"],
  );
}

export const isSealed = (s: unknown): s is string => typeof s === "string" && s.startsWith(PREFIX);

export async function seal(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return `${PREFIX}${toB64(iv)}.${toB64(ct)}`;
}

/** Decifra; lancia un errore se la chiave è sbagliata o il testo è stato manomesso. */
export async function unseal(key: CryptoKey, s: string): Promise<string> {
  if (!isSealed(s)) throw new Error("non cifrato");
  const [ivB, ctB] = s.slice(PREFIX.length).split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(ivB) }, key, fromB64(ctB));
  return new TextDecoder().decode(pt);
}

export async function createVault(pin: string, iter = VAULT_ITER): Promise<{ info: VaultInfo; key: CryptoKey }> {
  const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveKey(pin, salt, iter);
  return { info: { v: 1, salt, iter, check: await seal(key, CHECK_TEXT) }, key };
}

/** Restituisce la chiave se il PIN è giusto, altrimenti null. */
export async function openVault(pin: string, info: VaultInfo): Promise<CryptoKey | null> {
  const key = await deriveKey(pin, info.salt, info.iter);
  try {
    return (await unseal(key, info.check)) === CHECK_TEXT ? key : null;
  } catch {
    return null;
  }
}

/* ---------- chiave ricordata sul telefono (IndexedDB) ---------- */
const DB = "nq-vault", STORE = "keys";
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbDo<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await idb();
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined; // navigazione privata o IndexedDB bloccato: semplicemente non si ricorda
  }
}
/** La chiave dipende dal sale: se il PIN cambia, la chiave vecchia non si usa più. */
const slot = (trip: string, info: VaultInfo) => `${trip}:${info.salt}`;

/* ---------- stato condiviso dell'app ---------- */
let current: { slot: string; key: CryptoKey } | null = null;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => { version++; listeners.forEach((l) => l()); };

/** La chiave aperta per questo viaggio, se c'è. */
export function vaultKey(trip: string, info?: VaultInfo): CryptoKey | null {
  if (!info || !current || current.slot !== slot(trip, info)) return null;
  return current.key;
}

export async function setVaultKey(trip: string, info: VaultInfo, key: CryptoKey, remember: boolean) {
  current = { slot: slot(trip, info), key };
  if (remember) await idbDo("readwrite", (s) => s.put(key, slot(trip, info)));
  emit();
}

/** Prova a riprendere la chiave ricordata su questo telefono. */
export async function restoreVaultKey(trip: string, info: VaultInfo): Promise<boolean> {
  if (vaultKey(trip, info)) return true;
  const key = await idbDo<CryptoKey>("readonly", (s) => s.get(slot(trip, info)));
  if (!key) return false;
  current = { slot: slot(trip, info), key };
  emit();
  return true;
}

/** Blocca: dimentica la chiave in memoria e sul telefono. */
export async function lockVault(trip: string, info?: VaultInfo) {
  current = null;
  if (info) await idbDo("readwrite", (s) => s.delete(slot(trip, info)));
  emit();
}

/** Si ridisegna quando la cassaforte si apre o si chiude. */
export function useVaultVersion(): number {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => version);
}
