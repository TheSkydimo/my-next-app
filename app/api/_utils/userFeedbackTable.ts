export async function ensureUserFeedbackTables(db: D1Database) {
  // Keep this aligned with `schema.sql`.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
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


