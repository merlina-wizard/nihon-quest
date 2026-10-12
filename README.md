# Nihon Quest

L'app di viaggio di Marty, Ema e Antonio per il Giappone (28 ottobre – 12 novembre 2026): giorni con le tappe, mappa, proposte con voto, spese condivise e un kit pratico.

- **Frontend:** Vite + React + TypeScript, pubblicato su GitHub Pages.
- **Dati condivisi in tempo reale:** Firebase Firestore (piano gratuito Spark), con cache locale: l'app si apre anche senza rete.
- **Mappa:** Leaflet + OpenStreetMap. "Portami lì" apre Google Maps con i mezzi pubblici.
- **Accesso:** un codice segreto del viaggio, condiviso tra voi tre.

## Messa online, una volta sola (circa 15 minuti)

### 1. Firebase

1. Vai su [console.firebase.google.com](https://console.firebase.google.com) e crea un progetto (Google Analytics non serve).
2. **Build → Authentication → Inizia → Metodo di accesso → Anonimo → Attiva.**
3. **Build → Firestore Database → Crea database**, in modalità produzione, regione `eur3` o `europe-west`.
4. In Firestore apri la scheda **Regole**, incolla il contenuto di [`firestore.rules`](firestore.rules) e pubblica.
5. **Impostazioni progetto (ingranaggio) → Le tue app → icona Web `</>`**, registra un'app (es. "nihon-quest", senza Firebase Hosting). Copia i valori di `firebaseConfig`.
6. **Authentication → Impostazioni → Domini autorizzati:** aggiungi `merlina-wizard.github.io` (o il tuo utente GitHub).

### 2. GitHub

1. **Settings → Secrets and variables → Actions → New repository secret** e aggiungi i sei valori:

   | Secret | Da `firebaseConfig` |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Vai in **Actions**, apri "Deploy su GitHub Pages" e premi **Run workflow** (poi parte da solo a ogni push su `main`). L'indirizzo finale è `https://<utente>.github.io/<repo>/`.

> GitHub Pages gratuito richiede un repository pubblico. Nel codice non ci sono dati del viaggio: stanno solo su Firestore, protetti dal codice segreto. La configurazione web di Firebase non è un segreto (finisce comunque nel JavaScript pubblicato); la protezione la fanno le regole.

### 3. Primo accesso e dati

1. Apri l'app, scegli un **codice del viaggio** lungo e difficile da indovinare (es. `sakura-pikachu-2026-xq`, almeno 12 caratteri). Con un codice nuovo si parte da un viaggio vuoto.
2. Tocca il tuo nome in alto → **Importa JSON** → scegli `nihon-quest-dati.json` (l'export della prima versione su claude.ai). Arrivano giorni, tappe, idee e prenotazioni.
3. Manda a Ema e Antonio **il link e il codice**, possibilmente in due messaggi separati.

### 4. Sul telefono

- **iPhone:** apri il link in Safari → Condividi → **Aggiungi alla schermata Home**.
- **Android:** apri il link in Chrome → menu ⋮ → **Aggiungi a schermata Home** (o "Installa app").

Il codice resta salvato sul telefono. "Esci da questo viaggio" nelle impostazioni lo dimentica.

## Aggiornare l'itinerario

1. Scrivi l'itinerario in Markdown con il formato "per l'app" (una tabella per giorno con le colonne Ora, Tappa, Tipo, Luogo, Note).
2. Genera il JSON: `python3 scripts/md-to-json.py itinerario.md nihon-quest-dati.json nihon-quest-extra.json`. Le coordinate dei luoghi sono nello script; note del giorno, link, idee e prenotazioni stanno in `nihon-quest-extra.json`, che resta fuori dal repository.
3. Nell'app: tocca il tuo nome → **Sostituisci con un file** → scegli il JSON → scrivi `RESET` → **Sostituisci**. Giorni, tappe e prenotazioni vengono rimpiazzati per tutti; spese e cambio restano.

**Svuota itinerario** cancella giorni, tappe e prenotazioni senza importare niente. In entrambi i casi conviene prima **Scarica backup**.

## Sviluppo in locale

```bash
npm install
cp .env.example .env.local   # e compila i valori di Firebase
npm run dev                  # http://localhost:5173
npm test                     # voti, spese, coordinate
npm run build                # typecheck + build in dist/
```

Per lo sviluppo in locale va bene lo stesso progetto Firebase: `localhost` è già tra i domini autorizzati. Usa un codice di prova diverso da quello vero per non sporcare i dati del viaggio.

## Come funziona

- **Voti:** una tappa nuova in un giorno, o una modifica a nome/giorno/ora/luogo/tipo, diventa una proposta. Chi propone conta come primo sì; al secondo sì passa, con due no cade. Note e link si cambiano subito. I voti girano in una transazione Firestore, quindi due voti contemporanei non si perdono.
- **Wishlist:** le idee senza giorno si salvano senza voto; "Metti in un giorno" crea una proposta.
- **Spese:** in yen o euro, divise tra chi partecipa. "Saldato" registra un rimborso che pareggia i conti.
- **Trova posizione:** cerca le coordinate su OpenStreetMap (Nominatim). In alternativa si incolla un link lungo di Google Maps nel campo Posizione.

## Costi

Firebase Spark e GitHub Pages sono gratuiti; per tre persone si resta molto sotto i limiti. Le tile di OpenStreetMap sono gratuite con uso leggero come questo.
