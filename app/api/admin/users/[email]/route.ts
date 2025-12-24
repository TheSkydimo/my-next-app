import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAdminFromRequest } from "../../_utils/adminSession";
import { convertDbAvatarUrlToPublicUrl } from "../../../_utils/r2ObjectUrls";
import { ensureUsersAvatarUrlColumn } from "../../../_utils/usersTable";

type UserRow = {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  avatar_url: string | null;
  vip_expires_at: string | null;
  created_at: string;
};

export async function GET(
  request: Request,
  ctx: { params: Promise<{ email?: string }> }
) {
  const rawEmail = (await ctx.params)?.email ?? "";
  const email = rawEmail ? decodeURIComponent(rawEmail) : "";
  if (!email) {
    return new Response("缺少用户邮箱", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  // 兼容旧库：确保 avatar_url 字段存在
  await ensureUsersAvatarUrlColumn(db);

  const { results } = await db
    .prepare(
      "SELECT id, username, email, is_admin, avatar_url, vip_expires_at, created_at FROM users WHERE email = ? LIMIT 1"
    )
    .bind(email)
    .all<UserRow>();

  const row = results?.[0];
  if (!row) {
    return new Response("用户不存在", { status: 404 });
  }

  const isVip =
    !!row.vip_expires_at &&
    !Number.isNaN(new Date(row.vip_expires_at).getTime()) &&
    new Date(row.vip_expires_at).getTime() > Date.now();

  return Response.json(
    {
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        isAdmin: !!row.is_admin,
        avatarUrl: convertDbAvatarUrlToPublicUrl(row.avatar_url),
        isVip,
        vipExpiresAt: row.vip_expires_at,
        createdAt: row.created_at,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}


