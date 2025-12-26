export type AdminNotificationLevel = "info" | "warn" | "critical";

export type AdminNotificationEventStatus = "sending" | "sent" | "failed";

export type AdminNotificationAudienceLang = "zh" | "en" | "both";

export type AdminNotificationEventRow = {
  id: number;
  type: string;
  level: AdminNotificationLevel;
  audience_lang: AdminNotificationAudienceLang;
  title_zh: string;
  body_zh: string;
  title_en: string;
  body_en: string;
  link_url: string | null;
  scope: string;
  target_json: string | null;
  created_by_admin_id: number;
  created_by_admin_role: string;
  status: AdminNotificationEventStatus;
  error_message: string | null;
  is_deleted: number;
  deleted_at: string | null;
  created_at: string;
};

export async function ensureAdminNotificationEventsTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_notification_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        audience_lang TEXT NOT NULL DEFAULT 'both',
        title_zh TEXT NOT NULL,
        body_zh TEXT NOT NULL,
        title_en TEXT NOT NULL,
        body_en TEXT NOT NULL,
        link_url TEXT,
        scope TEXT NOT NULL DEFAULT 'all_users',
        target_json TEXT,
        created_by_admin_id INTEGER NOT NULL,
        created_by_admin_role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'sent',
        error_message TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TIMESTAMP,
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
  await addColumn(
    "ALTER TABLE admin_notification_events ADD COLUMN audience_lang TEXT NOT NULL DEFAULT 'both'",
    "duplicate column name: audience_lang"
  );
  await addColumn(
    "ALTER TABLE admin_notification_events ADD COLUMN target_json TEXT",
    "duplicate column name: target_json"
  );
  await addColumn(
    "ALTER TABLE admin_notification_events ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0",
    "duplicate column name: is_deleted"
  );
  await addColumn(
    "ALTER TABLE admin_notification_events ADD COLUMN deleted_at TIMESTAMP",
    "duplicate column name: deleted_at"
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
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_admin_notification_events_deleted_created ON admin_notification_events (is_deleted, created_at DESC, id DESC)"
    )
    .run();
}


