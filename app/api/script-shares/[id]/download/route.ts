import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../../../_utils/scriptSharesTable";
import { SCRIPT_SHARE_R2_PREFIX, safeDownloadFilename } from "../../../_utils/scriptShares";
import { requireUserFromRequest } from "../../../user/_utils/userSession";
import { requireAdminFromRequest } from "../../../admin/_utils/adminSession";
import { writeAdminAuditLog } from "../../../_utils/adminAuditLogs";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

type DbRow = {
  id: string;
  owner_user_id: number;
  effect_name: string;
  r2_key: string;
  is_public: number;
  updated_at: string;
};

export const GET = withApiMonitoring(async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  await ensureScriptSharesTable(db);

  const { results } = await db
    .prepare(
      "SELECT id, owner_user_id, effect_name, r2_key, is_public, updated_at FROM script_shares WHERE id = ? LIMIT 1"
    )
    .bind(id)
    .all<DbRow>();

  const row = results?.[0];
  if (!row) return new Response("Not found", { status: 404 });
  if (!row.r2_key || !row.r2_key.startsWith(SCRIPT_SHARE_R2_PREFIX)) {
    return new Response("Invalid key", { status: 400 });
  }

  // Private scripts: only owner (user) or super admin (with audit) can download.
  if (!row.is_public) {
    const authedUser = await requireUserFromRequest({ request, env, db });
    if (!(authedUser instanceof Response) && authedUser.user.id === row.owner_user_id) {
      // owner ok
    } else {
      const authedAdmin = await requireAdminFromRequest({ request, env, db });
      if (authedAdmin instanceof Response) {
        // If user auth failed, keep the original response; otherwise forbid.
        return authedUser instanceof Response ? authedUser : new Response("Forbidden", { status: 403 });
      }
      if (!authedAdmin.admin.isSuperAdmin) {
        return new Response("Forbidden", { status: 403 });
      }

      await writeAdminAuditLog({
        db,
        request,
        actor: { id: authedAdmin.admin.id, role: authedAdmin.admin.role },
        action: "view_private_script_download",
        targetType: "script_share",
        targetId: row.id,
        targetOwnerUserId: row.owner_user_id,
        meta: { updatedAt: row.updated_at },
      });
    }
  }

  const obj = await r2.get(row.r2_key);
  if (!obj) return new Response("File not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", "application/octet-stream");
  headers.set("ETag", obj.httpEtag);
  headers.set("Cache-Control", row.is_public ? "public, max-age=60" : "private, max-age=60");
  headers.set("Content-Disposition", `attachment; filename="${safeDownloadFilename(row.effect_name)}"`);

  return new Response(obj.body, { headers });
}, { name: "GET /api/script-shares/[id]/download" });


