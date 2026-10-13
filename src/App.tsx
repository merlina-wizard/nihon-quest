import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Avatar, isTraveler } from "./components/bits";
import { SheetHost } from "./components/Sheets";
import { ensureSignedIn, firebaseConfigured } from "./lib/firebase";
import { todayTokyo } from "./lib/format";
import { local } from "./lib/storage";
import { pendingsOf, TripProvider, useTrip } from "./store";
import { UiCtx, type SheetState, type Ui } from "./ui";
import { proposalOf } from "./lib/votes";
import { DaysView } from "./views/DaysView";
import { ExpensesView } from "./views/ExpensesView";
import { KitView } from "./views/KitView";
import { MapView } from "./views/MapView";
import { VotesView } from "./views/VotesView";
import { TRAVELERS, type Tab } from "./types";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function App() {
  return <><Main /><UpdateBar /></>;
}

/** Avviso quando è pubblicata una nuova versione dell'app (il service worker la tiene in attesa). */
function UpdateBar() {
  const reg = useRef<ServiceWorkerRegistration>();
  const { needRefresh: [need, setNeed] } = useRegisterSW({
    onRegisteredSW(_url, r) {
      reg.current = r;
      // Un'app aperta per giorni controlla gli aggiornamenti quando torna in primo piano.
      if (r) document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") r.update().catch(() => {}); });
    },
  });
  if (!need) return null;
  return (
    <div className="update-bar" role="status">
      <span>Nuova versione disponibile.</span>
      <button className="btn small primary" onClick={() => { setNeed(false); applyUpdate(reg.current); }}>Aggiorna</button>
    </div>
  );
}

/**
 * Attiva la versione in attesa e ricarica. Non si affida solo a `controllerchange`: su iPhone la PWA
 * può partire senza service worker al comando e quell'evento non arriva. Se dopo 5 secondi la versione
 * nuova è ancora in attesa, toglie il service worker: al riavvio si installa da zero quello nuovo.
 */
function applyUpdate(r?: ServiceWorkerRegistration) {
  const waiting = r?.waiting;
  let done = false;
  const reload = () => { if (!done) { done = true; window.location.reload(); } };
  if (!r || !waiting) return reload();
  navigator.serviceWorker.addEventListener("controllerchange", reload);
  waiting.addEventListener("statechange", () => { if (waiting.state === "activated") reload(); });
  waiting.postMessage({ type: "SKIP_WAITING" });
  setTimeout(() => {
    if (done) return;
    if (r.waiting === waiting) r.unregister().catch(() => {}).finally(reload);
    else reload();
  }, 5000);
}

function Main() {
  const [code, setCode] = useState<string | null>(local.get("code"));
  const [auth, setAuth] = useState<"wait" | "ok" | "err">("wait");

  useEffect(() => {
    if (!firebaseConfigured) return;
    ensureSignedIn().then(() => setAuth("ok"), (e) => { console.warn(e); setAuth("err"); });
  }, []);
  const onLeave = useCallback(() => setCode(null), []);

  if (!firebaseConfigured) return <SetupMissing />;
  if (auth === "err") return <Center title="Accesso non riuscito">Controlla la connessione. Se il problema resta, nella console Firebase va attivato l'accesso anonimo (vedi README).</Center>;
  if (auth === "wait") return <Center title="NIHON QUEST">Un attimo…</Center>;
  if (!code) return <CodeGate onCode={(c) => { local.set("code", c); setCode(c); }} />;

  return (
    <TripProvider code={code} onLeave={onLeave}>
      <Shell />
    </TripProvider>
  );
}

