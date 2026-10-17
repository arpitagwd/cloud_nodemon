// Alerts via Azure Communication Services. Email always (if configured); SMS only if a number is configured.
// Unconfigured -> logs only, so local development works without ACS.
const COOLDOWN_MS = 5 * 60 * 1000;      // identical alert suppressed for 5 min (stops email floods)
const recent = new Map();

const list = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function sendAlert({ assetName, zoneName, eventType, reason, timestamp }) {
  const key = `${assetName}|${eventType}|${reason}`;
  if (Date.now() - (recent.get(key) ?? 0) < COOLDOWN_MS) { console.log(`[alert] suppressed duplicate: ${key}`); return; }
  recent.set(key, Date.now());

  const when = new Date(timestamp).toLocaleString("en-IN", { timeZone: process.env.BUSINESS_TZ || "Asia/Kolkata" });
  const subject = `[Nodemon] ${reason}: ${assetName}`;
  const text = `${reason}\n\nAsset: ${assetName}\nZone: ${zoneName}\nEvent: ${eventType}\nTime: ${when}\n`;
  const html = `<h2 style="color:#c9321e">${esc(reason)}</h2><table cellpadding="4">
    <tr><td><b>Asset</b></td><td>${esc(assetName)}</td></tr><tr><td><b>Zone</b></td><td>${esc(zoneName)}</td></tr>
    <tr><td><b>Event</b></td><td>${esc(eventType)}</td></tr><tr><td><b>Time</b></td><td>${esc(when)}</td></tr></table>`;

  const conn = process.env.ACS_CONNECTION_STRING;
  const jobs = [];
  if (conn && process.env.ALERT_FROM && list(process.env.ALERT_TO).length) {
    jobs.push((async () => {
      const { EmailClient } = await import("@azure/communication-email");
      await new EmailClient(conn).beginSend({
        senderAddress: process.env.ALERT_FROM,
        content: { subject, plainText: text, html },
        recipients: { to: list(process.env.ALERT_TO).map((address) => ({ address })) },
      });
    })());
  }
  if (conn && process.env.ACS_SMS_FROM && list(process.env.ALERT_SMS_TO).length) {
    jobs.push((async () => {
      const { SmsClient } = await import("@azure/communication-sms");
      await new SmsClient(conn).send({ from: process.env.ACS_SMS_FROM, to: list(process.env.ALERT_SMS_TO),
                                       message: `Nodemon: ${reason} - ${assetName} (${zoneName})` });
    })());
  }
  if (!jobs.length) { console.log(`[ALERT not sent: ACS not configured] ${subject} | ${zoneName} | ${when}`); return; }

  // Alerts must never break event processing: log failures, don't throw.
  (await Promise.allSettled(jobs)).forEach((r) => r.status === "rejected" && console.error("[alert] send failed:", r.reason?.message));
}
