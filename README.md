# Nodemon (full project)

```
dashboard/          React dashboard + api/ (Static Web Apps managed functions) + public/staticwebapp.config.json
function-app/       IoT Hub processor, monitor timer, email/SMS alerts (Azure Functions)
gateway-firmware/   ESP32 gateway sketch (flash 3x, different secrets.h)
tag-firmware/       ESP32 tag sketch (push-button tamper, deep sleep). Set TAG_ID per tag
db/                 002_extensions.sql  (run once after the existing schema)
terraform/          IaC for the whole stack + create-devices scripts
tools/              send.mjs (fake gateway), load-sim.mjs (load test)
docs/               DEMO.md, REPORT.md
.github/workflows/  Static Web Apps deploy
```

## Final architecture (nothing runs on a laptop)
Tags -> ESP32 gateways -> IoT Hub -> Function App (processTelemetry + monitor) -> PostgreSQL <- Static Web Apps (/api + dashboard).
Alerts: Azure Communication Services. No Blob Storage (event log is in PostgreSQL).

## Order of work
1. `psql "<conn>" -f db/002_extensions.sql`
2. `cd function-app && npm install && npm test`; `func start` (+ Azurite) and test with `tools/send.mjs`.
3. Dashboard: `cd dashboard && npm install`; mock mode `npm run dev`; real data: `cd api && npm install && func start`, then `VITE_USE_MOCK=false`.
4. Flash gateways (see sketch header) and tags (`SELECT asset_id, tag_id FROM assets;` to pick TAG_ID).
5. Deploy: `terraform apply` (or reuse existing resources), `func azure functionapp publish <name>`, push to GitHub for the Static Web Apps workflow.
6. Postgres firewall: enable "Allow public access from any Azure service".

## Notes
- IoT Hub free tier: 8,000 messages/day. Heartbeats from 3 gateways are ~2,200/day.
- Off-hours rule: set OFFHOURS_ENABLED=false (or change BUSINESS_* hours) when demoing outside 08:00-18:00 IST Mon-Sat.
- Rotate any device key that was ever pasted in chat or committed.
