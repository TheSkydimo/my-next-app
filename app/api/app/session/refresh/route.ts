import { getCloudflareContext } from "@opennextjs/cloudflare";
import { assertSameOriginOrNoOrigin } from "../../../_utils/requestOrigin";
import { getSessionSecret } from "../../../_utils/sessionSecret";
import { getRequestCookie, serializeCookie } from "../../../_utils/cookies";
import {
  createSessionToken,
  getSessionCookieName,
  verifySessionToken,
} from "../../../_utils/session";
import { isSecureRequest } from "../../../_utils/request";
import { getSessionCookieDomain } from "../../../_utils/sessionCookieDomain";
import {
  ensureUsersAvatarUrlColumn,
  ensureUsersSessionJtiColumn,
} from "../../../_utils/usersTable";
import { unauthorizedWithClearedSession } from "../../../_utils/unauthorized";
import { convertDbAvatarUrlToPublicUrl } from "../../../_utils/r2ObjectUrls";
import { consumeRateLimit } from "../../../_utils/rateLimit";
import { sha256 } from "../../../_utils/auth";
import { resolveRequestLanguage } from "../../../_utils/requestLanguage";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

type UserRow = {
  id: number;
  username: string;
  avatar_url: string | null;
  session_jti?: string | null;
};

/**
 * App session refresh (sliding expiration).
 *
 * Contract:
 * - Requires existing `user_session` cookie.
 * - If session is valid, rotates `session_jti` and re-issues a new 7-day cookie/token.
 * - If session is missing/invalid/expired, returns 401 and clears cookie.
 *
 * Response (current):
 * - { ok: true, user: { username, avatarUrl } }
 * Future fields can be added under `user` (e.g. vipExpiresAt).
 */
export const POST = withApiMonitoring(async function POST(request: Request) {
  const originGuard = assertSameOriginOrNoOrigin(request);
  if (originGuard) return originGuard;

  const lang = resolveRequestLanguage({ request });
  const msg =
    lang === "en-US"
      ? {
          sessionNotConfigured: "Session is not configured.",
          internalError: "Internal server error.",
          tooManyRequests: "Too many requests. Please try again later.",
        }
      : {
          sessionNotConfigured: "会话未配置",
          internalError: "服务器内部错误",
          tooManyRequests: "请求过于频繁，请稍后再试",
        };

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const sessionSecret = getSessionSecret(env);
  if (!sessionSecret) {
    return new Response(msg.sessionNotConfigured, {
      status: 501,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const token = getRequestCookie(request, getSessionCookieName());
  if (!token) return unauthorizedWithClearedSession(request);

  const payload = await verifySessionToken({ secret: sessionSecret, token });
  if (!payload) return unauthorizedWithClearedSession(request);

  // Best-effort: ensure required columns exist (older DBs).
  try {
    await ensureUsersAvatarUrlColumn(db);
    await ensureUsersSessionJtiColumn(db);
  } catch {
    console.error("确保 users 表字段存在失败");
    return new Response(msg.internalError, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Rate limit per user (hashed) to reduce abuse.
  const rateKey = await sha256(`app-session-refresh:${payload.uid}`);
  const rl = await consumeRateLimit({
    db,
    key: rateKey,
    windowSeconds: 60,
    limit: 60,
  });
  if (!rl.allowed) {
    const headers = new Headers();
    headers.set("Cache-Control", "no-store");
    headers.set("Retry-After", String(Math.max(1, rl.resetAt - Math.floor(Date.now() / 1000))));
    return new Response(msg.tooManyRequests, { status: 429, headers });
  }

  const { results } = await db
    .prepare("SELECT id, username, avatar_url, session_jti FROM users WHERE id = ? LIMIT 1")
    .bind(payload.uid)
    .all<UserRow>();

  const row = results?.[0];
  if (!row) return unauthorizedWithClearedSession(request);

  // Single-session enforcement: accept only latest jti.
  if (typeof row.session_jti === "string" && row.session_jti && row.session_jti !== payload.jti) {
    return unauthorizedWithClearedSession(request, { reason: "session_replaced" });
  }

  // Issue refreshed 7-day session.
  const maxAgeSeconds = 60 * 60 * 24 * 7;
  const { token: newToken, payload: newPayload } = await createSessionToken({
    secret: sessionSecret,
    userId: row.id,
    maxAgeSeconds,
  });

  // Rotate session_jti so older tokens are invalidated immediately.
  await db
    .prepare("UPDATE users SET session_jti = ? WHERE id = ?")
    .bind(newPayload.jti, row.id)
    .run();

  const secure = isSecureRequest(request);
  const domain = getSessionCookieDomain(env);
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    serializeCookie(getSessionCookieName(), newToken, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      ...(domain ? { domain } : {}),
      path: "/",
      maxAge: maxAgeSeconds,
    })
  );
  headers.set("Cache-Control", "no-store");

  return Response.json(
    {
      ok: true,
      user: {
        username: row.username,
        avatarUrl: convertDbAvatarUrlToPublicUrl(row.avatar_url),
      },
    },
    { headers }
  );
}, { name: "POST /api/app/session/refresh" });

