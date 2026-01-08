import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getOptionalUserIdFromRequest } from "../../user/_utils/userSession";
import { convertDbAvatarUrlToPublicUrl } from "../../_utils/r2ObjectUrls";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { buildSiteCorsHeaders } from "../../_utils/siteCors";

type Row = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
};

function json(data: unknown, init?: ResponseInit): Response {
  const res = Response.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const OPTIONS = withApiMonitoring(async function OPTIONS(request: Request) {
  const { env } = await getCloudflareContext();
  const cors = buildSiteCorsHeaders(env, request);
  return new Response(null, { status: 204, headers: { ...cors, "Cache-Control": "no-store" } });
}, { name: "OPTIONS /api/site/me" });

/**
 * Minimal "me" for official website navbar.
 *
 * Security:
 * - Auth via httpOnly session cookie only (no userId/email params).
 * - Returns minimal fields for navbar usage.
 * - no-store to prevent any edge/browser caching of user-specific data.
 * - CORS allowlist (SITE_ALLOWED_ORIGINS) for reading from skydimo.com.
 */
export const GET = withApiMonitoring(async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const cors = buildSiteCorsHeaders(env, request);
  const db = env.my_user_db as D1Database;

  const userId = await getOptionalUserIdFromRequest({ request, env, db });
  if (!userId) {
    return json({ loggedIn: false }, { headers: cors });
  }

  const { results } = await db
    .prepare("SELECT id, username, email, avatar_url FROM users WHERE id = ? LIMIT 1")
    .bind(userId)
    .all<Row>();

  const row = results?.[0];
  if (!row) {
    // Treat as logged out (stale cookie); do not leak extra details.
    return json({ loggedIn: false }, { headers: cors });
  }

  return json(
    {
      loggedIn: true,
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        avatarUrl: convertDbAvatarUrlToPublicUrl(row.avatar_url),
      },
    },
    { headers: cors }
  );
}, { name: "GET /api/site/me" });


