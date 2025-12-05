import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isValidEmail, sha256 } from "../../_utils/auth";
import { verifyAndUseEmailCode } from "../../_utils/emailCode";

// 管理员忘记密码：只允许重置 is_admin = 1 的账号
export async function POST(request: Request) {
  const { email, password, emailCode } = (await request.json()) as {
    email: string;
    password: string;
    emailCode?: string;
  };

  if (!email || !password) {
    return new Response("邮箱和新密码不能为空", { status: 400 });
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
    purpose: "admin-forgot",
  });

  if (!okCode) {
    return new Response("邮箱验证码错误或已过期", { status: 400 });
  }

  const { results } = await db
    .prepare("SELECT id FROM users WHERE email = ? AND is_admin = 1")
    .bind(email)
    .all();

  if (!results || results.length === 0) {
    return new Response("该管理员邮箱不存在", { status: 404 });
  }

  const password_hash = await sha256(password);

  await db
    .prepare(
      "UPDATE users SET password_hash = ? WHERE email = ? AND is_admin = 1"
    )
    .bind(password_hash, email)
    .run();

  return Response.json({ ok: true });
}

