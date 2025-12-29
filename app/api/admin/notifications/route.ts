import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAdminFromRequest } from "../_utils/adminSession";
import { createBroadcastUserNotification } from "../../_utils/userNotifications";
import { writeAdminAuditLog } from "../../_utils/adminAuditLogs";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { assertSameOriginOrNoOrigin } from "../../_utils/requestOrigin";
import {
  createAdminNotificationEvent,
  listAdminNotificationEvents,
  parseAdminNotificationEventsPaging,
  updateAdminNotificationEventStatus,
} from "../../_utils/adminNotificationEvents";
import type { AdminNotificationLevel } from "../../_utils/adminNotificationEventsTable";

type CreateAdminNotificationBody = {
  type?: string;
  level?: "info" | "warn" | "critical";
  titleZh?: string;
  bodyZh?: string;
  titleEn?: string;
  bodyEn?: string;
  linkUrl?: string | null;
  scope?: "all_users" | "vip_users" | "non_vip_users" | "admins" | "email_list";
  targetEmails?: string[] | string;
};

function sanitizeOneLine(input: unknown, maxLen: number): string {
  const s = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function sanitizeBody(input: unknown, maxLen: number): string {
  // Keep newlines (for readability), but cap length and strip trailing spaces.
  const s = String(input ?? "").trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export const GET = withApiMonitoring(async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  const { page, pageSize, q, type, level, status, includeDeleted } = parseAdminNotificationEventsPaging(
    request.url
  );

  const { items, total } = await listAdminNotificationEvents({
    db,
    page,
    pageSize,
    q,
    type,
    level,
    status,
    includeDeleted,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return Response.json(
    {
      events: items.map((r) => ({
        id: r.id,
        type: r.type,
        level: r.level,
        audienceLang: r.audience_lang,
        titleZh: r.title_zh,
        bodyZh: r.body_zh,
        titleEn: r.title_en,
        bodyEn: r.body_en,
        linkUrl: r.link_url,
        scope: r.scope,
        targetJson: r.target_json,
        createdByAdminId: r.created_by_admin_id,
        createdByAdminRole: r.created_by_admin_role,
        status: r.status,
        errorMessage: r.error_message,
        isDeleted: !!r.is_deleted,
        deletedAt: r.deleted_at,
        createdAt: r.created_at,
      })),
      pagination: { total, page, pageSize, totalPages },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}, { name: "GET /api/admin/notifications" });

export const POST = withApiMonitoring(async function POST(request: Request) {
  const originGuard = assertSameOriginOrNoOrigin(request);
  if (originGuard) return originGuard;

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  const raw = (await request.json().catch(() => null)) as CreateAdminNotificationBody | null;
  if (!raw) {
    return new Response("Invalid JSON", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const type = sanitizeOneLine(raw.type ?? "admin_message", 50) || "admin_message";
  const level: AdminNotificationLevel =
    raw.level === "warn" || raw.level === "critical" ? raw.level : "info";
  const titleZh = sanitizeOneLine(raw.titleZh, 80);
  const bodyZh = sanitizeBody(raw.bodyZh, 1000);
  const titleEn = sanitizeOneLine(raw.titleEn, 80);
  const bodyEn = sanitizeBody(raw.bodyEn, 1000);
  const linkUrl = raw.linkUrl == null ? null : sanitizeOneLine(raw.linkUrl, 300) || null;

  const zhOk = !!titleZh && !!bodyZh;
  const enOk = !!titleEn && !!bodyEn;
  if (!zhOk && !enOk) {
    return new Response("At least one language (zh or en) is required", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const audienceLang = zhOk && enOk ? "both" : zhOk ? "zh" : "en";

  const scope =
    raw.scope === "vip_users" ||
    raw.scope === "non_vip_users" ||
    raw.scope === "admins" ||
    raw.scope === "email_list"
      ? raw.scope
      : "all_users";

  const targetEmailsRaw = raw.targetEmails;
  const targetEmails =
    scope === "email_list"
      ? (Array.isArray(targetEmailsRaw)
          ? targetEmailsRaw
          : String(targetEmailsRaw ?? "")
              .split(/[\n,;]+/g))
          .map((x) => String(x).trim())
          .filter(Boolean)
          .slice(0, 200)
      : [];

  if (scope === "email_list" && targetEmails.length <= 0) {
    return new Response("targetEmails is required for email_list", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const targetJson =
    scope === "email_list"
      ? JSON.stringify({ emails: targetEmails })
      : null;

  const { id: eventId } = await createAdminNotificationEvent({
    db,
    type,
    level,
    audienceLang,
    titleZh: titleZh || "",
    bodyZh: bodyZh || "",
    titleEn: titleEn || "",
    bodyEn: bodyEn || "",
    linkUrl,
    scope,
    targetJson,
    createdByAdminId: authed.admin.id,
    createdByAdminRole: authed.admin.role,
    status: "sending",
  });

  try {
    await createBroadcastUserNotification({
      db,
      type,
      level,
      audienceLang,
      eventId,
      titleZh: titleZh || "",
      bodyZh: bodyZh || "",
      titleEn: titleEn || "",
      bodyEn: bodyEn || "",
      linkUrl,
      scope,
      targetEmails,
      meta: {
        eventId,
        createdByAdminId: authed.admin.id,
        createdByAdminRole: authed.admin.role,
        scope,
        audienceLang,
        targetEmails: scope === "email_list" ? targetEmails : undefined,
      },
    });

    await updateAdminNotificationEventStatus({ db, id: eventId, status: "sent", errorMessage: null });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(
      "broadcast notification failed:",
      JSON.stringify(
        {
          name: err.name,
          message: err.message,
          stack:
            process.env.NODE_ENV === "development"
              ? err.stack?.slice(0, 2000)
              : undefined,
        },
        null,
        0
      )
    );
    const safeErr = sanitizeOneLine(e instanceof Error ? e.message : String(e), 300) || "failed";
    await updateAdminNotificationEventStatus({ db, id: eventId, status: "failed", errorMessage: safeErr });
    throw e;
  }

  // Best-effort audit log (never blocks).
  await writeAdminAuditLog({
    db,
    request,
    actor: { id: authed.admin.id, role: authed.admin.role },
    action: "create_user_notification",
    targetType: "user_notification",
    targetId: "all_users",
    targetOwnerUserId: null,
    meta: {
      eventId,
      notificationType: type,
      level,
      linkUrl,
      scope,
      audienceLang,
    },
  });

  return Response.json({ ok: true, eventId }, { headers: { "Cache-Control": "no-store" } });
}, { name: "POST /api/admin/notifications" });


