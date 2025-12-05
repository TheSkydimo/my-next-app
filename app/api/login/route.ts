import { getCloudflareContext } from "@opennextjs/cloudflare";

// SHA256 hash 工具
async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  // 解析请求体并显式标注类型，避免 request.json() 推断为 unknown
  const { username, password } = (await request.json()) as {
    username: string;
    password: string;
  };

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const password_hash = await sha256(password);

  const { results } = await db
    .prepare(`SELECT id FROM users WHERE username = ? AND password_hash = ?`)
    .bind(username, password_hash)
    .all();

  if (!results || results.length === 0) {
    return new Response("Invalid credentials", { status: 401 });
  }

  // 登录成功（下一步可设置 Cookie Session）
  return Response.json({ ok: true });
}
