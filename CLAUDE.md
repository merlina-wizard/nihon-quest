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
    Sheets.tsx       tutti i bottom sheet: dettaglio tappa, form, impostazioni, import/export, testo grande (frasi, tassista)
    Photos.tsx       foto di scontrini e biglietti: caricamento, miniature, visore a tutto schermo
    bits.tsx         piccoli componenti condivisi (Avatar, TypeBadge, DayStrip, VoteControls, Linked…)
  lib/
    db.ts            unico punto che parla con Firestore (letture, scritture, voto in transazione, import/export)
    firebase.ts      init Firebase, cache locale persistente, login anonimo
    votes.ts         logica pura del voto (applyVote) — testata
    money.ts         saldi, rimborsi, riepilogo spese — testata; cambio dal web (Frankfurter)
    geo.ts           link Google Maps, parsing coordinate, distanze, geocoding Nominatim
    today.ts         card "Adesso": prossima tappa, prenotazioni del giorno — testata
    weather.ts       previsioni Open-Meteo per la città del giorno (cache 3 ore)
    position.ts      hook useHere (posizione del telefono, condivisa tra le viste)
    device.ts        schermo sempre acceso, voce giapponese
    image.ts         compressione delle foto prima del salvataggio
    format.ts        date (fuso Asia/Tokyo per "oggi"), yen/euro, numeri all'italiana
    constants.ts     tipi di tappa, città, categorie spese
  content/kit.ts     frasi, numeri d'emergenza, consigli (contenuti statici)
  styles.css         tutto lo stile: token CSS in :root con tema chiaro e scuro
firestore.rules      regole di sicurezza (da incollare nella console Firebase se cambiano)
scripts/md-to-json.py  converte l'itinerario Markdown nel JSON da importare (coordinate, note, idee, prenotazioni in cima)
```

## Modello dati (Firestore)

Tutto sta sotto `trips/{codice}/{collection}/{id}`; le collection ammesse sono `days`, `stops`, `expenses`, `bookings`, `meta` (doc `meta/trip`), `photos`. Se aggiungi una collection, aggiorna anche `firestore.rules` e `Coll` in `lib/db.ts`, e ricorda a Marty di ripubblicare le regole nella console.

- `days/{YYYY-MM-DD}`: città, titolo, hotel, `hotelAddressJp` (per il tassista), note.
- `stops/{id}`: `status` è `ok` (nel programma), `proposed` (nuova, con `proposal`) o `idea` (wishlist, `dayId` vuoto). Può avere `pendingEdit` (modifica o eliminazione in votazione). `lat`/`lng` sono opzionali: senza, "Portami lì" cerca per nome.
- `expenses/{id}`: `amount` + `currency` (`JPY` o `EUR`), `paidBy`, `split`; `kind: "settle"` per i rimborsi.
- `bookings/{id}`: può avere `addressJp` e `photos`.
- `photos/{id}`: `data` (JPEG base64, max ~800 KB), `w`, `h`. Non ha un listener: si legge su richiesta (`loadPhoto`, prima dalla cache). Spese e prenotazioni tengono gli id in `photos`.
- Il cambio (yen per euro) è in `meta/trip.rate`, il budget al giorno a persona in `meta/trip.dailyBudget`.

## Regole del progetto

- Reset: `clearCollections` e `replaceItinerary` in `lib/db.ts` toccano solo `days`, `stops`, `bookings` (`ITINERARY_COLLS`) e le foto delle prenotazioni. Spese (con i loro scontrini) e cambio non si cancellano mai da lì. Il backup JSON non contiene le foto.
- `run()` non aspetta il server più di 4 secondi: senza rete la scrittura resta in coda nella cache di Firestore. Per i nuovi documenti l'id si genera una volta sola nel modulo, così un doppio tocco non crea doppioni.
- Il service worker (`vite-plugin-pwa`, config in `vite.config.ts`) mette in cache app, font e tile della mappa già viste. I pannelli e il visore foto hanno una voce nella cronologia: Indietro li chiude.
- Le scritture passano da `lib/db.ts` e dalla funzione `run()` dello store, che mostra il toast e gestisce gli errori.
- Le regole dei voti stanno in `lib/votes.ts`: se le cambi, aggiorna i test.
- Niente dati del viaggio nel repository (è pubblico): i dati vivono solo su Firestore. I file `*-dati.json` sono in `.gitignore`.
- Colori solo tramite i token CSS di `styles.css`, definiti sia per il tema chiaro sia per quello scuro.
- Target di tocco di almeno 44 px, layout a una colonna, nessuno scroll orizzontale della pagina.
- Testi brevi e diretti, rivolti a chi usa l'app ("Portami lì", "Saldato"), senza gergo tecnico.
