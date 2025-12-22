import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../../../_utils/scriptSharesTable";
import {
  buildScriptShareR2Key,
  containsCjkCharacters,
  isAllowedScriptFilename,
  sanitizeDisplayText,
} from "../../../_utils/scriptShares";
import { requireAdminFromRequest } from "../../_utils/adminSession";
import { normalizeAppLanguage } from "../../../_utils/appLanguage";

type DbRow = {
  id: string;
  owner_user_id: number;
  r2_key: string;
  effect_name: string;
  public_username: string;
  lang: string;
  is_public: number;
};

async function loadById(db: D1Database, id: string): Promise<DbRow | null> {
  const { results } = await db
    .prepare(
      "SELECT id, owner_user_id, r2_key, effect_name, public_username, lang, is_public FROM script_shares WHERE id = ? LIMIT 1"
    )
    .bind(id)
    .all<DbRow>();
  return results?.[0] ?? null;
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureScriptSharesTable(db);

  const row = await loadById(db, id);
  if (!row) return new Response("Not found", { status: 404 });

  await db.prepare("DELETE FROM script_shares WHERE id = ?").bind(id).run();
  if (row.r2_key) await r2.delete(row.r2_key).catch(() => {});

  return Response.json({ ok: true });
}

/**
 * Admin reupload file for an existing share (still .skmode).
 */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureScriptSharesTable(db);

  const row = await loadById(db, id);
  if (!row) return new Response("Not found", { status: 404 });
  // Admins are not allowed to re-upload scripts owned by other users.
  // Reason: admins cannot access the original user file; reuploading would corrupt user-owned assets.
  if (row.owner_user_id !== authed.admin.id) {
    return new Response("禁止重传：该脚本归属用户，管理端不能重传", { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new Response("File is required", { status: 400 });
  if (!isAllowedScriptFilename(file.name)) {
    return new Response("只允许上传 .skmode 文件", { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return new Response("文件过大（最大 10MB）", { status: 400 });
  }

  const r2Key = buildScriptShareR2Key(id);
  const buffer = await file.arrayBuffer();
  await r2.put(r2Key, buffer, {
    httpMetadata: { contentType: "application/octet-stream" },
  });

  await db
    .prepare(
      `UPDATE script_shares
       SET r2_key = ?, original_filename = ?, mime_type = ?, size_bytes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(r2Key, file.name, file.type || "application/octet-stream", file.size, id)
    .run();

  return Response.json({ ok: true, id, updatedAt: new Date().toISOString() });
}

/**
 * Admin edit metadata / visibility.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureScriptSharesTable(db);

  const row = await loadById(db, id);
  if (!row) return new Response("Not found", { status: 404 });

  const body = (await request.json()) as {
    effectName?: string;
    publicUsername?: string;
    isPublic?: boolean;
  };

  const effectName =
    body.effectName != null ? sanitizeDisplayText(body.effectName, 80) : null;
  const publicUsername =
    body.publicUsername != null ? sanitizeDisplayText(body.publicUsername, 40) : null;
  const isPublic = body.isPublic != null ? !!body.isPublic : null;

  if (effectName === "") return new Response("脚本效果名字不能为空", { status: 400 });
  if (publicUsername === "") return new Response("公开展示的昵称不能为空", { status: 400 });
  if (effectName && normalizeAppLanguage(row.lang) === "en-US" && containsCjkCharacters(effectName)) {
    return new Response("英文区脚本：名字不能包含中文字符", { status: 400 });
  }

  const nextEffect = effectName ?? row.effect_name;
  const nextPublic = publicUsername ?? row.public_username;
  const nextIsPublic = isPublic == null ? row.is_public : isPublic ? 1 : 0;

  await db
    .prepare(
      `UPDATE script_shares
       SET effect_name = ?, public_username = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(nextEffect, nextPublic, nextIsPublic, id)
    .run();

  return Response.json({
    ok: true,
    id,
    effectName: nextEffect,
    publicUsername: nextPublic,
    isPublic: !!nextIsPublic,
    updatedAt: new Date().toISOString(),
  });
}


