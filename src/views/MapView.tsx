import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { DayStrip, Empty } from "../components/bits";
import { CITIES, TYPES, typeOf } from "../lib/constants";
import { fmtShort } from "../lib/format";
import { hasPos, mapsLink, nearestCity, routeLink, type LatLng } from "../lib/geo";
import { dayStops, useTrip } from "../store";
import { useUi } from "../ui";
import type { Stop } from "../types";

type Sel = "all" | `city:${string}` | `day:${string}`;

function pinIcon(s: Stop, label: string | number, emoji: boolean) {
  const t = typeOf(s.type);
  return L.divIcon({
    className: "",
    html: `<div class="nq-pin ${emoji ? "emoji" : ""}" style="background:var(--t-${t})">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
}

const meIcon = L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

/** Scritta di OpenStreetMap più piccola, senza il marchio di Leaflet. */
function SmallAttribution() {
  const map = useMap();
  useEffect(() => { map.attributionControl.setPrefix(false); }, [map]);
  return null;
}

/** Inquadra i punti ogni volta che cambia la selezione. */
function FitBounds({ points, keyId }: { points: LatLng[]; keyId: string }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) { map.setView([35.2, 137.5], 6); return; }
    if (points.length === 1) { map.setView([points[0].lat, points[0].lng], 15); return; }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [36, 36], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyId, points.length]);
  return null;
}

function FlyTo({ to }: { to: LatLng | null }) {
  const map = useMap();
  useEffect(() => { if (to) map.flyTo([to.lat, to.lng], 16); }, [to, map]);
  return null;
}

export function MapView() {
  const { days, stops } = useTrip();
  const { day, setDay, open } = useUi();
  const [sel, setSel] = useState<Sel>(day ? `day:${day}` : "all");
  const [me, setMe] = useState<LatLng | null>(null);
  const [locErr, setLocErr] = useState<string | null>(null);

  const isDay = sel.startsWith("day:");
  const pts = useMemo(() => {
    if (sel.startsWith("day:")) return dayStops(stops, sel.slice(4)).filter((s) => s.status === "ok");
    if (sel.startsWith("city:")) {
      const c = sel.slice(5);
      return stops.filter((s) => hasPos(s) && s.status !== "proposed" && nearestCity(s as LatLng) === c);
    }
    return stops.filter((s) => s.status !== "proposed");
  }, [sel, stops]);
  const withPos = pts.filter(hasPos) as (Stop & LatLng)[];
  const noPos = pts.filter((s) => !hasPos(s));
  const route = isDay ? routeLink(withPos) : null;

  const locate = () => {
    setLocErr(null);
    if (!navigator.geolocation) { setLocErr("Il telefono non condivide la posizione."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setLocErr("Posizione non disponibile: controlla i permessi del browser."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  if (!days.length) return <Empty title="La mappa si riempie con l'itinerario." />;

  return (
    <>
      <div className="seg" role="toolbar" aria-label="Cosa mostrare">
        <button className="mchip" aria-pressed={sel === "all"} onClick={() => setSel("all")}>Tutto</button>
        {CITIES.map((c) => (
          <button key={c.name} className="mchip" aria-pressed={sel === `city:${c.name}`} onClick={() => setSel(`city:${c.name}`)}>{c.name}</button>
        ))}
      </div>
      <DayStrip days={days} isSelected={(id) => sel === `day:${id}`} onPick={(id) => { setSel(`day:${id}`); setDay(id); }} />

      <div className="mapwrap" style={{ position: "relative" }}>
        <MapContainer className="leafmap" center={[35.2, 137.5]} zoom={6} scrollWheelZoom zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <SmallAttribution />
          <FitBounds points={withPos} keyId={sel} />
          <FlyTo to={me} />
          {isDay && withPos.length > 1 && (
            <Polyline positions={withPos.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#FF3D7F", weight: 3, dashArray: "6 8", opacity: 0.85 }} />
          )}
          {withPos.map((s, i) => (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={pinIcon(s, isDay ? i + 1 : TYPES[typeOf(s.type)].icon, !isDay)}>
              <Popup>
                <div className="popup">
                  <b>{s.title}</b>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{[s.dayId ? fmtShort(s.dayId) : "Wishlist", s.time].filter(Boolean).join(" · ")}</div>
                  <div className="row">
                    <a className="btn small primary" href={mapsLink(s)} target="_blank" rel="noopener">Portami lì</a>
                    <button className="btn small" onClick={() => open({ kind: "stop", id: s.id })}>Dettagli</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
          {me && <Marker position={[me.lat, me.lng]} icon={meIcon} />}
        </MapContainer>
        <div className="map-tools">
          <button className="btn small" onClick={locate} aria-label="Mostra dove sono">📍 Io</button>
        </div>
      </div>
      {locErr && <p className="err">{locErr}</p>}

      {route && <a className="btn blue block" href={route} target="_blank" rel="noopener">Apri il giro del giorno in Google Maps</a>}

      <div className="plist">
        {withPos.map((s, i) => (
          <div key={s.id} className={`pitem type-${typeOf(s.type)}`}>
            <span className="n num" style={{ background: `var(--t-${typeOf(s.type)})` }}>{isDay ? i + 1 : TYPES[typeOf(s.type)].icon}</span>
            <button className="t plain" onClick={() => open({ kind: "stop", id: s.id })}>
              <b>{s.title}</b>
              <small>{[s.dayId ? fmtShort(s.dayId) : "Wishlist", s.time].filter(Boolean).join(" · ")}</small>
            </button>
            <a className="btn small" href={mapsLink(s)} target="_blank" rel="noopener">Portami lì</a>
          </div>
        ))}
      </div>
      {noPos.length > 0 && (
        <p className="hint">
          Non sulla mappa (si aprono in Google Maps per nome):{" "}
          {noPos.map((s) => <button key={s.id} className="chip" style={{ margin: 2 }} onClick={() => open({ kind: "stop", id: s.id })}>{s.title}</button>)}
        </p>
      )}
    </>
  );
}
