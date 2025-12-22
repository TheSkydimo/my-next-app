import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../_utils/scriptSharesTable";
import { normalizeAppLanguage, type AppLanguage } from "../_utils/appLanguage";

type ListItem = {
  id: string;
  effectName: string;
  publicUsername: string;
  lang: AppLanguage;
  isPublic: boolean;
  coverUrl: string;
  originalFilename: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

function clampInt(value: string | null, def: number, min: number, max: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  await ensureScriptSharesTable(db);

  const { searchParams } = new URL(request.url);
  const lang = normalizeAppLanguage(searchParams.get("lang"));
  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  // Public browse: hard-limit to 20 per page.
  const pageSize = clampInt(searchParams.get("pageSize"), 20, 1, 20);
  const q = (searchParams.get("q") ?? "").trim();
  const offset = (page - 1) * pageSize;

  const whereParts: string[] = ["is_public = 1", "lang = ?"];
  const binds: unknown[] = [lang];
  if (q) {
    whereParts.push("(id LIKE ? OR effect_name LIKE ? OR public_username LIKE ?)");
    const like = `%${q}%`;
    binds.push(like, like, like);
  }
  const whereSql = `WHERE ${whereParts.join(" AND ")}`;

  const countRes = await db
    .prepare(`SELECT COUNT(*) AS c FROM script_shares ${whereSql}`)
    .bind(...binds)
    .all<{ c: number }>();
  const total = countRes.results?.[0]?.c ?? 0;

  const { results } = await db
    .prepare(
      `SELECT id, effect_name, public_username, lang, is_public, original_filename, size_bytes, created_at, updated_at
       FROM script_shares
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, pageSize, offset)
    .all<{
      id: string;
      effect_name: string;
      public_username: string;
      lang: AppLanguage;
      is_public: number;
      original_filename: string;
      size_bytes: number;
      created_at: string;
      updated_at: string;
    }>();

  const items: ListItem[] = (results ?? []).map((r) => ({
    id: r.id,
    effectName: r.effect_name,
    publicUsername: r.public_username,
    lang: normalizeAppLanguage(r.lang),
    isPublic: !!r.is_public,
    coverUrl: `/api/script-shares/${encodeURIComponent(r.id)}/cover`,
    originalFilename: r.original_filename,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return Response.json({ items, total, page, pageSize });
}


