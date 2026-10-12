#!/usr/bin/env python3
"""
Converte l'itinerario in Markdown (formato "per l'app") nel JSON da importare in Nihon Quest.

Uso:
    python3 scripts/md-to-json.py itinerario.md nihon-quest-dati.json [nihon-quest-extra.json]

Formato atteso nel Markdown:
    ### Gio 29 ott – Titolo del giorno
    **Città:** Tokyo · **Alloggio:** Nome dell'hotel
    | Ora | Tappa | Tipo | Luogo | Note |
    | --- | --- | --- | --- | --- |
    | 11:55 | Arrivo a Narita | trasporti | Narita International Airport, Tokyo | ... |

Le coordinate dei luoghi noti stanno in COORDS (chiave = testo del Luogo, o la destinazione
dopo "→"). I luoghi senza coordinate funzionano lo stesso: "Portami lì" li cerca per nome.
Note del giorno, link, idee e prenotazioni stanno nel file extra (fuori dal repository).
"""
import json
import re
import sys

YEAR = 2026
MONTHS = {"ott": 10, "nov": 11}
TYPES = {"tempio", "cibo", "anime", "shopping", "natura", "esperienza", "hotel", "trasporti", "altro"}
NOW = "2026-10-12T10:00:00Z"

# Coordinate approssimative (lat, lng) dei luoghi noti. Chiave: testo del Luogo o della destinazione.
COORDS = {
    "Narita International Airport, Tokyo": (35.7720, 140.3929),
    "Shinjuku Station": (35.6896, 139.7006),
    "Asakusa Station": (35.7106, 139.7975),
    "Senso-ji, Asakusa, Tokyo": (35.7148, 139.7967),
    "Nakamise-dori, Asakusa, Tokyo": (35.7118, 139.7963),
    "Suehirocho Station": (35.7027, 139.7718),
    "Akihabara Radio Kaikan, Akihabara, Tokyo": (35.6983, 139.7717),
    "Super Potato e Mandarake Complex, Akihabara, Tokyo": (35.7001, 139.7713),
    "Ikebukuro Station": (35.7295, 139.7109),
    "Sunshine City, Ikebukuro, Tokyo": (35.7289, 139.7193),
    "Sunshine City e vie di Ikebukuro, Tokyo": (35.7296, 139.7176),
    "Sunshine City Alpa, Ikebukuro, Tokyo": (35.7284, 139.7187),
    "Tokyo Station": (35.6812, 139.7671),
    "Kyoto Station": (34.9858, 135.7588),
    "Shijo Station": (35.0037, 135.7597),
    "Nishiki Market, Nakagyo, Kyoto": (35.0050, 135.7649),
    "Ginkakuji-michi": (35.0262, 135.7899),
    "Ginkaku-ji, Sakyo, Kyoto": (35.0270, 135.7982),
    "Philosopher's Path, Sakyo, Kyoto": (35.0230, 135.7945),
    "Nanzen-ji, Sakyo, Kyoto": (35.0112, 135.7944),
    "Pontocho, Nakagyo, Kyoto": (35.0063, 135.7710),
    "Kiyomizu-dera, Higashiyama, Kyoto": (34.9949, 135.7850),
    "Sannenzaka, Higashiyama, Kyoto": (34.9966, 135.7810),
    "Hokan-ji (Yasaka Pagoda), Higashiyama, Kyoto": (34.9986, 135.7793),
    "Yasaka Shrine, Gion, Kyoto": (35.0037, 135.7785),
    "Hanamikoji-dori, Gion, Kyoto": (35.0029, 135.7752),
    "Saga-Arashiyama Station": (35.0182, 135.6812),
    "Arashiyama Bamboo Grove, Kyoto": (35.0170, 135.6719),
    "Tenryu-ji, Arashiyama, Kyoto": (35.0157, 135.6738),
    "Togetsukyo Bridge, Arashiyama, Kyoto": (35.0129, 135.6778),
    "Ryoan-ji": (35.0345, 135.7183),
    "Ryoan-ji, Ukyo, Kyoto": (35.0345, 135.7183),
    "Kinkaku-ji, Kita, Kyoto": (35.0394, 135.7292),
    "Kyoto Takashimaya S.C. 7F, Shijo-Kawaramachi, Kyoto": (35.0036, 135.7690),
    "Teramachi e Shinkyogoku, Nakagyo, Kyoto": (35.0058, 135.7676),
    "Fushimi-Inari Station": (34.9677, 135.7700),
    "Fushimi Inari Taisha, Fushimi, Kyoto": (34.9671, 135.7727),
    "JR Nara Station": (34.6810, 135.8197),
    "Todaiji Daibutsuden-Kasugataisha-mae": (34.6858, 135.8395),
    "Todai-ji, Nara": (34.6890, 135.8398),
    "Nigatsu-do, Todai-ji, Nara": (34.6894, 135.8435),
    "Kasuga Taisha, Nara": (34.6813, 135.8484),
    "Nara Park, Nara": (34.6851, 135.8430),
    "Kofuku-ji, Nara": (34.6830, 135.8318),
    "Osaka-Namba Station": (34.6667, 135.5003),
    "Kuromon Ichiba Market, Namba, Osaka": (34.6655, 135.5065),
    "Pokémon Center Osaka DX e Pokémon Café, Daimaru Shinsaibashi, Osaka": (34.6728, 135.5013),
    "Dotonbori, Namba, Osaka": (34.6687, 135.5013),
    "Umeda Station": (34.7036, 135.4983),
    "Universal City Station": (34.6676, 135.4354),
    "Universal Studios Japan, Konohana, Osaka": (34.6654, 135.4323),
    "Super Nintendo World, Universal Studios Japan, Osaka": (34.6688, 135.4302),
    "Osaka Station": (34.7025, 135.4959),
    "Osaka Station JR Expressway Bus Terminal, Osaka": (34.7036, 135.4955),
    "Nijigen no Mori, Awaji Island, Hyogo": (34.57558, 135.00460),
    "Osaka Castle, Chuo, Osaka": (34.6873, 135.5262),
    "Shinjuku Gyoen National Garden, Shinjuku, Tokyo": (35.6852, 139.7101),
    "Tokyo Metropolitan Government Building, Nishi-Shinjuku, Tokyo": (35.6896, 139.6922),
    "Hotel Gracery Shinjuku, Kabukicho, Tokyo": (35.6947, 139.7019),
    "Thermae-Yu, Kabukicho, Shinjuku, Tokyo": (35.6955, 139.7036),
    "Meiji Jingu, Shibuya, Tokyo": (35.6764, 139.6993),
    "Takeshita-dori, Harajuku, Tokyo": (35.6716, 139.7031),
    "Laforet Harajuku e Cat Street, Harajuku, Tokyo": (35.6687, 139.7055),
    "Omotesando, Tokyo": (35.6654, 139.7120),
    "Shibuya Parco 6F, Shibuya, Tokyo": (35.6620, 139.6987),
    "Shibuya 109 e Shibuya Loft, Shibuya, Tokyo": (35.6595, 139.6987),
    "Shibuya Sky, Shibuya Scramble Square, Tokyo": (35.6585, 139.7022),
    "Shibuya Scramble Crossing, Shibuya, Tokyo": (35.6595, 139.7005),
    "Tsukijishijo Station": (35.6650, 139.7663),
    "Tsukiji Outer Market, Chuo, Tokyo": (35.6655, 139.7707),
    "Ginza Itoya, Ginza, Tokyo": (35.6727, 139.7677),
    "Uniqlo Ginza, Ginza, Tokyo": (35.6704, 139.7637),
    "Hibiya Godzilla Square, Hibiya Chanter, Tokyo": (35.6731, 139.7591),
    "Nihonbashi Takashimaya S.C. 5F, Nihonbashi, Tokyo": (35.6812, 139.7744),
    "Tokyo Station, First Avenue B1, Tokyo": (35.6806, 139.7668),
    "Yotsuya Station": (35.6860, 139.7302),
    "Suga Shrine, Yotsuya, Shinjuku, Tokyo": (35.6858, 139.7235),
    "Nakano Broadway, Nakano, Tokyo": (35.7088, 139.6657),
    "Inokashira Park, Kichijoji, Tokyo": (35.6997, 139.5736),
    "Sun Road, Kichijoji, Tokyo": (35.7045, 139.5800),
    "Lumine, NEWoMan, Don Quijote e Bic Camera, Shinjuku, Tokyo": (35.6905, 139.7030),
    "Gotokuji Station": (35.6534, 139.6465),
    "Gotoku-ji, Setagaya, Tokyo": (35.6489, 139.6474),
    "Shimokitazawa, Setagaya, Tokyo": (35.6614, 139.6680),
    "Haneda Airport Terminal 3": (35.5444, 139.7686),
    "Haneda Airport Terminal 3, Tokyo": (35.5444, 139.7686),
}

