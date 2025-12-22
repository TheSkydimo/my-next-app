import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../../../_utils/scriptSharesTable";
import { SCRIPT_SHARE_R2_PREFIX, safeDownloadFilename } from "../../../_utils/scriptShares";
import { requireUserFromRequest } from "../../../user/_utils/userSession";

type DbRow = {
  id: string;
  owner_user_id: number;
  effect_name: string;
  r2_key: string;
  is_public: number;
  updated_at: string;
};

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
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

  // Private scripts: only owner/admin can download.
  if (!row.is_public) {
    const authed = await requireUserFromRequest({ request, env, db });
    if (authed instanceof Response) return authed;
    if (authed.user.id !== row.owner_user_id && !authed.user.isAdmin) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const obj = await r2.get(row.r2_key);
  if (!obj) return new Response("File not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", "application/octet-stream");
  headers.set("ETag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=60");
  headers.set("Content-Disposition", `attachment; filename="${safeDownloadFilename(row.effect_name)}"`);

  return new Response(obj.body, { headers });
}


