import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureScriptSharesTable } from "../../../_utils/scriptSharesTable";
import { SCRIPT_SHARE_R2_PREFIX } from "../../../_utils/scriptShares";
import {
  buildScriptShareCoverR2Key,
  decodeScriptTextPreview,
  generateScriptShareCoverSvg,
  SCRIPT_SHARE_COVER_R2_PREFIX,
} from "../../../_utils/scriptShareCover";
import { requireUserFromRequest } from "../../../user/_utils/userSession";

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
};

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  await ensureScriptSharesTable(db);

  const { results } = await db
    .prepare(
      `SELECT id, owner_user_id, effect_name, public_username, lang, is_public, r2_key, cover_r2_key, cover_mime_type
       FROM script_shares
       WHERE id = ? LIMIT 1`
    )
    .bind(id)
    .all<DbRow>();

  const row = results?.[0];
  if (!row) return new Response("Not found", { status: 404 });

  // Private scripts: only owner/admin can view cover.
  if (!row.is_public) {
    const authed = await requireUserFromRequest({ request, env, db });
    if (authed instanceof Response) return authed;
    if (authed.user.id !== row.owner_user_id && !authed.user.isAdmin) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const cacheControl = row.is_public ? "public, max-age=86400" : "private, max-age=60";

  if (row.cover_r2_key) {
    if (!row.cover_r2_key.startsWith(SCRIPT_SHARE_COVER_R2_PREFIX)) {
      return new Response("Invalid key", { status: 400 });
    }
    const obj = await r2.get(row.cover_r2_key);
    if (obj) {
      const headers = new Headers();
      headers.set("Content-Type", row.cover_mime_type || obj.httpMetadata?.contentType || "image/svg+xml");
      headers.set("ETag", obj.httpEtag);
      headers.set("Cache-Control", cacheControl);
      return new Response(obj.body, { headers });
    }
    // If cover key exists but object missing, fall through to regenerate.
  }

  if (!row.r2_key || !row.r2_key.startsWith(SCRIPT_SHARE_R2_PREFIX)) {
    return new Response("Invalid key", { status: 400 });
  }

  const scriptObj = await r2.get(row.r2_key);
  if (!scriptObj) return new Response("File not found", { status: 404 });

  const buf = await scriptObj.arrayBuffer();
  const scriptText = decodeScriptTextPreview(buf);
  const { svg, mimeType } = generateScriptShareCoverSvg({
    id: row.id,
    effectName: row.effect_name,
    publicUsername: row.public_username,
    lang: row.lang,
    scriptText,
  });

  const coverKey = buildScriptShareCoverR2Key(row.id);
  await r2.put(coverKey, svg, {
    httpMetadata: { contentType: mimeType },
  });

  await db
    .prepare(
      `UPDATE script_shares
       SET cover_r2_key = ?, cover_mime_type = ?, cover_updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(coverKey, mimeType, row.id)
    .run();

  const headers = new Headers();
  headers.set("Content-Type", `${mimeType}; charset=utf-8`);
  headers.set("Cache-Control", cacheControl);
  return new Response(svg, { headers });
}


