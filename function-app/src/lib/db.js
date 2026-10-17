import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  connectionTimeoutMillis: 5000, // fail fast so Azure can retry
});

// Availability errors are worth retrying; anything else would fail again.
const TRANSIENT = new Set(["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "57P03", "53300"]);
export const isTransient = (e) =>
  TRANSIENT.has(e?.code) || /timeout|terminated unexpectedly/i.test(e?.message || "") || String(e?.code || "").startsWith("08");
