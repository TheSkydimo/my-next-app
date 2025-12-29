import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireUserFromRequest } from "../../_utils/userSession";
import { markUserNotificationRead, softDeleteUserNotificationById } from "../../../_utils/userNotifications";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

export const PATCH = withApiMonitoring(async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const notifId = Number.parseInt(id, 10);
  if (!Number.isFinite(notifId) || notifId <= 0) {
    return new Response("Invalid id", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await markUserNotificationRead({ db, userId: authed.user.id, id: notifId });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}, { name: "PATCH /api/user/notifications/[id]" });

export const DELETE = withApiMonitoring(async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const notifId = Number.parseInt(id, 10);
  if (!Number.isFinite(notifId) || notifId <= 0) {
    return new Response("Invalid id", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await softDeleteUserNotificationById({ db, userId: authed.user.id, id: notifId });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}, { name: "DELETE /api/user/notifications/[id]" });


