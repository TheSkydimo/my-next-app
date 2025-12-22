import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../../_utils/scriptSharesTable";
import {
  buildScriptShareR2Key,
  isAllowedScriptFilename,
  sanitizeDisplayText,
} from "../../_utils/scriptShares";
import { requireAdminFromRequest } from "../_utils/adminSession";
import { normalizeAppLanguage, type AppLanguage } from "../../_utils/appLanguage";

function clampInt(
  value: string | null,
  def: number,
  min: number,
  max: number
): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureScriptSharesTable(db);

  const { searchParams } = new URL(request.url);
  const langParam = (searchParams.get("lang") ?? "").trim();
  const lang = langParam && langParam !== "all" ? normalizeAppLanguage(langParam) : null;
  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("pageSize"), 20, 1, 50);
  const q = (searchParams.get("q") ?? "").trim();
  const offset = (page - 1) * pageSize;

  const whereParts: string[] = [];
  const binds: unknown[] = [];

  if (lang) {
    whereParts.push("s.lang = ?");
    binds.push(lang);
  }

  if (q) {
    whereParts.push(
      "(s.id LIKE ? OR s.effect_name LIKE ? OR s.public_username LIKE ? OR u.email LIKE ? OR u.username LIKE ?)"
    );
    const like = `%${q}%`;
    binds.push(like, like, like, like, like);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const countRes = await db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM script_shares s
       JOIN users u ON u.id = s.owner_user_id
       ${whereSql}`
    )
    .bind(...binds)
    .all<{ c: number }>();
  const total = countRes.results?.[0]?.c ?? 0;

  const { results } = await db
    .prepare(
      `SELECT
         s.id,
         s.owner_user_id,
         u.username AS owner_username,
         u.email AS owner_email,
         s.effect_name,
         s.public_username,
         s.lang,
         s.is_public,
         s.original_filename,
         s.size_bytes,
         s.created_at,
         s.updated_at
       FROM script_shares s
       JOIN users u ON u.id = s.owner_user_id
       ${whereSql}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, pageSize, offset)
    .all<{
      id: string;
      owner_user_id: number;
      owner_username: string;
      owner_email: string;
      effect_name: string;
      public_username: string;
      lang: AppLanguage;
      is_public: number;
      original_filename: string;
      size_bytes: number;
      created_at: string;
      updated_at: string;
    }>();

  const items = (results ?? []).map((r) => ({
    id: r.id,
    ownerUserId: r.owner_user_id,
    ownerUsername: r.owner_username,
    ownerEmail: r.owner_email,
    effectName: r.effect_name,
    publicUsername: r.public_username,
    lang: normalizeAppLanguage(r.lang),
    isPublic: !!r.is_public,
    originalFilename: r.original_filename,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return Response.json({ items, total, page, pageSize });
}

/**
 * Admin upload: always public.
 * multipart:
 * - effectName (required)
 * - publicUsername (optional, default admin username)
 * - lang (required: zh-CN / en-US; defaults to zh-CN)
 * - file (.skmode)
 */
export async function POST(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureScriptSharesTable(db);

  const form = await request.formData();
  const effectNameRaw = form.get("effectName");
  const publicUsernameRaw = form.get("publicUsername");
  const lang = normalizeAppLanguage(form.get("lang"));
  const file = form.get("file");

  const effectName = sanitizeDisplayText(
    typeof effectNameRaw === "string" ? effectNameRaw : "",
    80
  );
  const publicUsername = sanitizeDisplayText(
    typeof publicUsernameRaw === "string"
      ? publicUsernameRaw
      : authed.admin.username,
    40
  );

  if (!effectName) return new Response("脚本效果名字不能为空", { status: 400 });
  if (!publicUsername) return new Response("公开展示的昵称不能为空", { status: 400 });
  if (!(file instanceof File)) return new Response("File is required", { status: 400 });
  if (!isAllowedScriptFilename(file.name)) {
    return new Response("只允许上传 .skmode 文件", { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return new Response("文件过大（最大 10MB）", { status: 400 });
  }

  let id = "";
  let inserted = false;
  let r2Key = "";

  for (let attempt = 0; attempt < 5; attempt++) {
    id = crypto.randomUUID();
    r2Key = buildScriptShareR2Key(id);
    try {
      const buffer = await file.arrayBuffer();
      await r2.put(r2Key, buffer, {
        httpMetadata: {
          contentType: "application/octet-stream",
        },
      });

      await db
        .prepare(
          `INSERT INTO script_shares
           (id, owner_user_id, effect_name, public_username, lang, is_public, r2_key, original_filename, mime_type, size_bytes)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
        )
        .bind(
          id,
          authed.admin.id,
          effectName,
          publicUsername,
          lang,
          r2Key,
          file.name,
          file.type || "application/octet-stream",
          file.size
        )
        .run();

      inserted = true;
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE constraint failed: script_shares.id")) continue;
      console.error("admin create script share failed:", e);
      if (r2Key) await r2.delete(r2Key).catch(() => {});
      return new Response("上传失败，请稍后重试", { status: 500 });
    }
  }

  if (!inserted) return new Response("生成脚本 ID 失败，请稍后重试", { status: 500 });

  const nowIso = new Date().toISOString();
  return Response.json({
    id,
    ownerUserId: authed.admin.id,
    ownerUsername: authed.admin.username,
    ownerEmail: authed.admin.email,
    effectName,
    publicUsername,
    lang,
    isPublic: true,
    originalFilename: file.name,
    sizeBytes: file.size,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
}


