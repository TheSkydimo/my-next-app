import { getCloudflareContext } from "@opennextjs/cloudflare";

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  const { username, password } = (await request.json()) as {
    username: string;
    password: string;
  };

  if (!username || !password) {
    return new Response("缺少用户名或密码", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const password_hash = await sha256(password);

  const { results } = await db
    .prepare(
      "SELECT id, username, email FROM users WHERE username = ? AND password_hash = ?"
    )
    .bind(username, password_hash)
    .all();

  if (!results || results.length === 0) {
    return new Response("用户名或密码错误", { status: 401 });
  }

  const user = results[0];

  // 这里先简单返回用户信息，后面再加 Cookie / Session
  return Response.json({ ok: true, user });
}
