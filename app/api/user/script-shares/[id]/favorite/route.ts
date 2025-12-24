import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../../../../_utils/scriptSharesTable";
import {
  ensureScriptShareInteractionsTables,
  getScriptShareInteractionStats,
} from "../../../../_utils/scriptShareInteractionsTable";
import { requireUserFromRequest } from "../../../_utils/userSession";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

async function ensureShareVisibleToUser(options: {
  db: D1Database;
  scriptId: string;
  userId: number;
}) {
  const { db, scriptId, userId } = options;
  const { results } = await db
    .prepare("SELECT owner_user_id, is_public FROM script_shares WHERE id = ? LIMIT 1")
    .bind(scriptId)
    .all<{ owner_user_id: number; is_public: number }>();
  const row = results?.[0] ?? null;
  if (!row) return false;
  if (row.is_public) return true;
  return row.owner_user_id === userId;
}

export const POST = withApiMonitoring(async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureScriptSharesTable(db);
  await ensureScriptShareInteractionsTables(db);

  const visible = await ensureShareVisibleToUser({ db, scriptId: id, userId: authed.user.id });
  if (!visible) return new Response("Not found", { status: 404 });

  const existsRes = await db
    .prepare(
      "SELECT 1 AS ok FROM script_share_favorites WHERE script_id = ? AND user_id = ? LIMIT 1"
    )
    .bind(id, authed.user.id)
    .all<{ ok: 1 }>();
  const existed = !!existsRes.results?.[0];

  if (existed) {
    await db
      .prepare("DELETE FROM script_share_favorites WHERE script_id = ? AND user_id = ?")
      .bind(id, authed.user.id)
      .run();
  } else {
    try {
      await db
        .prepare("INSERT INTO script_share_favorites (script_id, user_id) VALUES (?, ?)")
        .bind(id, authed.user.id)
        .run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("UNIQUE constraint failed")) throw e;
    }
  }

  const stats = await getScriptShareInteractionStats({
    db,
    scriptId: id,
    userId: authed.user.id,
  });

  return Response.json({ ok: true, id, ...stats });
}, { name: "POST /api/user/script-shares/[id]/favorite" });


