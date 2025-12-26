export type UserNotificationLevel = "info" | "warn" | "critical";

export type UserNotificationAudienceLang = "zh" | "en" | "both";

export type UserNotificationRow = {
  id: number;
  user_id: number;
  event_id: number | null;
  type: string;
  level: UserNotificationLevel;
  audience_lang: UserNotificationAudienceLang | null;
  title: string;
  body: string;
  title_zh: string | null;
  body_zh: string | null;
  title_en: string | null;
  body_en: string | null;
  link_url: string | null;
  meta_json: string | null;
  is_deleted: number;
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
        event_id INTEGER,
        type TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        audience_lang TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        title_zh TEXT,
        body_zh TEXT,
        title_en TEXT,
        body_en TEXT,
        link_url TEXT,
        meta_json TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    )
    .run();

  // Best-effort: add columns for existing deployments.
  // NOTE: D1 supports "ALTER TABLE ... ADD COLUMN ...", but it will throw if column exists.
  const addColumn = async (sql: string, duplicateMsg: string) => {
    try {
      await db.prepare(sql).run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes(duplicateMsg)) throw e;
    }
  };
  await addColumn("ALTER TABLE user_notifications ADD COLUMN event_id INTEGER", "duplicate column name: event_id");
  await addColumn("ALTER TABLE user_notifications ADD COLUMN audience_lang TEXT", "duplicate column name: audience_lang");
  await addColumn("ALTER TABLE user_notifications ADD COLUMN title_zh TEXT", "duplicate column name: title_zh");
  await addColumn("ALTER TABLE user_notifications ADD COLUMN body_zh TEXT", "duplicate column name: body_zh");
  await addColumn("ALTER TABLE user_notifications ADD COLUMN title_en TEXT", "duplicate column name: title_en");
  await addColumn("ALTER TABLE user_notifications ADD COLUMN body_en TEXT", "duplicate column name: body_en");
  await addColumn(
    "ALTER TABLE user_notifications ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0",
    "duplicate column name: is_deleted"
  );

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
      "CREATE INDEX IF NOT EXISTS idx_user_notifications_user_lang_read ON user_notifications (user_id, audience_lang, is_read, created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_user_notifications_event ON user_notifications (event_id, is_deleted, created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_user_notifications_type_created ON user_notifications (type, created_at DESC)"
    )
    .run();
}


