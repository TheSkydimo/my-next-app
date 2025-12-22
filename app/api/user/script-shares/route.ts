import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../../_utils/scriptSharesTable";
import { buildScriptShareR2Key, containsCjkCharacters, isAllowedScriptFilename, sanitizeDisplayText } from "../../_utils/scriptShares";
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
      `SELECT id, effect_name, public_username, lang, is_public, original_filename, size_bytes, created_at, updated_at
       FROM script_shares
       WHERE owner_user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(authed.user.id, pageSize, offset)
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

  // Generate unique id (extremely low collision, still retry).
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

      const scriptText = decodeScriptTextPreview(buffer);
      const { svg, mimeType } = generateScriptShareCoverSvg({
        id,
        effectName,
        publicUsername,
        lang,
        scriptText,
      });
      const coverKey = buildScriptShareCoverR2Key(id);
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

      inserted = true;
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE constraint failed: script_shares.id")) {
        // Rare collision, retry with new UUID.
        continue;
      }

      console.error("create script share failed:", e);
      // Best-effort cleanup if put succeeded.
      if (r2Key) {
        await r2.delete(r2Key).catch(() => {});
      }
      await r2.delete(buildScriptShareCoverR2Key(id)).catch(() => {});
      return new Response("上传失败，请稍后重试", { status: 500 });
    }
  }

  if (!inserted) return new Response("生成脚本 ID 失败，请稍后重试", { status: 500 });

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
  } satisfies ScriptShareListItem);
}