function Center({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="center-screen"><h1>{title}</h1>{children && <p>{children}</p>}</div>;
}

function SetupMissing() {
  return (
    <Center title="Configurazione mancante">
      Mancano le chiavi di Firebase, oppure una non è giusta (l'ID progetto è senza punti, es. nihon-quest-2026). In locale copia <code>.env.example</code> in <code>.env.local</code> e compilalo; su GitHub aggiungile come secret del repository. Trovi i passaggi nel README.
    </Center>
  );
}

/** Schermata del codice segreto: è la chiave che apre i dati del viaggio. */
function CodeGate({ onCode }: { onCode: (c: string) => void }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = v.trim().toLowerCase().replace(/\s+/g, "-");
    if (!/^[a-z0-9_-]{12,64}$/.test(c)) { setErr("Il codice ha almeno 12 caratteri: lettere, numeri e trattini."); return; }
    onCode(c);
  };
  return (
    <form className="center-screen" onSubmit={submit}>
      <h1>NIHON <i>QUEST</i></h1>
      <p>Scrivi il codice del viaggio che ti hanno mandato.</p>
      <input className="inp" id="trip_code" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={v} onChange={(e) => setV(e.target.value)} placeholder="es. sakura-pikachu-2026-xq" aria-label="Codice del viaggio" />
      {err && <p className="err" style={{ textAlign: "center" }}>{err}</p>}
      <button className="btn primary block" type="submit">Entra</button>
      <p style={{ fontSize: 12.5 }}>Chi crea il viaggio sceglie il codice al primo accesso: con un codice nuovo si parte da un viaggio vuoto.</p>
    </form>
  );
}

const NAV: { tab: Tab; label: string; icon: JSX.Element }[] = [
  { tab: "giorni", label: "Giorni", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg> },
  { tab: "mappa", label: "Mappa", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></svg> },
  { tab: "voti", label: "Idee", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z" /></svg> },
  { tab: "spese", label: "Spese", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M8.5 7.5L12 12l3.5-4.5M8.5 12.5h7M8.5 15.5h7M12 12v5.5" /></svg> },
  { tab: "kit", label: "Kit", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M4 13h16" /></svg> },
];

function Shell() {
  const { me, setMe, days, stops, error, slow, loaded, synced } = useTrip();
  const [tab, setTabState] = useState<Tab>(() => (local.get("tab") as Tab) || "giorni");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [day, setDay] = useState<string | null>(null);

  // Giorno di partenza: oggi (ora di Tokyo) se è nel viaggio, altrimenti il primo o l'ultimo.
  const autoDay = useRef<string | null>(null);
  const pickToday = useCallback(() => {
    if (!days.length) return;
    const t = todayTokyo();
    const d = days.some((x) => x.id === t) ? t : t < days[0].id ? days[0].id : days[days.length - 1].id;
    autoDay.current = d;
    setDay(d);
  }, [days]);
  useEffect(() => { if (!day) pickToday(); }, [day, pickToday]);
  // Se l'app resta aperta a cavallo della mezzanotte, al ritorno si passa al nuovo giorno,
  // a meno che non si stia guardando un giorno scelto a mano.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible" && day === autoDay.current) pickToday(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [day, pickToday]);

  const setTab = (t: Tab) => { local.set("tab", t); setTabState(t); window.scrollTo(0, 0); };
  // I pannelli hanno una voce nella cronologia: il tasto (o gesto) Indietro chiude il pannello invece di uscire dall'app.
  const closing = useRef(false);
  const pending = useRef<SheetState>(null);
  const close = useCallback(() => {
    if (history.state?.nqSheet && !closing.current) { closing.current = true; history.back(); }
    else if (!closing.current) setSheet(null);
  }, []);
  const open = useCallback((s: SheetState) => {
    if (!s) { close(); return; }
    if (closing.current) { pending.current = s; return; } // si apre appena finisce la chiusura
    if (history.state?.nqSheet) history.replaceState({ nqSheet: true }, "");
    else history.pushState({ nqSheet: true }, "");
    setSheet(s);
  }, [close]);
  useEffect(() => {
    const onPop = () => {
      // Si è tornati alla voce del pannello (es. chiudendo una foto sopra di esso): il pannello resta.
      if (history.state?.nqSheet) return;
      closing.current = false;
      const next = pending.current;
      pending.current = null;
      if (next) { history.pushState({ nqSheet: true }, ""); setSheet(next); } else setSheet(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const ui = useMemo<Ui>(() => ({ open, close, day, setDay }), [open, close, day]);

  const toVote = me ? pendingsOf(stops).filter((s) => { const p = proposalOf(s); return p && !p.yes.includes(me) && !p.no.includes(me); }).length : 0;

  return (
    <UiCtx.Provider value={ui}>
      {!isTraveler(me) && (
        <div className="who">
          <h1>NIHON <i>QUEST</i></h1>
          <p>Chi sta giocando?</p>
          <div className="chars">
            {TRAVELERS.map((n) => <button key={n} className="char" onClick={() => setMe(n)}><Avatar name={n} />{n}</button>)}
          </div>
          <p style={{ fontSize: 12.5, fontWeight: 400 }}>Serve per i voti e le spese. Puoi cambiarlo dopo toccando il tuo nome in alto.</p>
        </div>
      )}
      <header className={`top ${loaded && !synced ? "unsynced" : ""}`}>
        <div className="logo"><b>NIHON <i>QUEST</i></b><small>東京 · 京都 · 大阪 · 2026</small></div>
        {loaded && !synced && <span className="chip vote sync-chip" style={{ marginLeft: "auto" }} title="Le ultime modifiche non sono ancora arrivate al server">Non salvato</span>}
        <button className="me-chip" style={loaded && !synced ? { marginLeft: 8 } : undefined} onClick={() => open({ kind: "settings" })} aria-label="Chi sei e impostazioni">
          {me ? <><Avatar name={me} /><span className="name">{me}</span></> : <><span className="av off">?</span><span className="name">Chi sei?</span></>}
        </button>
      </header>
      <main>
        {error && <div className="banner">{error}</div>}
        {!error && slow && !loaded && (
          <div className="banner">Non riesco a collegarmi al server. Controlla la connessione; se sei al computer, prova a disattivare le estensioni del browser o ad aprire l'app dal telefono.</div>
        )}
        {tab === "giorni" && <DaysView />}
        {tab === "mappa" && <MapView />}
        {tab === "voti" && <VotesView />}
        {tab === "spese" && <ExpensesView />}
        {tab === "kit" && <KitView />}
      </main>
      <nav className="nav" aria-label="Sezioni">
        {NAV.map((n) => (
          <button key={n.tab} aria-current={tab === n.tab ? "page" : undefined} onClick={() => setTab(n.tab)}>
            {n.icon}{n.label}
            {n.tab === "voti" && toVote > 0 && <span className="dotbadge">{toVote}</span>}
          </button>
        ))}
      </nav>
      <SheetHost sheet={sheet} />
    </UiCtx.Provider>
  );
}
