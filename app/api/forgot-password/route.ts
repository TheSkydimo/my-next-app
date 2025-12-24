import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isValidEmail, sha256 } from "../_utils/auth";
import { verifyAndUseEmailCode } from "../_utils/emailCode";
import { readJsonBody } from "../_utils/body";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

export const POST = withApiMonitoring(async function POST(request: Request) {
  const parsed = await readJsonBody<{
    email: string;
    password: string;
    emailCode?: string;
  }>(request);
  if (!parsed.ok) {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { email, password, emailCode } = parsed.value;

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

  if (password.length > 256) {
    return new Response("密码长度过长", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const okCode = await verifyAndUseEmailCode({
    db,
    email,
    code: emailCode,
    purpose: "user-forgot",
  });

  if (!okCode) {
    return new Response("邮箱验证码错误或已过期", { status: 400 });
  }

  const { results } = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .all();

  if (!results || results.length === 0) {
    return new Response("该邮箱未注册", { status: 404 });
  }

  const password_hash = await sha256(password);

  await db
    .prepare("UPDATE users SET password_hash = ? WHERE email = ?")
    .bind(password_hash, email)
    .run();

  return Response.json({ ok: true });
}, { name: "POST /api/forgot-password" });

