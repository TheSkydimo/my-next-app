import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sha256 } from "../_utils/auth";

type UserRow = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  is_admin: number;
};

export async function POST(request: Request) {
  // 解析请求体并显式标注类型，避免 request.json() 推断为 unknown
  const { email, password } = (await request.json()) as {
    email: string;
    password: string;
  };

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const password_hash = await sha256(password);

  // 返回完整用户信息，包括 avatar_url，以便登录后直接使用，无需再次请求
  const { results } = await db
    .prepare(
      `SELECT id, username, email, avatar_url, is_admin FROM users WHERE email = ? AND password_hash = ?`
    )
    .bind(email, password_hash)
    .all<UserRow>();

  if (!results || results.length === 0) {
    return new Response("Invalid credentials", { status: 401 });
  }

  const row = results[0];

  // 登录成功，返回完整用户信息（下一步可设置 Cookie Session）
  return Response.json({
    ok: true,
    user: {
      id: row.id,
      username: row.username,
      email: row.email,
      avatarUrl: row.avatar_url,
      isAdmin: !!row.is_admin,
    },
  });
}
