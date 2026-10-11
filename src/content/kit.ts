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

export const TIPS: [title: string, text: string][] = [
  ["Tax free cambia il 1° novembre", "Fino al 31 ottobre lo sconto si fa in cassa mostrando il passaporto. Dal 1° novembre si paga il prezzo pieno e il rimborso della tassa si chiede alla dogana quando si parte, prima del check-in: tenete passaporto, ricevute e acquisti a portata di mano."],
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
  ["Valigie (takkyubin)", "Gli hotel spediscono le valigie all'hotel successivo, spesso arrivano il giorno dopo: tenete uno zaino per una notte."],
];
