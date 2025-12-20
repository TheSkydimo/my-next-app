import { getRequestCookie } from "../../_utils/cookies";
import { getRuntimeEnvVar } from "../../_utils/runtimeEnv";
import { getSessionCookieName, verifySessionToken } from "../../_utils/session";
import { convertDbAvatarUrlToPublicUrl } from "../../_utils/r2ObjectUrls";
import {
  ensureUsersAvatarUrlColumn,
  ensureUsersIsAdminColumn,
  ensureUsersIsSuperAdminColumn,
} from "../../_utils/usersTable";

export type AdminAuthedUser = {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  role: "super_admin" | "admin";
};

type AdminRow = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  is_admin: number;
  is_super_admin: number;
};

export async function requireAdminFromRequest(options: {
  request: Request;
  env: unknown;
  db: D1Database;
}): Promise<{ admin: AdminAuthedUser } | Response> {
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
    await ensureUsersIsSuperAdminColumn(db);
    await ensureUsersAvatarUrlColumn(db);
  } catch (e) {
    console.error("ensure users columns failed:", e);
    return new Response("服务器内部错误", { status: 500 });
  }

  const { results } = await db
    .prepare(
      "SELECT id, username, email, avatar_url, is_admin, is_super_admin FROM users WHERE id = ? LIMIT 1"
    )
    .bind(payload.uid)
    .all<AdminRow>();

  const row = results?.[0];
  if (!row) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!row.is_admin) {
    return new Response("无权访问：不是管理员账号", { status: 403 });
  }

  const isSuperAdmin = !!row.is_super_admin;
  return {
    admin: {
      id: row.id,
      username: row.username,
      email: row.email,
      avatarUrl: convertDbAvatarUrlToPublicUrl(row.avatar_url),
      isSuperAdmin,
      role: isSuperAdmin ? "super_admin" : "admin",
    },
  };
}

export async function requireSuperAdminFromRequest(options: {
  request: Request;
  env: unknown;
  db: D1Database;
}): Promise<{ admin: AdminAuthedUser } | Response> {
  const res = await requireAdminFromRequest(options);
  if (res instanceof Response) return res;
  if (!res.admin.isSuperAdmin) {
    return new Response("无权执行该操作：需要超级管理员权限", { status: 403 });
  }
  return res;
}


