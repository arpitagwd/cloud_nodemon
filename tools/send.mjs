// Fake gateway: sends one message to IoT Hub as a real device.
//   $env:DEVICE_CS="HostName=...;DeviceId=esp32-dept-cs-01;SharedAccessKey=..."
//   node send.mjs exit 1          (event type, tag_id)
//   node send.mjs tamper 3
//   node send.mjs heartbeat 1,2   (heartbeat listing tags present)
import pkg from "azure-iot-device";
import mqttPkg from "azure-iot-device-mqtt";
const { Client, Message } = pkg;
const { Mqtt } = mqttPkg;

const cs = process.env.DEVICE_CS;
if (!cs) { console.error("Set DEVICE_CS first."); process.exit(1); }
const deviceId = /DeviceId=([^;]+)/.exec(cs)[1];
const zone = "DEPT_CS" + deviceId.slice(-1); // esp32-dept-cs-01 -> DEPT_CS1
const [type = "exit", arg = "1"] = process.argv.slice(2);

const body = { gateway_id: deviceId, zone_id: zone, event_type: type, timestamp: new Date().toISOString() };
if (type === "heartbeat") body.tags_present = arg.split(",").map(Number);
else Object.assign(body, { tag_id: Number(arg), motion_flag: 1, tamper_flag: type === "tamper" ? 1 : 0, battery_pct: 82, rssi: -67 });

const client = Client.fromConnectionString(cs, Mqtt);
const msg = new Message(JSON.stringify(body));
msg.contentType = "application/json";
msg.contentEncoding = "utf-8";
await client.sendEvent(msg);
console.log("sent", body);
await client.close();
