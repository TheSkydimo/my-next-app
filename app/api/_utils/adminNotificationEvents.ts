import {
  ensureAdminNotificationEventsTable,
  type AdminNotificationEventRow,
  type AdminNotificationEventStatus,
  type AdminNotificationLevel,
} from "./adminNotificationEventsTable";

function clampInt(value: string | null, def: number, min: number, max: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function sanitizeOneLine(input: unknown, maxLen: number): string {
  const s = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function parseAdminNotificationEventsPaging(url: string) {
  const { searchParams } = new URL(url);
  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("pageSize"), 20, 1, 50);

  const q = sanitizeOneLine(searchParams.get("q"), 80);
  const type = sanitizeOneLine(searchParams.get("type"), 50);

  const levelRaw = sanitizeOneLine(searchParams.get("level"), 20);
  const level: AdminNotificationLevel | "" =
    levelRaw === "warn" || levelRaw === "critical" || levelRaw === "info" ? levelRaw : "";

  const statusRaw = sanitizeOneLine(searchParams.get("status"), 20);
  const status: AdminNotificationEventStatus | "" =
    statusRaw === "sending" || statusRaw === "sent" || statusRaw === "failed" ? statusRaw : "";

  return { page, pageSize, q, type, level, status };
}

export async function createAdminNotificationEvent(options: {
  db: D1Database;
  type: string;
  level: AdminNotificationLevel;
  titleZh: string;
  bodyZh: string;
  titleEn: string;
  bodyEn: string;
  linkUrl: string | null;
  scope: string;
  createdByAdminId: number;
  createdByAdminRole: string;
  status: AdminNotificationEventStatus;
}) {
  const { db } = options;
  await ensureAdminNotificationEventsTable(db);

  const insert = await db
    .prepare(
      `INSERT INTO admin_notification_events
       (type, level, title_zh, body_zh, title_en, body_en, link_url, scope, created_by_admin_id, created_by_admin_role, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    )
    .bind(
      options.type,
      options.level,
      options.titleZh,
      options.bodyZh,
      options.titleEn,
      options.bodyEn,
      options.linkUrl,
      options.scope,
      options.createdByAdminId,
      options.createdByAdminRole,
      options.status
    )
    .run();

  const id = insert.meta.last_row_id as number;
  return { id };
}

export async function updateAdminNotificationEventStatus(options: {
  db: D1Database;
  id: number;
  status: AdminNotificationEventStatus;
  errorMessage?: string | null;
}) {
  const { db } = options;
  await ensureAdminNotificationEventsTable(db);

  await db
    .prepare(
      "UPDATE admin_notification_events SET status = ?, error_message = ? WHERE id = ?"
    )
    .bind(options.status, options.errorMessage ?? null, options.id)
    .run();
}

export async function listAdminNotificationEvents(options: {
  db: D1Database;
  page: number;
  pageSize: number;
  q?: string;
  type?: string;
  level?: AdminNotificationLevel | "";
  status?: AdminNotificationEventStatus | "";
}) {
  const { db } = options;
  await ensureAdminNotificationEventsTable(db);

  const where: string[] = ["1=1"];
  const binds: unknown[] = [];

  const q = sanitizeOneLine(options.q, 80);
  if (q) {
    where.push("(title_zh LIKE ? OR title_en LIKE ? OR body_zh LIKE ? OR body_en LIKE ?)");
    const like = `%${q}%`;
    binds.push(like, like, like, like);
  }

  const type = sanitizeOneLine(options.type, 50);
  if (type) {
    where.push("type = ?");
    binds.push(type);
  }

  if (options.level) {
    where.push("level = ?");
    binds.push(options.level);
  }

  if (options.status) {
    where.push("status = ?");
    binds.push(options.status);
  }

  const offset = (options.page - 1) * options.pageSize;

  const countRes = await db
    .prepare(`SELECT COUNT(*) AS c FROM admin_notification_events WHERE ${where.join(" AND ")}`)
    .bind(...binds)
    .all<{ c: number }>();
  const total = countRes.results?.[0]?.c ?? 0;

  const rowsRes = await db
    .prepare(
      `SELECT id, type, level, title_zh, body_zh, title_en, body_en, link_url, scope, created_by_admin_id, created_by_admin_role, status, error_message, created_at
       FROM admin_notification_events
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, options.pageSize, offset)
    .all<AdminNotificationEventRow>();

  return { items: rowsRes.results ?? [], total, page: options.page, pageSize: options.pageSize };
}


