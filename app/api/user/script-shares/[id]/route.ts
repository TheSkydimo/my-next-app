import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../../../_utils/scriptSharesTable";
import {
  buildScriptShareR2Key,
  isAllowedScriptFilename,
  sanitizeDisplayText,
  sha256HexFromArrayBuffer,
} from "../../../_utils/scriptShares";
import {
  buildScriptShareCoverR2Key,
  decodeScriptTextPreview,
  generateScriptShareCoverSvg,
} from "../../../_utils/scriptShareCover";
import { requireUserFromRequest } from "../../_utils/userSession";
import {
  deleteScriptShareInteractions,
  ensureScriptShareInteractionsTables,
} from "../../../_utils/scriptShareInteractionsTable";

type DbRow = {
  id: string;
  owner_user_id: number;
  effect_name: string;
  public_username: string;
  lang: string;
  is_public: number;
  r2_key: string;
  cover_r2_key: string | null;
  cover_mime_type: string | null;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
};

async function loadShareById(db: D1Database, id: string): Promise<DbRow | null> {
  const { results } = await db
    .prepare(
      `SELECT id, owner_user_id, effect_name, public_username, lang, is_public, r2_key, cover_r2_key, cover_mime_type, original_filename, mime_type, size_bytes, created_at, updated_at
       FROM script_shares WHERE id = ? LIMIT 1`
    )
    .bind(id)
    .all<DbRow>();
  return results?.[0] ?? null;
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureScriptSharesTable(db);

  const row = await loadShareById(db, id);
  if (!row) return new Response("Not found", { status: 404 });
  if (row.owner_user_id !== authed.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = (await request.json()) as { effectName?: string; publicUsername?: string };
  const effectName = body.effectName != null ? sanitizeDisplayText(body.effectName, 80) : null;
  const publicUsername =
    body.publicUsername != null ? sanitizeDisplayText(body.publicUsername, 40) : null;

  if (effectName === "") return new Response("脚本效果名字不能为空", { status: 400 });
  if (publicUsername === "") return new Response("公开展示的昵称不能为空", { status: 400 });

  const nextEffect = effectName ?? row.effect_name;
  const nextPublic = publicUsername ?? row.public_username;

  await db
    .prepare(
      `UPDATE script_shares
       SET effect_name = ?, public_username = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(nextEffect, nextPublic, id)
    .run();

  return Response.json({
    ok: true,
    id,
    effectName: nextEffect,
    publicUsername: nextPublic,
    updatedAt: new Date().toISOString(),
  });
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureScriptSharesTable(db);

  const row = await loadShareById(db, id);
  if (!row) return new Response("Not found", { status: 404 });
  if (row.owner_user_id !== authed.user.id) {
    return new Response("Forbidden", { status: 403 });
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

  const buffer = await file.arrayBuffer();
  const contentHash = await sha256HexFromArrayBuffer(buffer);
  const targetId =
    row.is_public ? `pub_${row.lang}_${contentHash}` : `pri_${row.owner_user_id}_${contentHash}`;

  // Same content: keep the same id, just update stored file metadata/object.
  if (targetId === id) {
    const r2Key = buildScriptShareR2Key(id);
    await r2.put(r2Key, buffer, {
      httpMetadata: { contentType: "application/octet-stream" },
    });

    await db
      .prepare(
        `UPDATE script_shares
         SET r2_key = ?, original_filename = ?, mime_type = ?, size_bytes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(
        r2Key,
        file.name,
        file.type || "application/octet-stream",
        file.size,
        id
      )
      .run();

    return Response.json({ ok: true, id, updatedAt: new Date().toISOString() });
  }

  // Content changed: id must change too. We migrate by inserting a new row and deleting the old row.
  const existsRes = await db
    .prepare(`SELECT id, owner_user_id FROM script_shares WHERE id = ? LIMIT 1`)
    .bind(targetId)
    .all<{ id: string; owner_user_id: number }>();
  const existsRow = existsRes.results?.[0] ?? null;

  if (existsRow) {
    // Public: unique per lang (id includes lang). Private: unique per owner (id includes owner).
    if (row.is_public) {
      const effectRow = await db
        .prepare(`SELECT effect_name FROM script_shares WHERE id = ? LIMIT 1`)
        .bind(targetId)
        .all<{ effect_name: string }>();
      const effect = effectRow.results?.[0]?.effect_name || "（未知）";
      return new Response(
        `该脚本已被公开分享（效果名：${effect}）。你可以搜索此效果名下载验证。`,
        { status: 409 }
      );
    }

    // Dedup: delete old share and its objects, point to existing id.
    await ensureScriptShareInteractionsTables(db);
    await deleteScriptShareInteractions({ db, scriptId: id });
    await db.prepare("DELETE FROM script_shares WHERE id = ?").bind(id).run();
    if (row.r2_key) await r2.delete(row.r2_key).catch(() => {});
    if (row.cover_r2_key) await r2.delete(row.cover_r2_key).catch(() => {});
    return Response.json({
      ok: true,
      id: targetId,
      oldId: id,
      deduped: true,
      updatedAt: new Date().toISOString(),
    });
  }

  const newR2Key = buildScriptShareR2Key(targetId);
  let newCoverKey = "";
  let newCoverMime: string | null = null;
  try {
    await r2.put(newR2Key, buffer, {
      httpMetadata: { contentType: "application/octet-stream" },
    });

    const scriptText = decodeScriptTextPreview(buffer);
    const { svg, mimeType } = generateScriptShareCoverSvg({
      id: targetId,
      effectName: row.effect_name,
      publicUsername: row.public_username,
      lang: row.lang,
      scriptText,
    });
    newCoverKey = buildScriptShareCoverR2Key(targetId);
    newCoverMime = mimeType;
    await r2.put(newCoverKey, svg, { httpMetadata: { contentType: mimeType } });

    await db
      .prepare(
        `INSERT INTO script_shares
         (id, owner_user_id, effect_name, public_username, lang, is_public, r2_key, cover_r2_key, cover_mime_type, cover_updated_at, original_filename, mime_type, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`
      )
      .bind(
        targetId,
        row.owner_user_id,
        row.effect_name,
        row.public_username,
        row.lang,
        row.is_public,
        newR2Key,
        newCoverKey,
        newCoverMime,
        file.name,
        file.type || "application/octet-stream",
        file.size
      )
      .run();

    await ensureScriptShareInteractionsTables(db);
    await deleteScriptShareInteractions({ db, scriptId: id });
    await db.prepare("DELETE FROM script_shares WHERE id = ?").bind(id).run();
    if (row.r2_key) await r2.delete(row.r2_key).catch(() => {});
    if (row.cover_r2_key) await r2.delete(row.cover_r2_key).catch(() => {});

    return Response.json({
      ok: true,
      id: targetId,
      oldId: id,
      migrated: true,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("reupload migrate failed:", e);
    await r2.delete(newR2Key).catch(() => {});
    if (newCoverKey) await r2.delete(newCoverKey).catch(() => {});
    return new Response("重新上传失败", { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureScriptSharesTable(db);

  const row = await loadShareById(db, id);
  if (!row) return new Response("Not found", { status: 404 });
  if (row.owner_user_id !== authed.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  await ensureScriptShareInteractionsTables(db);
  await deleteScriptShareInteractions({ db, scriptId: id });
  await db.prepare("DELETE FROM script_shares WHERE id = ?").bind(id).run();
  if (row.r2_key) await r2.delete(row.r2_key).catch(() => {});
  if (row.cover_r2_key) await r2.delete(row.cover_r2_key).catch(() => {});

  return Response.json({ ok: true });
}


