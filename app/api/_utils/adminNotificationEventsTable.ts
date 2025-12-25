export type AdminNotificationLevel = "info" | "warn" | "critical";

export type AdminNotificationEventStatus = "sending" | "sent" | "failed";

export type AdminNotificationEventRow = {
  id: number;
  type: string;
  level: AdminNotificationLevel;
  title_zh: string;
  body_zh: string;
  title_en: string;
  body_en: string;
  link_url: string | null;
  scope: string;
  created_by_admin_id: number;
  created_by_admin_role: string;
  status: AdminNotificationEventStatus;
  error_message: string | null;
  created_at: string;
};

export async function ensureAdminNotificationEventsTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_notification_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        title_zh TEXT NOT NULL,
        body_zh TEXT NOT NULL,
        title_en TEXT NOT NULL,
        body_en TEXT NOT NULL,
        link_url TEXT,
        scope TEXT NOT NULL DEFAULT 'all_users',
        created_by_admin_id INTEGER NOT NULL,
        created_by_admin_role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'sent',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run();

  // Best-effort column migrations for existing deployments.
  const addColumn = async (sql: string, duplicateMsg: string) => {
    try {
      await db.prepare(sql).run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes(duplicateMsg)) throw e;
    }
  };
  await addColumn(
    "ALTER TABLE admin_notification_events ADD COLUMN status TEXT NOT NULL DEFAULT 'sent'",
    "duplicate column name: status"
  );
  await addColumn(
    "ALTER TABLE admin_notification_events ADD COLUMN error_message TEXT",
    "duplicate column name: error_message"
  );

  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_admin_notification_events_created ON admin_notification_events (created_at DESC, id DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_admin_notification_events_level_created ON admin_notification_events (level, created_at DESC, id DESC)"
    )
    .run();
}


