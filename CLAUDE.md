# Nihon Quest — guida per Claude Code

App mobile-first per il viaggio in Giappone di tre persone (Marty, Ema, Antonio). Interfaccia e testi in **italiano**. Le persone la usano dal telefono, spesso in giro e con una mano sola.

## Comandi

- `npm run dev` — server locale (serve `.env.local` con le chiavi Firebase, vedi `.env.example`)
- `npm test` — test Vitest della logica pura (`src/lib/logic.test.ts`)
- `npm run build` — `tsc -b` + build Vite. Esegui sempre `npm test && npm run build` prima di proporre un commit.

Il deploy avviene da solo con GitHub Actions a ogni push su `main` (`.github/workflows/deploy.yml`).

## Struttura

```
src/
  App.tsx            schermata codice, scelta "chi sei", shell con header + barra in basso
  store.tsx          TripProvider: sottoscrizioni Firestore in tempo reale, toast, run()
  ui.tsx             stato dei bottom sheet (open/close) e giorno selezionato
  types.ts           modello dati (Stop, Day, Expense, Booking, TripMeta, Proposal)
  views/             una vista per scheda: Days, Map, Votes, Expenses, Kit
  components/
    Sheets.tsx       tutti i bottom sheet: dettaglio tappa, form, impostazioni, import/export
    bits.tsx         piccoli componenti condivisi (Avatar, TypeBadge, DayStrip, VoteControls…)
  lib/
    db.ts            unico punto che parla con Firestore (letture, scritture, voto in transazione, import/export)
    firebase.ts      init Firebase, cache locale persistente, login anonimo
    votes.ts         logica pura del voto (applyVote) — testata
    money.ts         saldi e rimborsi — testata
    geo.ts           link Google Maps, parsing coordinate, geocoding Nominatim
    format.ts        date (fuso Asia/Tokyo per "oggi"), yen/euro, numeri all'italiana
    constants.ts     tipi di tappa, città, categorie spese
  content/kit.ts     frasi, numeri d'emergenza, consigli (contenuti statici)
  styles.css         tutto lo stile: token CSS in :root con tema chiaro e scuro
firestore.rules      regole di sicurezza (da incollare nella console Firebase se cambiano)
```

## Modello dati (Firestore)

Tutto sta sotto `trips/{codice}/{collection}/{id}`; le collection ammesse sono `days`, `stops`, `expenses`, `bookings`, `meta` (doc `meta/trip`). Se aggiungi una collection, aggiorna anche `firestore.rules` e `Coll` in `lib/db.ts`, e ricorda a Marty di ripubblicare le regole nella console.

- `days/{YYYY-MM-DD}`: città, titolo, hotel, note.
- `stops/{id}`: `status` è `ok` (nel programma), `proposed` (nuova, con `proposal`) o `idea` (wishlist, `dayId` vuoto). Può avere `pendingEdit` (modifica o eliminazione in votazione). `lat`/`lng` sono opzionali: senza, "Portami lì" cerca per nome.
- `expenses/{id}`: `amount` + `currency` (`JPY` o `EUR`), `paidBy`, `split`; `kind: "settle"` per i rimborsi.
- Il cambio (yen per euro) è in `meta/trip.rate`.

## Regole del progetto

- Le scritture passano da `lib/db.ts` e dalla funzione `run()` dello store, che mostra il toast e gestisce gli errori.
- Le regole dei voti stanno in `lib/votes.ts`: se le cambi, aggiorna i test.
- Niente dati del viaggio nel repository (è pubblico): i dati vivono solo su Firestore. I file `*-dati.json` sono in `.gitignore`.
- Colori solo tramite i token CSS di `styles.css`, definiti sia per il tema chiaro sia per quello scuro.
- Target di tocco di almeno 44 px, layout a una colonna, nessuno scroll orizzontale della pagina.
- Testi brevi e diretti, rivolti a chi usa l'app ("Portami lì", "Saldato"), senza gergo tecnico.
