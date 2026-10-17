import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, isOffHours } from "../src/lib/rules.js";

const oh = { enabled: true, tz: "Asia/Kolkata", start: 8, end: 18, days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
const noOh = { ...oh, enabled: false };
// 2026-10-07 is a Wednesday. 05:30Z = 11:00 IST (open), 17:30Z = 23:00 IST (closed).
const open = new Date("2026-10-07T05:30:00Z");
const closed = new Date("2026-10-07T17:30:00Z");
const sunday = new Date("2026-10-11T05:30:00Z");

test("isOffHours", () => {
  assert.equal(isOffHours(open, oh), false);
  assert.equal(isOffHours(closed, oh), true);
  assert.equal(isOffHours(sunday, oh), true);
  assert.equal(isOffHours(closed, noOh), false);
});
test("tamper is always an anomaly", () => {
  assert.deepEqual(evaluate({ eventType: "tamper", tamper: true, hasCheckout: false, now: open, offHours: noOh }),
    { reason: "Tamper switch triggered", status: "alert" });
});
test("exit without checkout -> missing", () => {
  assert.equal(evaluate({ eventType: "exit", tamper: false, hasCheckout: false, now: open, offHours: oh }).status, "missing");
});
test("authorized exit during hours is normal", () => {
  assert.equal(evaluate({ eventType: "exit", tamper: false, hasCheckout: true, now: open, offHours: oh }), null);
});
test("authorized exit off-hours is trusted", () => {
  assert.equal(evaluate({ eventType: "exit", tamper: false, hasCheckout: true, now: closed, offHours: oh }), null);
});
test("entry during hours is normal, off-hours is flagged", () => {
  assert.equal(evaluate({ eventType: "entry", tamper: false, hasCheckout: false, now: open, offHours: oh }), null);
  assert.equal(evaluate({ eventType: "entry", tamper: false, hasCheckout: false, now: closed, offHours: oh }).reason, "Movement outside business hours");
});
