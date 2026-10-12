/** Contenuti fissi della sezione Kit. Modificali qui. */

export type Phrase = [it: string, jp: string, romaji: string];

export const PHRASES: [group: string, phrases: Phrase[]][] = [
  ["Base", [
    ["Buongiorno / Ciao", "こんにちは", "konnichiwa"],
    ["Grazie mille", "ありがとうございます", "arigatō gozaimasu"],
    ["Mi scusi (anche per chiamare qualcuno)", "すみません", "sumimasen"],
    ["Sì / No", "はい / いいえ", "hai / iie"],
    ["Non capisco il giapponese", "日本語がわかりません", "nihongo ga wakarimasen"],
    ["Parla inglese?", "英語を話せますか？", "eigo o hanasemasu ka?"],
  ]],
  ["Ristorante", [
    ["Siamo in tre", "３人です", "san-nin desu"],
    ["Il menù, per favore", "メニューをお願いします", "menyū o onegai shimasu"],
    ["Questo, per favore (indicando)", "これをお願いします", "kore o onegai shimasu"],
    ["Buonissimo!", "おいしい！", "oishii!"],
    ["Il conto, per favore", "お会計お願いします", "o-kaikei onegai shimasu"],
    ["Prima di mangiare", "いただきます", "itadakimasu"],
    ["Dopo aver mangiato, grazie", "ごちそうさまでした", "gochisōsama deshita"],
  ]],
  ["Shopping", [
    ["Quanto costa?", "いくらですか？", "ikura desu ka?"],
    ["Posso pagare con la carta?", "カードで払えますか？", "kādo de haraemasu ka?"],
    ["Si può fare tax free?", "免税できますか？", "menzei dekimasu ka?"],
    ["Posso provarlo?", "試着してもいいですか？", "shichaku shite mo ii desu ka?"],
    ["Una busta, per favore", "袋をお願いします", "fukuro o onegai shimasu"],
  ]],
  ["In giro", [
    ["Dov'è …?", "…はどこですか？", "… wa doko desu ka?"],
    ["Dov'è il bagno?", "トイレはどこですか？", "toire wa doko desu ka?"],
    ["Mi porti qui, per favore (al taxi)", "ここまでお願いします", "koko made onegai shimasu"],
    ["Questo treno va a …?", "この電車は…に行きますか？", "kono densha wa … ni ikimasu ka?"],
    ["Stazione", "駅", "eki"],
  ]],
  ["Emergenza", [
    ["Aiuto!", "助けて！", "tasukete!"],
    ["Chiamate un'ambulanza, per favore", "救急車を呼んでください", "kyūkyūsha o yonde kudasai"],
    ["Ho perso il portafoglio", "財布をなくしました", "saifu o nakushimashita"],
    ["Mi sono persa / perso", "道に迷いました", "michi ni mayoimashita"],
  ]],
];

export const EMERGENCY: { number: string; title: string; text: string }[] = [
  { number: "110", title: "Polizia", text: "Furti, smarrimenti gravi, emergenze." },
  { number: "119", title: "Ambulanza e vigili del fuoco", text: "Dite subito \"kyūkyū\" (ambulanza) o \"kaji\" (incendio)." },
  { number: "050-3816-2787", title: "Japan Visitor Hotline", text: "Linea JNTO per turisti, 24 ore su 24, in inglese." },
  { number: "+81 3-3453-5291", title: "Ambasciata d'Italia a Tokyo", text: "Passaporto perso o problemi seri. Verificate il numero sul sito dell'ambasciata prima di partire." },
];

