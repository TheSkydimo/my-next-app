export type AdminAuditLogRow = {
  id: number;
  created_at: string;
  actor_admin_id: number;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  target_owner_user_id: number | null;
  request_ip: string | null;
  user_agent: string | null;
  reason: string | null;
  meta_json: string | null;
};

export async function ensureAdminAuditLogsTable(db: D1Database) {
  // Best-effort: keep aligned with schema.sql if you maintain one.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        actor_admin_id INTEGER NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        target_owner_user_id INTEGER,
        request_ip TEXT,
        user_agent TEXT,
        reason TEXT,
        meta_json TEXT
      )`
    )
    .run();

  // Indexes
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs (created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_created ON admin_audit_logs (actor_admin_id, created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON admin_audit_logs (target_type, target_id)"
    )
    .run();
}


