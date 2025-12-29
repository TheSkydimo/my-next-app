import { getRequestCookie } from "../../_utils/cookies";
import { getRuntimeEnvVar } from "../../_utils/runtimeEnv";
import { getSessionCookieName, verifySessionToken } from "../../_utils/session";
import { convertDbAvatarUrlToPublicUrl } from "../../_utils/r2ObjectUrls";
import { ensureUsersAvatarUrlColumn, ensureUsersIsAdminColumn } from "../../_utils/usersTable";
import { unauthorizedWithClearedSession } from "../../_utils/unauthorized";

export type UserAuthed = {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
};

type UserRow = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  is_admin: number;
  created_at: string;
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
    return unauthorizedWithClearedSession(request);
  }

  const payload = await verifySessionToken({ secret: sessionSecret, token });
  if (!payload) {
    return unauthorizedWithClearedSession(request);
  }

  // Best-effort: ensure required columns exist.
  try {
    await ensureUsersIsAdminColumn(db);
    await ensureUsersAvatarUrlColumn(db);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(
      "ensure users columns failed:",
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
    .prepare("SELECT id, username, email, avatar_url, is_admin, created_at FROM users WHERE id = ? LIMIT 1")
    .bind(payload.uid)
    .all<UserRow>();

  const row = results?.[0];
  if (!row) {
    return unauthorizedWithClearedSession(request);
  }

  return {
    user: {
      id: row.id,
      username: row.username,
      email: row.email,
      avatarUrl: convertDbAvatarUrlToPublicUrl(row.avatar_url),
      isAdmin: !!row.is_admin,
      createdAt: row.created_at,
    },
  };
}

export async function getOptionalUserIdFromRequest(options: {
  request: Request;
  env: unknown;
  db: D1Database;
}): Promise<number | null> {
  const { request, env, db } = options;

  const sessionSecret = String(getRuntimeEnvVar(env, "SESSION_SECRET") ?? "");
  if (!sessionSecret) return null;

  const token = getRequestCookie(request, getSessionCookieName());
  if (!token) return null;

  const payload = await verifySessionToken({ secret: sessionSecret, token });
  if (!payload) return null;

  // Make sure the user still exists.
  const { results } = await db
    .prepare("SELECT id FROM users WHERE id = ? LIMIT 1")
    .bind(payload.uid)
    .all<{ id: number }>();

  return results?.[0]?.id ?? null;
}