/** Checklist "Prima di partire": le spunte restano salvate solo sul telefono di chi le mette. */
export const CHECKLIST: { id: string; title: string; text: string }[] = [
  { id: "esim", title: "eSIM giapponese", text: "Una per ciascuna, da attivare prima del volo: serve per mappe, traduttore e prenotazioni." },
  { id: "vjw", title: "Visit Japan Web", text: "Compilato prima del volo, con il QR per immigrazione e dogana." },
  { id: "adattatori", title: "Adattatori tipo A", text: "Prese a lamelle piatte, 100 V. Caricatori di telefoni e computer funzionano senza trasformatore." },
  { id: "suica", title: "Suica nel Wallet", text: "Aggiungetela all'iPhone: treni, metro, bus e konbini." },
  { id: "strati", title: "Vestiti a strati", text: "Di giorno 17–19°C, la sera verso i 10°C. Il sole tramonta verso le 16:35." },
  { id: "scarpe", title: "Scarpe comode", text: "Da togliere e rimettere in fretta: nei templi, in molti ristoranti e nei camerini del kimono ci si scalza." },
  { id: "checkin", title: "Check-in online", text: "Qatar Airways, dal 26 ottobre." },
  { id: "notte10", title: "Notte 10 → 11 novembre", text: "Ancora da prenotare: la soluzione più comoda è estendere lo ying-Shinjuku." },
];

export const TIPS: [title: string, text: string][] = [
  ["Tax free cambia il 1° novembre", "Fino al 31 ottobre lo sconto si fa in cassa mostrando il passaporto. Dal 1° novembre si paga il prezzo pieno e il rimborso del 10% si chiede alla dogana in aeroporto, prima del check-in. Gli articoli usati o consumati in Giappone non vengono rimborsati: tenete sigillati snack e cosmetici e conservate le ricevute."],
  ["Spedire le valigie (takkyubin)", "Alla reception: \"Can you send my suitcase to my next hotel?\", con nome, indirizzo e telefono del prossimo hotel e la data di check-in. Se la reception non lo fa, va bene un konbini. Arrivano il giorno dopo, circa 2.000–2.600 yen a valigia. Avvisate l'hotel di arrivo."],
  ["Nello zaino per la notte", "Passaporto, soldi, medicine, caricatori e power bank (le batterie non si spediscono) e vestiti per una notte."],
  ["Quando non spedire le valigie", "All'arrivo, perché da Narita arriverebbero il giorno dopo, e alla partenza, perché l'invio in aeroporto va fatto con due giorni di anticipo."],
  ["Valigie sullo Shinkansen", "Sulla linea Tokyo–Kyoto–Osaka una valigia con la somma dei tre lati oltre i 160 cm richiede un posto con spazio bagagli prenotato."],
  ["Biglietti dei treni", "Vanno comprati prima solo i due Shinkansen e il bus per Nijigen no Mori. Con due sole tratte il JR Pass non conviene: biglietti singoli, dall'app ufficiale delle ferrovie o in stazione."],
  ["Pass giornaliero a Kyoto", "Bus e metro per 1.100 yen: si ripaga dopo 5 corse."],
  ["Da Shinjuku a Haneda", "Circa un'ora: treno via Shinagawa con la Suica, oppure Limousine Bus."],
  ["Mangiare bene spendendo poco", "A pranzo molti ristoranti fanno set teishoku a metà del prezzo serale. Per il sushi economico: Sushiro, Kura Sushi o il sushi in piedi."],
  ["Foliage in ritardo", "Quest'anno il picco a Kyoto è previsto tra fine novembre e metà dicembre: troverete soprattutto verde con qualche acero già colorato."],
  ["IC card", "Suica o PASMO, anche nel Wallet dell'iPhone: treni, metro, bus e konbini senza biglietti."],
  ["Contanti", "Molti locali piccoli e templi accettano solo contanti. Gli ATM dei 7-Eleven funzionano con le carte estere."],
  ["Cestini", "Ce ne sono pochissimi: portate un sacchetto per i rifiuti e buttateli in hotel."],
  ["Mance", "Non si lasciano. Il servizio è già compreso."],
  ["Scale mobili", "A Tokyo si sta a sinistra, a Osaka a destra."],
  ["In treno", "Niente telefonate, voce bassa, zaino davanti. In fila sui segni a terra."],
  ["Street food", "Mangiate vicino al banco dove comprate: camminare mangiando è mal visto (Nishiki compreso)."],
  ["Kushikatsu a Shinsekai", "La salsa comune si usa una sola volta: niente doppio tuffo."],
  ["Cervi di Nara", "Inchinatevi e vi rispondono. Date solo i cracker shika senbei e tenete mappe e sacchetti in tasca: mordicchiano."],
  ["Gion", "Niente foto alle maiko senza permesso e niente vie private: ci sono multe."],
];
