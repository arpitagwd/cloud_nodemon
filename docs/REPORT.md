# Nodemon: Real-Time Asset Tracking & Theft Prevention System
Cloud Computing Lab + IoT Lab, joint project. Team: Arpita Gawade, Divya Gurav. Platform: Microsoft Azure.

## 1. Problem and goal
College IT assets (laptops, monitors, routers) move between departments with no live record, so theft or unauthorised movement is noticed late.
Nodemon tracks each asset's zone in real time with low-cost BLE tags and ESP32 gateways, flags suspicious movement automatically and alerts staff.

## 2. Architecture
BLE tag -> ESP32 gateway (one per department) -> Azure IoT Hub (MQTT) -> Azure Functions -> Azure PostgreSQL <- Azure Static Web Apps (React dashboard + API).
Alerts go out through Azure Communication Services. Infrastructure is described in Terraform.

| Layer | Component | Role |
|---|---|---|
| Tag | ESP32 + push-button tamper switch | Broadcasts a 7-byte BLE packet every ~13 s, deep sleep in between |
| Gateway | ESP32 (3 units, one per zone) | Scans, filters by RSSI, detects entry/exit with debouncing, deduplicates, buffers offline, publishes JSON |
| Ingestion | IoT Hub (free tier) | One device identity per gateway, MQTT over TLS |
| Processing | Azure Function (IoT Hub trigger) | Writes the event, applies anomaly rules, updates asset state, calls the alerter, retries on DB outage |
| Monitoring | Azure Function (timer, 2 min) | Detects offline gateways and silent assets |
| Storage | PostgreSQL Flexible Server | zones, assets, events (append-only log), authorized_checkouts |
| API + UI | Static Web Apps (managed Functions + React) | /api/zones, /events, /alerts, /assets/{id}/events; live dashboard |

## 3. Design decisions
- **Single relational database:** the data is relational and low volume; NoSQL would add complexity with no benefit.
- **Edge filtering:** the gateway publishes only on state change plus a 2-minute heartbeat, cutting messages and cost; a 30-event offline buffer prevents data loss.
- **Anomaly rules (server side):** (1) exit without a valid authorized checkout, (2) tamper flag, (3) entry/exit outside business hours, (4) gateway silent, (5) asset not reported for a set time.
- **Reliability:** per-message processing with retry on database outages; alerts are sent after commit so an email failure cannot lose an event; duplicate alerts are suppressed for 5 minutes.
- **Cost:** everything runs on free or student-credit tiers. No Blob Storage: the full event log stays in PostgreSQL.
- **Motion sensing:** the final hardware uses a push-button tamper switch rather than the MPU6050 proposed in the BRD, so motion_flag mirrors the button event.

## 4. Testing
Unit tests cover the anomaly rules (6 cases, all passing). End-to-end tests: simulated gateway messages through IoT Hub to PostgreSQL, authorized and unauthorised exits, tamper, offline gateway, and a multi-gateway load run (tools/load-sim.mjs).

| Test | Result |
|---|---|
| Unauthorised exit -> anomaly + asset missing + alert | Verified with a simulated gateway message |
| Load run: 3 gateways, ack latency p50 / p95 | *Record after running load-sim.mjs* |
| Tag -> dashboard latency with real hardware | *Record during integration testing* |

## 5. Limitations and future work
BLE RSSI is noisy, so thresholds need tuning per doorway; the free IoT Hub tier is capped at 8,000 messages per day; the dashboard API is read-only and public (add authentication for production); an accelerometer would give true motion detection; more departments need one more gateway each and no cloud change.
