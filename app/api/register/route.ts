import { getCloudflareContext } from "@opennextjs/cloudflare";

// 简单的 SHA256 工具，用于密码哈希
async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 简单邮箱格式校验
function isValidEmail(email: string): boolean {
  // 这里只做一个基础校验，避免引入额外依赖
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const { username, email, password } = (await request.json()) as {
    username: string;
    email: string;
    password: string;
  };

  if (!username || !email || !password) {
    return new Response("用户名、邮箱和密码不能为空", { status: 400 });
  }

  if (!isValidEmail(email)) {
    return new Response("邮箱格式不正确", { status: 400 });
  }

  if (password.length < 6) {
    return new Response("密码长度不能少于 6 位", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const password_hash = await sha256(password);

  try {
    await db
      .prepare(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
      )
      .bind(username, email, password_hash)
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    if (msg.includes("UNIQUE constraint failed: users.username")) {
      return new Response("用户名已被注册", { status: 400 });
    }

    if (msg.includes("UNIQUE constraint failed: users.email")) {
      return new Response("邮箱已被注册", { status: 400 });
    }

    console.error("注册用户失败:", e);
    return new Response("注册失败，请稍后再试", { status: 500 });
  }

  return Response.json({ ok: true });
}
