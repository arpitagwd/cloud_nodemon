// Load simulation: several fake gateways publish concurrently; reports throughput and IoT Hub ack latency.
//   $env:DEVICE_CS_1="..."; $env:DEVICE_CS_2="..."; $env:DEVICE_CS_3="..."
//   node load-sim.mjs --msgs 40 --interval 500          (safe default: entry + heartbeat only)
//   node load-sim.mjs --msgs 40 --interval 500 --chaos  (adds exits and tampers: sends alert emails!)
// Free IoT Hub allows 8,000 messages/day in total: keep runs short.
import pkg from "azure-iot-device";
import mqttPkg from "azure-iot-device-mqtt";
const { Client, Message } = pkg;
const { Mqtt } = mqttPkg;

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const MSGS = arg("msgs", 40), INTERVAL = arg("interval", 500), CHAOS = process.argv.includes("--chaos");
const strings = [1, 2, 3].map((n) => process.env[`DEVICE_CS_${n}`]).filter(Boolean);
if (!strings.length) { console.error("Set DEVICE_CS_1..3 first."); process.exit(1); }

const lat = []; let failed = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gateway(cs, idx) {
  const deviceId = /DeviceId=([^;]+)/.exec(cs)[1];
  const zone = "DEPT_CS" + deviceId.slice(-1);
  const client = Client.fromConnectionString(cs, Mqtt);
  const tagA = idx * 2 + 1, tagB = idx * 2 + 2;   // the two seeded assets of this zone (tag ids 1-6)
  for (let i = 0; i < MSGS; i++) {
    const types = CHAOS ? ["entry", "heartbeat", "tamper", "exit"] : ["entry", "heartbeat"];
    const type = types[i % types.length];
    const body = { gateway_id: deviceId, zone_id: zone, event_type: type, timestamp: new Date().toISOString() };
    if (type === "heartbeat") body.tags_present = [tagA, tagB];
    else Object.assign(body, { tag_id: i % 2 ? tagA : tagB, motion_flag: 0, tamper_flag: type === "tamper" ? 1 : 0, battery_pct: 80, rssi: -60 });
    const m = new Message(JSON.stringify(body)); m.contentType = "application/json"; m.contentEncoding = "utf-8";
    const t0 = performance.now();
    try { await client.sendEvent(m); lat.push(performance.now() - t0); } catch { failed++; }
    await sleep(INTERVAL);
  }
  await client.close();
}

const t0 = performance.now();
await Promise.all(strings.map(gateway));
const secs = (performance.now() - t0) / 1000;
lat.sort((a, b) => a - b);
const p = (q) => lat.length ? Math.round(lat[Math.min(lat.length - 1, Math.floor(q * lat.length))]) : NaN;
console.log(`gateways=${strings.length} sent=${lat.length} failed=${failed} duration=${secs.toFixed(1)}s ` +
            `rate=${(lat.length / secs).toFixed(1)} msg/s  ack latency ms: p50=${p(0.5)} p95=${p(0.95)} max=${p(1)}`);
