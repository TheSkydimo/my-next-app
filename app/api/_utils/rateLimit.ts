/**
 * Simple fixed-window rate limiter backed by D1 (SQLite).
 *
 * - key: caller identifier (avoid storing raw PII; prefer hashes)
 * - windowSeconds: fixed window size
 * - limit: max allowed events per window
 *
 * Returns: { allowed, remaining, resetAtEpochSeconds }
 */
export async function consumeRateLimit(opts: {
  db: D1Database;
  key: string;
  windowSeconds: number;
  limit: number;
}): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const { db, key, windowSeconds, limit } = opts;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const resetAt = windowStart + windowSeconds;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL
      )`
    )
    .run();

  // Atomic-ish upsert: if window_start changed, reset count to 1; else increment.
  await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count)
       VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE
           WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1
           ELSE 1
         END,
         window_start = excluded.window_start`
    )
    .bind(key, windowStart)
    .run();

  const { results } = await db
    .prepare("SELECT count, window_start FROM rate_limits WHERE key = ? LIMIT 1")
    .bind(key)
    .all<{ count: number; window_start: number }>();

  const row = results?.[0];
  const count = row?.count ?? 1;
  const remaining = Math.max(0, limit - count);
  const allowed = count <= limit;

  return { allowed, remaining, resetAt };
}


