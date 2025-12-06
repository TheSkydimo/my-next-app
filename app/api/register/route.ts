import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isValidEmail, sha256 } from "../_utils/auth";
import { verifyAndUseEmailCode } from "../_utils/emailCode";

export async function POST(request: Request) {
  const { username, email, password, emailCode } = (await request.json()) as {
    username: string;
    email: string;
    password: string;
    emailCode?: string;
  };

  if (!username || !email || !password) {
    return new Response("用户名、邮箱和密码不能为空", { status: 400 });
  }

  if (!emailCode) {
    return new Response("请先完成邮箱验证码验证", { status: 400 });
  }

  if (!isValidEmail(email)) {
    return new Response("邮箱格式不正确", { status: 400 });
  }

  if (password.length < 6) {
    return new Response("密码长度不能少于 6 位", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const okCode = await verifyAndUseEmailCode({
    db,
    email,
    code: emailCode,
    purpose: "register",
  });

  if (!okCode) {
    return new Response("邮箱验证码错误或已过期", { status: 400 });
  }

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

    if (msg.includes("UNIQUE constraint failed: users.email")) {
      return new Response("邮箱已被注册", { status: 400 });
    }

    console.error("注册用户失败:", e);
    return new Response("注册失败，请稍后再试", { status: 500 });
  }

  return Response.json({ ok: true });
}
