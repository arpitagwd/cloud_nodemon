import { useEffect, useState, useCallback } from "react";
import { get } from "./api.js";

const POLL_MS = 5000;
const STATUS_LABEL = { ok: "In place", alert: "Alert", missing: "Missing" };
const EVENT_LABEL = { entry: "Entered", exit: "Left", tamper: "Tamper switch", silent: "Went silent", gateway_offline: "Gateway offline" };

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
function age(iso, now) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function ZoneColumn({ zone, onPick }) {
  const bad = zone.assets.filter((a) => a.status !== "ok").length;
  return (
    <section className={`zone ${bad || !zone.gateway_online ? "zone-bad" : ""}`} aria-label={zone.zone_name}>
      <header>
        <h2>{zone.zone_name}</h2>
        <p>
          <span className={`pill ${zone.gateway_online ? "pill-ok" : "pill-bad"}`}>
            {zone.gateway_online ? "Gateway online" : "Gateway offline"}
          </span>{" "}
          {bad ? `${bad} of ${zone.assets.length} need attention` : `All ${zone.assets.length} assets in place`}
        </p>
      </header>
      <ul>
        {zone.assets.map((a) => (
          <li key={a.asset_id}>
            <button className={`asset s-${a.status}`} onClick={() => onPick(a.asset_id)} aria-label={`History for ${a.asset_name}`}>
              <span className="dot" aria-hidden="true" />
              <span className="name">{a.asset_name}{a.checked_out && <em className="co"> · checked out</em>}</span>
              <span className="badge">{STATUS_LABEL[a.status] || a.status}</span>
            </button>
          </li>
        ))}
        {zone.assets.length === 0 && <li className="empty">No assets assigned to this zone.</li>}
      </ul>
    </section>
  );
}

function EventList({ items, now, empty }) {
  if (!items.length) return <p className="empty">{empty}</p>;
  return (
    <ol className="events">
      {items.map((e) => (
        <li key={e.id} className={e.is_anomaly ? "anomaly" : ""}>
          <div>
            <strong>{e.asset_name}</strong>
            <span>{EVENT_LABEL[e.event_type] || e.event_type} · {e.zone_id}</span>
          </div>
          <time dateTime={e.created_at} title={new Date(e.created_at).toLocaleString()}>{age(e.created_at, now)}</time>
        </li>
      ))}
    </ol>
  );
}

function History({ id, now, onClose }) {
  const [h, setH] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let live = true;
    get(`/api/assets/${id}/events`, { limit: 100 }).then((r) => live && setH(r.data)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [id]);
  const incidents = h ? h.events.filter((e) => e.is_anomaly).length : 0;
  return (
    <aside className="drawer" role="dialog" aria-label="Asset history">
      <button className="close" onClick={onClose} aria-label="Close history">×</button>
      {err && <p className="empty">Couldn't load history: {err}</p>}
      {!h && !err && <p className="empty">Loading…</p>}
      {h && (<>
        <h2>{h.asset.asset_name}</h2>
        <p className="meta">{STATUS_LABEL[h.asset.status]} · home {h.asset.home_zone_id} · {incidents} incident{incidents === 1 ? "" : "s"} · last battery {h.events[0]?.battery_pct ?? "?"}%</p>
        <EventList items={h.events.map((e) => ({ ...e, asset_name: EVENT_LABEL[e.event_type] || e.event_type }))} now={now}
          empty="No movement recorded for this asset yet." />
      </>)}
    </aside>
  );
}

export default function App() {
  const [zones, setZones] = useState([]);
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [lastOk, setLastOk] = useState(null);
  const [latency, setLatency] = useState(null);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState(null);
  const now = useNow();

  const refresh = useCallback(async () => {
    try {
      const [z, e, a] = await Promise.all([get("/api/zones"), get("/api/events", { limit: 50 }), get("/api/alerts", { limit: 20 })]);
      setZones(z.data); setEvents(e.data); setAlerts(a.data);
      setLatency(Math.max(z.ms, e.ms, a.ms)); setLastOk(Date.now()); setError(null);
    } catch (err) { setError(err.message); } finally { setLoaded(true); }
  }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, POLL_MS); return () => clearInterval(t); }, [refresh]);

  const flagged = zones.reduce((n, z) => n + z.assets.filter((a) => a.status !== "ok").length, 0);
  const offline = zones.filter((z) => !z.gateway_online).length;
  const problems = flagged + offline;

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Nodemon</h1>
          <p className={problems ? "summary bad" : "summary"}>
            {!loaded ? "Loading…" : problems
              ? [flagged && `${flagged} asset${flagged > 1 ? "s" : ""} need attention`, offline && `${offline} gateway${offline > 1 ? "s" : ""} offline`].filter(Boolean).join(" · ")
              : "Every asset is where it should be"}
          </p>
        </div>
        <div className={`live ${error ? "down" : ""}`} role="status">
          <span className="pulse" aria-hidden="true" />
          {error ? "Can't reach the API" : lastOk ? `Updated ${Math.round((now - lastOk) / 1000)}s ago · ${latency} ms` : "Connecting…"}
        </div>
      </header>
      {error && <div className="banner">Couldn't refresh: {error}. Showing the last data received. Retrying every {POLL_MS / 1000}s.</div>}
      <main>
        <div className="zones">{zones.map((z) => <ZoneColumn key={z.zone_id} zone={z} onPick={setPicked} />)}</div>
        <div className="panels">
          <section className="panel">
            <h2>Recent activity</h2>
            <EventList items={events} now={now} empty="No events yet. Move a tag near a gateway to see activity." />
          </section>
          <section className="panel">
            <h2>Alert history</h2>
            <EventList items={alerts} now={now} empty="No alerts. Unauthorised exits, tampering and silent assets appear here." />
          </section>
        </div>
      </main>
      {picked && <History id={picked} now={now} onClose={() => setPicked(null)} />}
    </div>
  );
}
