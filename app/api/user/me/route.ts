import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getRequestCookie } from "../../_utils/cookies";
import { getSessionCookieName, verifySessionToken } from "../../_utils/session";
import { convertDbAvatarUrlToPublicUrl } from "../../_utils/r2ObjectUrls";
import { ensureUsersAvatarUrlColumn, ensureUsersIsAdminColumn } from "../../_utils/usersTable";
import { getRuntimeEnvVar } from "../../_utils/runtimeEnv";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

type UserRow = {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  avatar_url: string | null;
  created_at: string;
};

export const GET = withApiMonitoring(async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const sessionSecret = String(getRuntimeEnvVar(env, "SESSION_SECRET") ?? "");
  if (!sessionSecret) {
    return new Response("Session not configured", { status: 501 });
  }

  const token = getRequestCookie(request, getSessionCookieName());
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await verifySessionToken({ secret: sessionSecret, token });
  if (!payload) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = env.my_user_db as D1Database;
  try {
    await ensureUsersIsAdminColumn(db);
    await ensureUsersAvatarUrlColumn(db);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(
      "确保 users 表字段存在失败:",
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
    return new Response("服务器内部错误", { status: 500 });
  }

  const { results } = await db
    .prepare(
      "SELECT id, username, email, is_admin, avatar_url, created_at FROM users WHERE id = ?"
    )
    .bind(payload.uid)
    .all<UserRow>();

  const user = results?.[0];
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  return Response.json({
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: !!user.is_admin,
    avatarUrl: convertDbAvatarUrlToPublicUrl(user.avatar_url),
    createdAt: user.created_at,
  });
}, { name: "GET /api/user/me" });


