import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sha256 } from "../_utils/auth";

export async function POST(request: Request) {
  // 解析请求体并显式标注类型，避免 request.json() 推断为 unknown
  const { email, password } = (await request.json()) as {
    email: string;
    password: string;
  };

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const password_hash = await sha256(password);

  const { results } = await db
    .prepare(`SELECT id, username, email FROM users WHERE email = ? AND password_hash = ?`)
    .bind(email, password_hash)
    .all();

  if (!results || results.length === 0) {
    return new Response("Invalid credentials", { status: 401 });
  }

  const user = results[0];

  // 登录成功（下一步可设置 Cookie Session）
  return Response.json({ ok: true, user });
}
