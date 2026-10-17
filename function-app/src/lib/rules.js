// Pure anomaly rules: no I/O, so they are unit-tested (test/rules.test.js).

export function isOffHours(date, oh) {
  if (!oh.enabled) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: oh.tz, weekday: "short", hour: "numeric", hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday").value;
  const hour = Number(parts.find((p) => p.type === "hour").value);
  return !oh.days.includes(weekday) || hour < oh.start || hour >= oh.end;
}

// Returns null (normal) or { reason, status } where status is the asset status to apply.
export function evaluate({ eventType, tamper, hasCheckout, now, offHours }) {
  if (tamper) return { reason: "Tamper switch triggered", status: "alert" };
  if (eventType === "exit" && !hasCheckout)
    return { reason: "Left the zone without an authorized checkout", status: "missing" };
  const authorizedExit = eventType === "exit" && hasCheckout;
  if ((eventType === "entry" || eventType === "exit") && !authorizedExit && isOffHours(now, offHours))
    return { reason: "Movement outside business hours", status: "alert" };
  return null;
}