# Luoghi da scrivere in modo più preciso (per "Portami lì" e per la ricerca). Si aggiungono dal file extra.
PLACE_FIX = {}

# Note del giorno, link, idee e prenotazioni stanno in un file a parte (non nel repository, che è pubblico):
#   {"links": {"Titolo tappa": "https://..."}, "dayNotes": {"2026-10-29": "..."},
#    "ideas": [{"title", "type", "place", "lat", "lng", "notes"}], "bookings": {"id": {...}}}
LINKS, DAY_NOTES, IDEAS, BOOKINGS = {}, {}, [], {}


def load_extra(path):
    global LINKS, DAY_NOTES, IDEAS, BOOKINGS
    e = json.load(open(path, encoding="utf-8"))
    LINKS, DAY_NOTES, BOOKINGS = e.get("links", {}), e.get("dayNotes", {}), e.get("bookings", {})
    # posizioni di hotel e ristoranti, e luoghi da riscrivere: privati, quindi nel file extra
    COORDS.update({k: tuple(v) for k, v in e.get("coords", {}).items()})
    PLACE_FIX.update(e.get("placeFix", {}))
    IDEAS = [(i["title"], i["type"], i["place"], (i["lat"], i["lng"]) if i.get("lat") is not None else None, i.get("notes", ""))
             for i in e.get("ideas", [])]


