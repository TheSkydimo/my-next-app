import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireUserFromRequest } from "../_utils/userSession";
import {
  getUserUnreadNotificationCount,
  listUserNotifications,
  markAllUserNotificationsRead,
  parseNotificationsPaging,
} from "../../_utils/userNotifications";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { normalizeAppLanguage } from "../../_utils/appLanguage";

export const GET = withApiMonitoring(async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  const { page, pageSize, unreadOnly } = parseNotificationsPaging(request.url);
  const url = new URL(request.url);
  const lang = normalizeAppLanguage(url.searchParams.get("lang"));
  const list = await listUserNotifications({
    db,
    userId: authed.user.id,
    page,
    pageSize,
    unreadOnly,
    lang,
  });
  const unreadCount = await getUserUnreadNotificationCount(db, authed.user.id, lang);
  return Response.json(
    { ...list, unreadCount },
    { headers: { "Cache-Control": "no-store" } }
  );
}, { name: "GET /api/user/notifications" });

// Mark all as read
export const POST = withApiMonitoring(async function POST(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await markAllUserNotificationsRead(db, authed.user.id);
  // Keep legacy behavior (mark all languages). Unread count is language-specific only on GET with `lang=`.
  const unreadCount = await getUserUnreadNotificationCount(db, authed.user.id);
  return Response.json(
    { ok: true, unreadCount },
    { headers: { "Cache-Control": "no-store" } }
  );
}, { name: "POST /api/user/notifications" });


