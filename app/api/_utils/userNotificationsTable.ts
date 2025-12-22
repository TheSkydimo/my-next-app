export type UserNotificationLevel = "info" | "warn" | "critical";

export type UserNotificationRow = {
  id: number;
  user_id: number;
  type: string;
  level: UserNotificationLevel;
  title: string;
  body: string;
  link_url: string | null;
  meta_json: string | null;
  is_read: number;
  created_at: string;
  read_at: string | null;
};

export async function ensureUserNotificationsTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        link_url TEXT,
        meta_json TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    )
    .run();

  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created ON user_notifications (user_id, created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read ON user_notifications (user_id, is_read, created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_user_notifications_type_created ON user_notifications (type, created_at DESC)"
    )
    .run();
}


