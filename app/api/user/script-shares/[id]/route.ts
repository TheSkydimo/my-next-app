import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../../../_utils/scriptSharesTable";
import { buildScriptShareR2Key, isAllowedScriptFilename, sanitizeDisplayText } from "../../../_utils/scriptShares";
import { requireUserFromRequest } from "../../_utils/userSession";

type DbRow = {
  id: string;
  owner_user_id: number;
  effect_name: string;
  public_username: string;
  r2_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
};

async function loadShareById(db: D1Database, id: string): Promise<DbRow | null> {
  const { results } = await db
    .prepare(
      `SELECT id, owner_user_id, effect_name, public_username, r2_key, original_filename, mime_type, size_bytes, created_at, updated_at
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
  if (row.owner_user_id !== authed.user.id && !authed.user.isAdmin) {
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
  if (row.owner_user_id !== authed.user.id && !authed.user.isAdmin) {
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
  if (row.owner_user_id !== authed.user.id && !authed.user.isAdmin) {
    return new Response("Forbidden", { status: 403 });
  }

  await db.prepare("DELETE FROM script_shares WHERE id = ?").bind(id).run();
  if (row.r2_key) await r2.delete(row.r2_key).catch(() => {});

  return Response.json({ ok: true });
}


