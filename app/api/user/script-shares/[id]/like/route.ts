import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../../../../_utils/scriptSharesTable";
import {
  ensureScriptShareInteractionsTables,
  getScriptShareInteractionStats,
} from "../../../../_utils/scriptShareInteractionsTable";
import { requireUserFromRequest } from "../../../_utils/userSession";

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

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
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
      `SELECT
         created_at,
         created_at >= datetime('now', '-1 day') AS can_undo
       FROM script_share_likes
       WHERE script_id = ? AND user_id = ?
       LIMIT 1`
    )
    .bind(id, authed.user.id)
    .all<{ created_at: string; can_undo: number }>();
  const existed = existsRes.results?.[0] ?? null;

  if (!existed) {
    try {
      await db
        .prepare("INSERT INTO script_share_likes (script_id, user_id) VALUES (?, ?)")
        .bind(id, authed.user.id)
        .run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("UNIQUE constraint failed")) throw e;
    }
  } else if (existed.can_undo === 1) {
    await db
      .prepare("DELETE FROM script_share_likes WHERE script_id = ? AND user_id = ?")
      .bind(id, authed.user.id)
      .run();
  } else {
    // Locked (>24h): do nothing.
  }

  const stats = await getScriptShareInteractionStats({
    db,
    scriptId: id,
    userId: authed.user.id,
  });

  return Response.json({ ok: true, id, ...stats });
}


