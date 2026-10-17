const { app } = require("@azure/functions");
const { pool, limitOf, safe } = require("../lib/db");

// Gateway-level events have no asset, so label them by zone.
const EVENT_COLS = `e.id, e.asset_id, COALESCE(a.asset_name, 'Gateway ' || e.zone_id) AS asset_name,
  e.zone_id, e.event_type, e.is_anomaly, e.created_at`;
const EVENT_FROM = "FROM events e LEFT JOIN assets a ON a.asset_id = e.asset_id";

const get = (name, route, handler) =>
  app.http(name, { methods: ["GET"], authLevel: "anonymous", route, handler: safe(handler) });

// Format #4 plus additive fields: zone.gateway_online, asset.checked_out, asset.last_seen.
get("zones", "zones", async () => {
  const { rows } = await pool.query(`
    SELECT z.zone_id, z.zone_name, z.gateway_online,
      COALESCE(json_agg(json_build_object(
        'asset_id', a.asset_id, 'asset_name', a.asset_name, 'status', a.status,
        'checked_out', a.checked_out, 'last_seen', a.last_seen
      ) ORDER BY a.asset_id) FILTER (WHERE a.asset_id IS NOT NULL), '[]') AS assets
    FROM zones z
    LEFT JOIN assets a ON COALESCE(a.current_zone_id, a.home_zone_id) = z.zone_id
    GROUP BY z.zone_id, z.zone_name, z.gateway_online
    ORDER BY z.zone_id`);
  return { jsonBody: rows };
});

get("events", "events", async (req) => {
  const { rows } = await pool.query(
    `SELECT ${EVENT_COLS} ${EVENT_FROM} ORDER BY e.created_at DESC, e.id DESC LIMIT $1`,
    [limitOf(req.query.get("limit"), 50)]);
  return { jsonBody: rows };
});

get("alerts", "alerts", async (req) => {
  const { rows } = await pool.query(
    `SELECT ${EVENT_COLS} ${EVENT_FROM} WHERE e.is_anomaly ORDER BY e.created_at DESC, e.id DESC LIMIT $1`,
    [limitOf(req.query.get("limit"), 20)]);
  return { jsonBody: rows };
});

// New: per-asset movement timeline and incident log (BRD "historical analytics").
get("assetHistory", "assets/{id}/events", async (req) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return { status: 400, jsonBody: { error: "asset id must be an integer" } };
  const asset = (await pool.query(
    `SELECT asset_id, asset_name, status, home_zone_id, current_zone_id, checked_out, last_seen
     FROM assets WHERE asset_id = $1`, [id])).rows[0];
  if (!asset) return { status: 404, jsonBody: { error: "asset not found" } };
  const events = (await pool.query(
    `SELECT id, zone_id, event_type, is_anomaly, motion_flag, tamper_flag, battery_pct, rssi, created_at
     FROM events WHERE asset_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
    [id, limitOf(req.query.get("limit"), 100, 500)])).rows;
  return { jsonBody: { asset, events } };
});

get("health", "health", async () => {
  await pool.query("SELECT 1");
  return { jsonBody: { ok: true } };
});
