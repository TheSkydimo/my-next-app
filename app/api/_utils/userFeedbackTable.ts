export async function ensureUserFeedbackTables(db: D1Database) {
  // Keep this aligned with `schema.sql`.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_email TEXT,
        type TEXT,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unread',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP,
        latest_reply_at TIMESTAMP,
        latest_reply_admin_id INTEGER,
        closed_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    )
    .run();

  // Light-weight runtime migration for existing D1 instances.
  // D1/SQLite doesn't support `ADD COLUMN IF NOT EXISTS`, so we probe via PRAGMA first.
  try {
    const info = await db.prepare("PRAGMA table_info(user_feedback)").all();
    const cols = (info?.results as Array<{ name?: string }> | undefined) ?? [];
    const hasEmail = cols.some((c) => String(c?.name ?? "") === "user_email");
    if (!hasEmail) {
      await db.prepare("ALTER TABLE user_feedback ADD COLUMN user_email TEXT").run();
    }
  } catch {
    // Best-effort: never block app start due to migration probe failures.
  }

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_user_feedback_user
       ON user_feedback (user_id, created_at DESC)`
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_user_feedback_status
       ON user_feedback (status, created_at DESC)`
    )
    .run();
}


