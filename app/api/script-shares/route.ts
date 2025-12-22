import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../_utils/scriptSharesTable";

type ListItem = {
  id: string;
  effectName: string;
  publicUsername: string;
  isPublic: boolean;
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
  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("pageSize"), 20, 1, 50);
  const offset = (page - 1) * pageSize;

  const countRes = await db
    .prepare("SELECT COUNT(*) AS c FROM script_shares WHERE is_public = 1")
    .all<{ c: number }>();
  const total = countRes.results?.[0]?.c ?? 0;

  const { results } = await db
    .prepare(
      `SELECT id, effect_name, public_username, is_public, original_filename, size_bytes, created_at, updated_at
       FROM script_shares
       WHERE is_public = 1
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(pageSize, offset)
    .all<{
      id: string;
      effect_name: string;
      public_username: string;
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
    isPublic: !!r.is_public,
    originalFilename: r.original_filename,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return Response.json({ items, total, page, pageSize });
}


