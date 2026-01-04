import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptShareInteractionsTables } from "../../_utils/scriptShareInteractionsTable";
import { ensureScriptSharesTable } from "../../_utils/scriptSharesTable";
import { normalizeAppLanguage, type AppLanguage } from "../../_utils/appLanguage";
import { requireUserFromRequest } from "../_utils/userSession";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { normalizeDbUtcDateTimeToIso } from "../../_utils/dbTime";

type FavoritesListItem = {
  id: string;
  effectName: string;
  publicUsername: string;
  lang: AppLanguage;
  isPublic: boolean;
  isPinned: boolean;
  pinnedAt: string | null;
  coverUrl: string;
  originalFilename: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  favoritedAt: string;
  likeCount: number;
  favoriteCount: number;
  likedByMe: boolean;
  favoritedByMe: boolean;
  likeCanUndo: boolean;
  likeLocked: boolean;
};

function clampInt(value: string | null, def: number, min: number, max: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export const GET = withApiMonitoring(async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureScriptSharesTable(db);
  await ensureScriptShareInteractionsTables(db);

  const { searchParams } = new URL(request.url);
  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("pageSize"), 20, 1, 50);
  const offset = (page - 1) * pageSize;

  // Only show scripts visible to the user: public, or private owned by user.
  const whereVisible = "(s.is_public = 1 OR s.owner_user_id = ?)";

  const countRes = await db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM script_share_favorites f
       JOIN script_shares s ON s.id = f.script_id
       WHERE f.user_id = ? AND ${whereVisible}`
    )
    .bind(authed.user.id, authed.user.id)
    .all<{ c: number }>();
  const total = countRes.results?.[0]?.c ?? 0;

  const { results } = await db
    .prepare(
      `SELECT
         s.id,
         s.effect_name,
         s.public_username,
         s.lang,
         s.is_public,
         s.is_pinned,
         s.pinned_at,
         s.original_filename,
         s.size_bytes,
         s.created_at,
         s.updated_at,
         f.created_at AS favorited_at,
         (SELECT COUNT(*) FROM script_share_likes l WHERE l.script_id = s.id) AS like_count,
         (SELECT COUNT(*) FROM script_share_favorites f2 WHERE f2.script_id = s.id) AS favorite_count,
         EXISTS(SELECT 1 FROM script_share_likes l WHERE l.script_id = s.id AND l.user_id = ?) AS liked_by_me,
         1 AS favorited_by_me,
         (
           SELECT CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END
           FROM script_share_likes l
           WHERE l.script_id = s.id AND l.user_id = ?
           LIMIT 1
         ) AS my_like_can_undo
       FROM script_share_favorites f
       JOIN script_shares s ON s.id = f.script_id
       WHERE f.user_id = ? AND ${whereVisible}
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(
      authed.user.id,
      authed.user.id,
      authed.user.id,
      authed.user.id,
      pageSize,
      offset
    )
    .all<{
      id: string;
      effect_name: string;
      public_username: string;
      lang: AppLanguage;
      is_public: number;
      is_pinned: number;
      pinned_at: string | null;
      original_filename: string;
      size_bytes: number;
      created_at: string;
      updated_at: string;
      favorited_at: string;
      like_count: number;
      favorite_count: number;
      liked_by_me: number;
      favorited_by_me: number;
      my_like_can_undo: number | null;
    }>();

  const items: FavoritesListItem[] = (results ?? []).map((r) => ({
    id: r.id,
    effectName: r.effect_name,
    publicUsername: r.public_username,
    lang: normalizeAppLanguage(r.lang),
    isPublic: !!r.is_public,
    isPinned: !!r.is_pinned,
    pinnedAt: normalizeDbUtcDateTimeToIso(r.pinned_at),
    coverUrl: `/api/script-shares/${encodeURIComponent(r.id)}/cover`,
    originalFilename: r.original_filename,
    sizeBytes: r.size_bytes,
    createdAt: normalizeDbUtcDateTimeToIso(r.created_at) ?? r.created_at,
    updatedAt: normalizeDbUtcDateTimeToIso(r.updated_at) ?? r.updated_at,
    favoritedAt: normalizeDbUtcDateTimeToIso(r.favorited_at) ?? r.favorited_at,
    likeCount: r.like_count ?? 0,
    favoriteCount: r.favorite_count ?? 0,
    likedByMe: !!r.liked_by_me,
    favoritedByMe: !!r.favorited_by_me,
    likeCanUndo: r.my_like_can_undo === 1,
    likeLocked: !!r.liked_by_me && r.my_like_can_undo !== 1,
  }));

  return Response.json({ items, total, page, pageSize });
}, { name: "GET /api/user/script-share-favorites" });


