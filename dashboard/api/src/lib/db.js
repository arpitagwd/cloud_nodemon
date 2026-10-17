const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  connectionTimeoutMillis: 5000,
});
const limitOf = (v, fallback, max = 200) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), max) : fallback;
};
// Run a handler, log real errors server-side, return a generic 500 (no DB details leak).
const safe = (fn) => async (request, context) => {
  try { return await fn(request, context); }
  catch (err) { context.error(`${request.method} ${request.url}:`, err); return { status: 500, jsonBody: { error: "Internal server error" } }; }
};
module.exports = { pool, limitOf, safe };
