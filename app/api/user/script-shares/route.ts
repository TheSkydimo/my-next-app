import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../../_utils/scriptSharesTable";
import { ensureScriptShareInteractionsTables } from "../../_utils/scriptShareInteractionsTable";
import {
  buildScriptShareR2Key,
  containsCjkCharacters,
  isAllowedScriptFilename,
  sanitizeDisplayText,
  sha256HexFromArrayBuffer,
} from "../../_utils/scriptShares";
import { buildScriptShareCoverR2Key, decodeScriptTextPreview, generateScriptShareCoverSvg } from "../../_utils/scriptShareCover";
import { requireUserFromRequest } from "../_utils/userSession";
import { normalizeAppLanguage, type AppLanguage } from "../../_utils/appLanguage";

type ScriptShareListItem = {
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
  canManage: true;
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

export async function GET(request: Request) {
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

  const countRes = await db
    .prepare("SELECT COUNT(*) AS c FROM script_shares WHERE owner_user_id = ?")
    .bind(authed.user.id)
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
         s.original_filename,
         s.size_bytes,
         s.created_at,
         s.updated_at,
         (SELECT COUNT(*) FROM script_share_likes l WHERE l.script_id = s.id) AS like_count,
         (SELECT COUNT(*) FROM script_share_favorites f WHERE f.script_id = s.id) AS favorite_count,
         EXISTS(SELECT 1 FROM script_share_likes l WHERE l.script_id = s.id AND l.user_id = ?) AS liked_by_me,
         EXISTS(SELECT 1 FROM script_share_favorites f WHERE f.script_id = s.id AND f.user_id = ?) AS favorited_by_me,
         (
           SELECT CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END
           FROM script_share_likes l
           WHERE l.script_id = s.id AND l.user_id = ?
           LIMIT 1
         ) AS my_like_can_undo
       FROM script_shares s
       WHERE s.owner_user_id = ?
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(authed.user.id, authed.user.id, authed.user.id, authed.user.id, pageSize, offset)
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
      like_count: number;
      favorite_count: number;
      liked_by_me: number;
      favorited_by_me: number;
      my_like_can_undo: number | null;
    }>();

  const items: ScriptShareListItem[] = (results ?? []).map((r) => ({
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
    canManage: true,
    likeCount: r.like_count ?? 0,
    favoriteCount: r.favorite_count ?? 0,
    likedByMe: !!r.liked_by_me,
    favoritedByMe: !!r.favorited_by_me,
    likeCanUndo: r.my_like_can_undo === 1,
    likeLocked: !!r.liked_by_me && r.my_like_can_undo !== 1,
  }));

  return Response.json({ items, total, page, pageSize });
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureScriptSharesTable(db);

  const form = await request.formData();
  const effectNameRaw = form.get("effectName");
  const publicUsernameRaw = form.get("publicUsername");
  const file = form.get("file");

  const effectName = sanitizeDisplayText(
    typeof effectNameRaw === "string" ? effectNameRaw : "",
    80
  );
  const publicUsername = sanitizeDisplayText(
    typeof publicUsernameRaw === "string" ? publicUsernameRaw : "",
    40
  );
  const isPublicRaw = form.get("isPublic");
  const isPublic =
    isPublicRaw == null
      ? true
      : String(isPublicRaw).trim() === "1" ||
        String(isPublicRaw).trim().toLowerCase() === "true";

  const lang = normalizeAppLanguage(form.get("lang"));
  if (lang === "en-US" && containsCjkCharacters(effectName)) {
    return new Response("英文区上传：脚本名字不能包含中文字符", { status: 400 });
  }

  if (!effectName) return new Response("脚本效果名字不能为空", { status: 400 });
  if (!publicUsername) return new Response("公开展示的昵称不能为空", { status: 400 });
  if (!(file instanceof File)) return new Response("File is required", { status: 400 });
  if (!isAllowedScriptFilename(file.name)) {
    return new Response("只允许上传 .skmode 文件", { status: 400 });
  }
  // 10MB soft limit
  if (file.size > 10 * 1024 * 1024) {
    return new Response("文件过大（最大 10MB）", { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const contentHash = await sha256HexFromArrayBuffer(buffer);
  const id = isPublic ? `pub_${lang}_${contentHash}` : `pri_${authed.user.id}_${contentHash}`;
  const r2Key = buildScriptShareR2Key(id);

  const existing = await db
    .prepare(
      `SELECT id, owner_user_id, effect_name, public_username, lang, is_public, original_filename, size_bytes, created_at, updated_at
       FROM script_shares WHERE id = ? LIMIT 1`
    )
    .bind(id)
    .all<{
      id: string;
      owner_user_id: number;
      effect_name: string;
      public_username: string;
      lang: AppLanguage;
      is_public: number;
      original_filename: string;
      size_bytes: number;
      created_at: string;
      updated_at: string;
    }>();

  const existedRow = existing.results?.[0];
  if (existedRow) {
    if (isPublic) {
      return new Response(
        `该脚本已被公开分享（效果名：${existedRow.effect_name}）。你可以搜索此效果名下载验证。`,
        { status: 409 }
      );
    }
    return new Response("你已上传过相同内容的私有脚本", { status: 409 });
  }

  let coverKey = "";
  try {
    await r2.put(r2Key, buffer, {
      httpMetadata: {
        contentType: "application/octet-stream",
      },
    });

    const scriptText = decodeScriptTextPreview(buffer);
    const { svg, mimeType } = generateScriptShareCoverSvg({
      id,
      effectName,
      publicUsername,
      lang,
      scriptText,
    });
    coverKey = buildScriptShareCoverR2Key(id);
    await r2.put(coverKey, svg, { httpMetadata: { contentType: mimeType } });

    await db
      .prepare(
        `INSERT INTO script_shares
         (id, owner_user_id, effect_name, public_username, lang, is_public, r2_key, cover_r2_key, cover_mime_type, cover_updated_at, original_filename, mime_type, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`
      )
      .bind(
        id,
        authed.user.id,
        effectName,
        publicUsername,
        lang,
        isPublic ? 1 : 0,
        r2Key,
        coverKey,
        mimeType,
        file.name,
        file.type || "application/octet-stream",
        file.size
      )
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE constraint failed: script_shares.id")) {
      await r2.delete(r2Key).catch(() => {});
      if (coverKey) await r2.delete(coverKey).catch(() => {});
      if (isPublic) {
        const row = await db
          .prepare(`SELECT effect_name FROM script_shares WHERE id = ? LIMIT 1`)
          .bind(id)
          .all<{ effect_name: string }>();
        const effect = row.results?.[0]?.effect_name || "（未知）";
        return new Response(
          `该脚本已被公开分享（效果名：${effect}）。你可以搜索此效果名下载验证。`,
          { status: 409 }
        );
      }
      return new Response("你已上传过相同内容的私有脚本", { status: 409 });
    }
    console.error("create script share failed:", e);
    await r2.delete(r2Key).catch(() => {});
    if (coverKey) await r2.delete(coverKey).catch(() => {});
    return new Response("上传失败，请稍后重试", { status: 500 });
  }

  const nowIso = new Date().toISOString();
  return Response.json({
    id,
    effectName,
    publicUsername,
    lang,
    isPublic,
    coverUrl: `/api/script-shares/${encodeURIComponent(id)}/cover`,
    originalFilename: file.name,
    sizeBytes: file.size,
    createdAt: nowIso,
    updatedAt: nowIso,
    canManage: true,
    likeCount: 0,
    favoriteCount: 0,
    likedByMe: false,
    favoritedByMe: false,
    likeCanUndo: false,
    likeLocked: false,
  } satisfies ScriptShareListItem);
}


