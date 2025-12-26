import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { requireAdminFromRequest } from "../../_utils/adminSession";
import { softDeleteAdminNotificationEvent } from "../../../_utils/adminNotificationEvents";
import { softDeleteUserNotificationsByEventId } from "../../../_utils/userNotifications";
import { writeAdminAuditLog } from "../../../_utils/adminAuditLogs";

export const DELETE = withApiMonitoring(async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const eventId = Number.parseInt(id, 10);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return new Response("Invalid id", { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  // Soft-delete event record and related user inbox items.
  await softDeleteAdminNotificationEvent({ db, id: eventId });
  await softDeleteUserNotificationsByEventId({ db, eventId });

  // Best-effort audit log (never blocks).
  await writeAdminAuditLog({
    db,
    request,
    actor: { id: authed.admin.id, role: authed.admin.role },
    action: "delete_user_notification_event",
    targetType: "user_notification",
    targetId: String(eventId),
    targetOwnerUserId: null,
    meta: { eventId },
  });

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}, { name: "DELETE /api/admin/notifications/[id]" });


