import { getRequestCookie } from "../../_utils/cookies";
import { getRuntimeEnvVar } from "../../_utils/runtimeEnv";
import { getSessionCookieName, verifySessionToken } from "../../_utils/session";
import { convertDbAvatarUrlToPublicUrl } from "../../_utils/r2ObjectUrls";
import { ensureUsersAvatarUrlColumn, ensureUsersIsAdminColumn } from "../../_utils/usersTable";

export type UserAuthed = {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

type UserRow = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  is_admin: number;
};

export async function requireUserFromRequest(options: {
  request: Request;
  env: unknown;
  db: D1Database;
}): Promise<{ user: UserAuthed } | Response> {
  const { request, env, db } = options;

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

  // Best-effort: ensure required columns exist.
  try {
    await ensureUsersIsAdminColumn(db);
    await ensureUsersAvatarUrlColumn(db);
  } catch (e) {
    console.error("ensure users columns failed:", e);
    return new Response("服务器内部错误", { status: 500 });
  }

  const { results } = await db
    .prepare("SELECT id, username, email, avatar_url, is_admin FROM users WHERE id = ? LIMIT 1")
    .bind(payload.uid)
    .all<UserRow>();

  const row = results?.[0];
  if (!row) {
    return new Response("Unauthorized", { status: 401 });
  }

  return {
    user: {
      id: row.id,
      username: row.username,
      email: row.email,
      avatarUrl: convertDbAvatarUrlToPublicUrl(row.avatar_url),
      isAdmin: !!row.is_admin,
    },
  };
}


