export type UserOrdersReviewStatus = "pending" | "approved" | "rejected";

/**
 * Ensure `user_orders` table exists and has all required columns.
 *
 * Notes:
 * - Keep D1 SQL simple and resilient to partial migrations.
 * - Do NOT add foreign keys here (can break on some D1 runtimes/migrations).
 */
export async function ensureUserOrdersTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        order_no TEXT,
        order_created_time TEXT,
        order_paid_time TEXT,
        platform TEXT,
        shop_name TEXT,
        device_count INTEGER,
        upload_lang TEXT,
        upload_tz TEXT,
        review_status TEXT DEFAULT 'pending',
        reviewed_at TEXT,
        reviewed_by INTEGER,
        review_note TEXT
      )`
    )
    .run();

  await db
    .prepare("CREATE INDEX IF NOT EXISTS idx_user_orders_user ON user_orders (user_id)")
    .run();
  await db
    .prepare("CREATE INDEX IF NOT EXISTS idx_user_orders_order_no ON user_orders (order_no)")
    .run();

  // Best-effort migrations for older tables.
  const alter = async (sql: string) => {
    try {
      await db.prepare(sql).run();
    } catch {
      // ignore
    }
  };

  await alter("ALTER TABLE user_orders ADD COLUMN order_no TEXT");
  await alter("ALTER TABLE user_orders ADD COLUMN order_created_time TEXT");
  await alter("ALTER TABLE user_orders ADD COLUMN order_paid_time TEXT");
  await alter("ALTER TABLE user_orders ADD COLUMN platform TEXT");
  await alter("ALTER TABLE user_orders ADD COLUMN shop_name TEXT");
  await alter("ALTER TABLE user_orders ADD COLUMN device_count INTEGER");
  await alter("ALTER TABLE user_orders ADD COLUMN upload_lang TEXT");
  await alter("ALTER TABLE user_orders ADD COLUMN upload_tz TEXT");
  await alter("ALTER TABLE user_orders ADD COLUMN review_status TEXT");
  await alter("ALTER TABLE user_orders ADD COLUMN reviewed_at TEXT");
  await alter("ALTER TABLE user_orders ADD COLUMN reviewed_by INTEGER");
  await alter("ALTER TABLE user_orders ADD COLUMN review_note TEXT");
}


