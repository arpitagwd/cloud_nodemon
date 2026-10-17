# Nodemon: demo script (about 6 minutes)

**Before you start (15 min earlier):** 3 gateways powered in 3 rooms/desks and on the phone hotspot; Serial Monitor shows
`[mqtt] connect ok` on each; dashboard open on the projector; 2-3 tags charged; one `authorized_checkouts` row prepared for
tag 2 (see step 4); `OFFHOURS_ENABLED=false` if the demo is outside 08:00-18:00 IST.

| Min | Do | Say / show |
|---|---|---|
| 0:00 | Dashboard, all green | "Each department is a zone with its own ESP32 gateway. Three independent sources, one cloud pipeline." Point at the three gateway-online pills. |
| 1:00 | Carry tag 1 into the CS1 gateway range | Within ~5-10 s the asset appears as an entry in Recent activity. "Gateway filtered duplicates, published over MQTT to IoT Hub, an Azure Function wrote it to PostgreSQL." Point at the latency counter. |
| 2:00 | Walk tag 1 out of range | "Exit with no authorized checkout" -> asset turns red/missing, alert history gets a row, **email arrives** (show phone/laptop). |
| 3:00 | Press the tamper button on tag 3 | Instant tamper event, asset red, second email. "On a real tag this is the lid/anti-removal switch." |
| 4:00 | Authorized exit: run the prepared SQL, then walk tag 2 out | Same action but no alert: "Anomaly rule checks authorized_checkouts." Asset shows "checked out". |
| 5:00 | Unplug gateway 3 | Within ~6 min dashboard shows Gateway offline (say this in advance, or lower GATEWAY_OFFLINE_MINUTES to 2 for the demo). |
| 5:30 | Click an asset | Per-asset movement timeline and incident count. |
| 6:00 | Architecture slide | Scales by adding one gateway per department, no cloud change. |

**Prepared SQL (step 4)**
```sql
INSERT INTO authorized_checkouts (asset_id, approved_by, valid_from, valid_until)
VALUES (2, 'demo', now() - interval '5 minutes', now() + interval '30 minutes');
```
**Reset between runs**
```sql
UPDATE assets SET status='ok', checked_out=false;
UPDATE zones SET gateway_online=true;
DELETE FROM authorized_checkouts WHERE approved_by='demo';
```
**If something fails:** Wi-Fi down -> gateways buffer up to 30 events and flush on reconnect. Email slow -> show the alert row in the dashboard.
Fallback for a dead tag: `node tools/send.mjs exit 1` produces the same event as a real gateway.
