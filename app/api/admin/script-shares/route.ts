import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../../_utils/scriptSharesTable";
import {
  buildScriptShareR2Key,
  containsCjkCharacters,
  isAllowedScriptFilename,
  sanitizeDisplayText,
  sha256HexFromArrayBuffer,
} from "../../_utils/scriptShares";
import { buildScriptShareCoverR2Key, decodeScriptTextPreview, generateScriptShareCoverSvg } from "../../_utils/scriptShareCover";
import { requireAdminFromRequest } from "../_utils/adminSession";
import { normalizeAppLanguage, type AppLanguage } from "../../_utils/appLanguage";
import { getOfficialPublicNickname } from "../../../_utils/officialPublicNickname";
import { writeAdminAuditLog } from "../../_utils/adminAuditLogs";
import { assertSameOriginOrNoOrigin } from "../../_utils/requestOrigin";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { normalizeDbUtcDateTimeToIso } from "../../_utils/dbTime";

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

export const GET = withApiMonitoring(async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureScriptSharesTable(db);

  const { searchParams } = new URL(request.url);
  const includePrivate =
    authed.admin.isSuperAdmin &&
    (searchParams.get("includePrivate") === "1" ||
      String(searchParams.get("includePrivate") ?? "").toLowerCase() === "true");
  const reason = (searchParams.get("reason") ?? "").trim() || null;
  const langParam = (searchParams.get("lang") ?? "").trim();
  const lang = langParam && langParam !== "all" ? normalizeAppLanguage(langParam) : null;
  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(searchParams.get("pageSize"), 20, 1, 50);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length > 80) {
    return new Response("Invalid q", { status: 400 });
  }
  if (reason && reason.length > 120) {
    return new Response("Invalid reason", { status: 400 });
  }
  const offset = (page - 1) * pageSize;

  const whereParts: string[] = [];
  const binds: unknown[] = [];

  // Normal admins: only public. Super admin: public by default, private only with explicit includePrivate=1.
  if (!includePrivate) {
    whereParts.push("s.is_public = 1");
  }

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
         s.is_pinned,
         s.pinned_at,
         s.original_filename,
         s.size_bytes,
         s.created_at,
         s.updated_at
       FROM script_shares s
       JOIN users u ON u.id = s.owner_user_id
       ${whereSql}
       ORDER BY s.is_pinned DESC, s.pinned_at DESC, s.created_at DESC
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
      is_pinned: number;
      pinned_at: string | null;
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
    isPinned: !!r.is_pinned,
    pinnedAt: normalizeDbUtcDateTimeToIso(r.pinned_at),
    coverUrl: `/api/script-shares/${encodeURIComponent(r.id)}/cover`,
    originalFilename: r.original_filename,
    sizeBytes: r.size_bytes,
    createdAt: normalizeDbUtcDateTimeToIso(r.created_at) ?? r.created_at,
    updatedAt: normalizeDbUtcDateTimeToIso(r.updated_at) ?? r.updated_at,
  }));

  if (includePrivate) {
    await writeAdminAuditLog({
      db,
      request,
      actor: { id: authed.admin.id, role: authed.admin.role },
      action: "list_private_scripts",
      targetType: "script_share",
      targetId: "*",
      reason,
      meta: { lang: lang ?? "all", q: q || null, page, pageSize },
    });
  }

  return Response.json({ items, total, page, pageSize });
}, { name: "GET /api/admin/script-shares" });

/**
 * Admin upload: always public.
 * multipart:
 * - effectName (required)
 * - publicUsername (optional, default admin username)
 * - lang (required: zh-CN / en-US; defaults to zh-CN)
 * - file (.skmode)
 */
export const POST = withApiMonitoring(async function POST(request: Request) {
  const originGuard = assertSameOriginOrNoOrigin(request);
  if (originGuard) return originGuard;

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
  const defaultPublicUsername = getOfficialPublicNickname(lang);
  const publicUsername = sanitizeDisplayText(
    typeof publicUsernameRaw === "string" ? publicUsernameRaw : defaultPublicUsername,
    40
  );

  if (!effectName) return new Response("脚本效果名字不能为空", { status: 400 });
  if (!publicUsername) return new Response("公开展示的昵称不能为空", { status: 400 });
  if (lang === "en-US" && containsCjkCharacters(effectName)) {
    return new Response("英文区上传：脚本名字不能包含中文字符", { status: 400 });
  }
  if (!(file instanceof File)) return new Response("File is required", { status: 400 });
  if (!isAllowedScriptFilename(file.name)) {
    return new Response("只允许上传 .skmode 文件", { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return new Response("文件过大（最大 10MB）", { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const contentHash = await sha256HexFromArrayBuffer(buffer);
  const id = `pub_${lang}_${contentHash}`;
  const r2Key = buildScriptShareR2Key(id);

  const existing = await db
    .prepare(`SELECT id, owner_user_id, effect_name FROM script_shares WHERE id = ? LIMIT 1`)
    .bind(id)
    .all<{ id: string; owner_user_id: number; effect_name: string }>();
  const existedRow = existing.results?.[0];
  if (existedRow) {
    return new Response(
      `该脚本已被公开分享（效果名：${existedRow.effect_name}）。你可以搜索此效果名下载验证。`,
      { status: 409 }
    );
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
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`
      )
      .bind(
        id,
        authed.admin.id,
        effectName,
        publicUsername,
        lang,
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
    {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error(
        "admin create script share failed:",
        JSON.stringify(
          {
            name: err.name,
            message: err.message,
            stack:
              process.env.NODE_ENV === "development"
                ? err.stack?.slice(0, 2000)
                : undefined,
          },
          null,
          0
        )
      );
    }
    await r2.delete(r2Key).catch(() => {});
    if (coverKey) await r2.delete(coverKey).catch(() => {});
    return new Response("上传失败，请稍后重试", { status: 500 });
  }

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
    coverUrl: `/api/script-shares/${encodeURIComponent(id)}/cover`,
    originalFilename: file.name,
    sizeBytes: file.size,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
}, { name: "POST /api/admin/script-shares" });


