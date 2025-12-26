import {
  ensureUserNotificationsTable,
  type UserNotificationLevel,
  type UserNotificationRow,
  type UserNotificationAudienceLang,
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
  audienceLang?: UserNotificationAudienceLang;
  eventId?: number | null;
  title: string;
  body: string;
  titleZh?: string | null;
  bodyZh?: string | null;
  titleEn?: string | null;
  bodyEn?: string | null;
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
       (user_id, event_id, type, level, audience_lang, title, body, title_zh, body_zh, title_en, body_en, link_url, meta_json, is_deleted, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`
    )
    .bind(
      options.userId,
      options.eventId ?? null,
      options.type,
      options.level ?? "info",
      options.audienceLang ?? null,
      options.title,
      options.body,
      options.titleZh ?? null,
      options.bodyZh ?? null,
      options.titleEn ?? null,
      options.bodyEn ?? null,
      options.linkUrl ?? null,
      metaJson
    )
    .run();
}

export async function createBroadcastUserNotification(options: {
  db: D1Database;
  type: string;
  level?: UserNotificationLevel;
  audienceLang: UserNotificationAudienceLang;
  eventId: number;
  titleZh: string;
  bodyZh: string;
  titleEn: string;
  bodyEn: string;
  linkUrl?: string | null;
  scope?: string;
  targetEmails?: string[];
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

  const legacyTitle = options.titleZh || options.titleEn;
  const legacyBody = options.bodyZh || options.bodyEn;

  const scope = String(options.scope ?? "all_users");
  const where: string[] = ["1=1"];
  const bindsUsers: unknown[] = [];

  if (scope === "vip_users") {
    where.push("vip_expires_at IS NOT NULL AND vip_expires_at > CURRENT_TIMESTAMP");
  } else if (scope === "non_vip_users") {
    where.push("(vip_expires_at IS NULL OR vip_expires_at <= CURRENT_TIMESTAMP)");
  } else if (scope === "admins") {
    where.push("(is_admin = 1 OR is_super_admin = 1)");
  } else if (scope === "email_list") {
    const emails = (options.targetEmails ?? []).map((e) => String(e).trim()).filter(Boolean);
    if (emails.length <= 0) {
      // No recipients.
      return;
    }
    const placeholders = emails.map(() => "?").join(", ");
    where.push(`email IN (${placeholders})`);
    bindsUsers.push(...emails);
  }

  // One row per user. Use a single SQL statement for efficiency.
  await db
    .prepare(
      `INSERT INTO user_notifications
       (user_id, event_id, type, level, audience_lang, title, body, title_zh, body_zh, title_en, body_en, link_url, meta_json, is_deleted, is_read)
       SELECT id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0
       FROM users
       WHERE ${where.join(" AND ")}`
    )
    .bind(
      options.eventId,
      options.type,
      options.level ?? "info",
      options.audienceLang,
      legacyTitle,
      legacyBody,
      options.titleZh || null,
      options.bodyZh || null,
      options.titleEn || null,
      options.bodyEn || null,
      options.linkUrl ?? null,
      metaJson,
      ...bindsUsers
    )
    .run();
}

function getAudienceLangKey(lang: AppLanguage | undefined): "zh" | "en" {
  const normalized = normalizeAppLanguage(lang);
  return normalized === "en-US" ? "en" : "zh";
}

export async function getUserUnreadNotificationCount(
  db: D1Database,
  userId: number,
  lang?: AppLanguage
) {
  await ensureUserNotificationsTable(db);
  const query = (() => {
    // When lang is omitted, count all languages (legacy behavior).
    if (!lang) {
      return {
        sql: `SELECT COUNT(*) AS c
              FROM user_notifications
              WHERE user_id = ?
                AND is_deleted = 0
                AND is_read = 0`,
        binds: [userId] as unknown[],
      };
    }

    const key = getAudienceLangKey(lang);
    // IMPORTANT: audience_lang NULL is treated as "zh" (legacy records are zh-only by default).
    return key === "zh"
      ? {
          sql: `SELECT COUNT(*) AS c
                FROM user_notifications
                WHERE user_id = ?
                  AND is_deleted = 0
                  AND is_read = 0
                  AND (audience_lang IS NULL OR audience_lang = 'zh' OR audience_lang = 'both')`,
          binds: [userId] as unknown[],
        }
      : {
          sql: `SELECT COUNT(*) AS c
                FROM user_notifications
                WHERE user_id = ?
                  AND is_deleted = 0
                  AND is_read = 0
                  AND (audience_lang = 'en' OR audience_lang = 'both')`,
          binds: [userId] as unknown[],
        };
  })();

  const { results } = await db.prepare(query.sql).bind(...query.binds).all<{ c: number }>();
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
  const whereUnread = options.unreadOnly ? "AND is_read = 0" : "";
  const lang = normalizeAppLanguage(options.lang);
  const key = getAudienceLangKey(lang);
  // IMPORTANT: audience_lang NULL is treated as "zh" (legacy records are zh-only by default).
  const audienceWhere =
    key === "zh"
      ? "(audience_lang IS NULL OR audience_lang = 'zh' OR audience_lang = 'both')"
      : "(audience_lang = 'en' OR audience_lang = 'both')";

  const countRes = await db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM user_notifications
       WHERE user_id = ?
         AND is_deleted = 0
         AND ${audienceWhere}
         ${whereUnread}`
    )
    .bind(userId)
    .all<{ c: number }>();
  const total = countRes.results?.[0]?.c ?? 0;

  const { results } = await db
    .prepare(
      `SELECT id, user_id, type, level, title, body, title_zh, body_zh, title_en, body_en, link_url, meta_json, is_read, created_at, read_at
       FROM user_notifications
       WHERE user_id = ?
         AND is_deleted = 0
         AND ${audienceWhere}
         ${whereUnread}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(userId, pageSize, offset)
    .all<UserNotificationRow>();

  const items = (results ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    level: r.level,
    title: lang === "en-US" ? (r.title_en ?? "") : (r.title_zh ?? r.title),
    body: lang === "en-US" ? (r.body_en ?? "") : (r.body_zh ?? r.body),
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
       WHERE id = ? AND user_id = ? AND is_deleted = 0`
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
       WHERE user_id = ? AND is_read = 0 AND is_deleted = 0`
    )
    .bind(userId)
    .run();
}

export async function softDeleteUserNotificationsByEventId(options: {
  db: D1Database;
  eventId: number;
}) {
  const { db, eventId } = options;
  await ensureUserNotificationsTable(db);
  await db
    .prepare(
      "UPDATE user_notifications SET is_deleted = 1 WHERE event_id = ? AND is_deleted = 0"
    )
    .bind(eventId)
    .run();
}


