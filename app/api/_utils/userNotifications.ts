import {
  ensureUserNotificationsTable,
  type UserNotificationLevel,
  type UserNotificationRow,
} from "./userNotificationsTable";
import { ensureUsersTable } from "./usersTable";
import type { AppLanguage } from "./appLanguage";
import { normalizeAppLanguage } from "./appLanguage";

function clampInt(value: string | null, def: number, min: number, max: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export function parseNotificationsPaging(url: string) {
  const { searchParams } = new URL(url);
  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("pageSize"), 20, 1, 50);
  const unreadOnly =
    searchParams.get("unreadOnly") === "1" ||
    String(searchParams.get("unreadOnly") ?? "").toLowerCase() === "true";
  return { page, pageSize, unreadOnly };
}

export async function createUserNotification(options: {
  db: D1Database;
  userId: number;
  type: string;
  level?: UserNotificationLevel;
  title: string;
  body: string;
  linkUrl?: string | null;
  meta?: unknown;
}) {
  const { db } = options;
  await ensureUserNotificationsTable(db);

  const metaJson =
    options.meta == null
      ? null
      : (() => {
          try {
            return JSON.stringify(options.meta);
          } catch {
            return JSON.stringify({ meta: "unserializable" });
          }
        })();

  await db
    .prepare(
      `INSERT INTO user_notifications
       (user_id, type, level, title, body, link_url, meta_json, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .bind(
      options.userId,
      options.type,
      options.level ?? "info",
      options.title,
      options.body,
      options.linkUrl ?? null,
      metaJson
    )
    .run();
}

export async function createBroadcastUserNotification(options: {
  db: D1Database;
  type: string;
  level?: UserNotificationLevel;
  titleZh: string;
  bodyZh: string;
  titleEn: string;
  bodyEn: string;
  linkUrl?: string | null;
  meta?: unknown;
}) {
  const { db } = options;
  await ensureUsersTable(db);
  await ensureUserNotificationsTable(db);

  const metaJson =
    options.meta == null
      ? null
      : (() => {
          try {
            return JSON.stringify(options.meta);
          } catch {
            return JSON.stringify({ meta: "unserializable" });
          }
        })();

  // One row per user. Use a single SQL statement for efficiency.
  await db
    .prepare(
      `INSERT INTO user_notifications
       (user_id, type, level, title, body, title_zh, body_zh, title_en, body_en, link_url, meta_json, is_read)
       SELECT id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0 FROM users`
    )
    .bind(
      options.type,
      options.level ?? "info",
      // Keep legacy title/body populated (use zh as default)
      options.titleZh,
      options.bodyZh,
      options.titleZh,
      options.bodyZh,
      options.titleEn,
      options.bodyEn,
      options.linkUrl ?? null,
      metaJson
    )
    .run();
}

export async function getUserUnreadNotificationCount(db: D1Database, userId: number) {
  await ensureUserNotificationsTable(db);
  const { results } = await db
    .prepare(
      "SELECT COUNT(*) AS c FROM user_notifications WHERE user_id = ? AND is_read = 0"
    )
    .bind(userId)
    .all<{ c: number }>();
  return results?.[0]?.c ?? 0;
}

export async function listUserNotifications(options: {
  db: D1Database;
  userId: number;
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
  lang?: AppLanguage;
}) {
  const { db, userId, page, pageSize } = options;
  await ensureUserNotificationsTable(db);

  const offset = (page - 1) * pageSize;
  const where = options.unreadOnly ? "AND is_read = 0" : "";
  const lang = normalizeAppLanguage(options.lang);

  const countRes = await db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM user_notifications
       WHERE user_id = ? ${where}`
    )
    .bind(userId)
    .all<{ c: number }>();
  const total = countRes.results?.[0]?.c ?? 0;

  const { results } = await db
    .prepare(
      `SELECT id, user_id, type, level, title, body, title_zh, body_zh, title_en, body_en, link_url, meta_json, is_read, created_at, read_at
       FROM user_notifications
       WHERE user_id = ? ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(userId, pageSize, offset)
    .all<UserNotificationRow>();

  const items = (results ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    level: r.level,
    title: lang === "en-US" ? (r.title_en ?? r.title) : (r.title_zh ?? r.title),
    body: lang === "en-US" ? (r.body_en ?? r.body) : (r.body_zh ?? r.body),
    linkUrl: r.link_url,
    isRead: !!r.is_read,
    createdAt: r.created_at,
    readAt: r.read_at,
  }));

  return { items, total, page, pageSize };
}

export async function markUserNotificationRead(options: {
  db: D1Database;
  userId: number;
  id: number;
}) {
  const { db, userId, id } = options;
  await ensureUserNotificationsTable(db);

  await db
    .prepare(
      `UPDATE user_notifications
       SET is_read = 1, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = ? AND user_id = ?`
    )
    .bind(id, userId)
    .run();
}

export async function markAllUserNotificationsRead(db: D1Database, userId: number) {
  await ensureUserNotificationsTable(db);
  await db
    .prepare(
      `UPDATE user_notifications
       SET is_read = 1, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE user_id = ? AND is_read = 0`
    )
    .bind(userId)
    .run();
}