def day_id(label: str) -> str:
    m = re.match(r"\w+\s+(\d{1,2})\s+(ott|nov)", label.strip(), re.I)
    if not m:
        raise ValueError(f"Data non riconosciuta: {label!r}")
    return f"{YEAR}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"


def coords_for(place: str):
    if place in COORDS:
        return COORDS[place]
    if "→" in place:
        dest = place.split("→")[-1].strip()
        return COORDS.get(dest)
    return None


def clean_hotel(h: str) -> str:
    h = h.strip()
    if h.lower().startswith("nessuno"):
        return ""
    return h


def parse(md: str):
    days, stops = {}, {}
    cur = None
    for line in md.splitlines():
        h = re.match(r"^###\s+(.+?)\s+[–-]\s+(.+)$", line)
        if h:
            label = re.sub(r"\(.*?\)", "", h.group(1)).strip()
            cur = day_id(label)
            days[cur] = {"city": "", "title": h.group(2).strip(), "hotel": "", "notes": DAY_NOTES.get(cur, "")}
            n = 0
            continue
        if cur is None:
            continue
        c = re.match(r"^\*\*Città:\*\*\s*(.+?)\s*·\s*\*\*Alloggio:\*\*\s*(.+)$", line)
        if c:
            days[cur]["city"] = c.group(1).strip()
            days[cur]["hotel"] = clean_hotel(c.group(2))
            continue
        if line.startswith("|") and not line.startswith("| Ora") and not line.startswith("| ---"):
            cells = [x.strip() for x in line.strip().strip("|").split("|")]
            if len(cells) != 5 or not re.match(r"^\d{2}:\d{2}$", cells[0]):
                continue
            time, title, typ, place, notes = cells
            place = PLACE_FIX.get(place, place)
            if typ not in TYPES:
                raise ValueError(f"Tipo sconosciuto {typ!r} in {cur} {title}")
            n += 1
            doc = {
                "title": title, "type": typ, "dayId": cur, "time": time, "place": place, "notes": notes,
                "url": LINKS.get(title, ""), "status": "ok", "done": False, "order": n,
                "createdBy": "Marty", "createdAt": NOW,
            }
            ll = coords_for(place)
            if ll:
                doc["lat"], doc["lng"] = ll
            stops[f"{cur[5:7]}{cur[8:]}-{n:02d}"] = doc
        elif line.startswith("## ") and not line.startswith("### "):
            # una sezione nuova chiude il giorno solo se non è una sezione di giorni
            if any(k in line for k in ("Treni", "Spedizione", "Prenotazioni", "Info pratiche")):
                cur = None
    return days, stops


def main():
    src, out = sys.argv[1], sys.argv[2]
    if len(sys.argv) > 3:
        load_extra(sys.argv[3])
    md = open(src, encoding="utf-8").read()
    days, stops = parse(md)
    for i, (title, typ, place, ll, notes) in enumerate(IDEAS):
        d = {"title": title, "type": typ, "dayId": "", "time": "", "place": place, "notes": notes, "url": "",
             "status": "idea", "done": False, "order": 1000 + i, "createdBy": "Marty", "createdAt": NOW}
        if ll:
            d["lat"], d["lng"] = ll
        stops[f"idea-{i + 1:02d}"] = d
    data = {"version": 1, "meta": {"rate": 177, "rateDate": "2026-10-09"}, "days": days, "stops": stops,
            "bookings": BOOKINGS, "expenses": {}}
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    # riepilogo
    arrows_without_pos = [s["title"] for s in stops.values() if "→" in s["place"] and "lat" not in s]
    print(f"Giorni: {len(days)}  Tappe: {sum(1 for s in stops.values() if s['status'] == 'ok')}  "
          f"Idee: {len(IDEAS)}  Prenotazioni: {len(BOOKINGS)}  Con posizione: {sum(1 for s in stops.values() if 'lat' in s)}")
    if arrows_without_pos:
        print("ATTENZIONE, spostamenti senza coordinate:", arrows_without_pos)
    for d, v in sorted(days.items()):
        print(d, v["city"], "|", v["hotel"] or "—", "|", sum(1 for s in stops.values() if s["dayId"] == d), "tappe")


if __name__ == "__main__":
    main()
