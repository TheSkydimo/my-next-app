import { getCloudflareContext } from "@opennextjs/cloudflare";
import nodemailer from "nodemailer";
import { isValidEmail } from "../../_utils/auth";
import type { EmailCodePurpose } from "../../_utils/emailCode";
import { ensureEmailCodeTable } from "../../_utils/emailCode";
import { getTurnstileSecretFromEnv, verifyTurnstileToken } from "../../_utils/turnstile";
import {
  getRuntimeEnvVar,
  isDevBypassTurnstileEnabled,
  shouldReturnEmailCodeInResponse,
} from "../../_utils/runtimeEnv";

function generateCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

export async function POST(request: Request) {
  const { email, purpose, turnstileToken } = (await request.json()) as {
    email: string;
    purpose: EmailCodePurpose;
    turnstileToken?: string;
  };

  if (!email) {
    return new Response("邮箱不能为空", { status: 400 });
  }

  if (!isValidEmail(email)) {
    return new Response("邮箱格式不正确", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const bypassTurnstile = isDevBypassTurnstileEnabled(env);
  const returnCodeInResponse = shouldReturnEmailCodeInResponse(env);

  // 发送验证码：部分用途强制 Turnstile（防刷）
  if (purpose === "user-login" || purpose === "user-forgot" || purpose === "admin-forgot") {
    if (!bypassTurnstile) {
      const secret = getTurnstileSecretFromEnv(env);
      if (!secret) {
        return new Response("Turnstile 未配置（缺少 TURNSTILE_SECRET_KEY）", {
          status: 500,
        });
      }
      if (!turnstileToken) {
        return new Response("请完成人机验证", { status: 400 });
      }
      const remoteip = request.headers.get("CF-Connecting-IP");
      const okTurnstile = await verifyTurnstileToken({
        secret,
        token: turnstileToken,
        remoteip,
      });
      if (!okTurnstile) {
        return new Response("人机验证失败，请重试", { status: 400 });
      }
    }
  }

  // 创建验证码表（如果不存在）
  await ensureEmailCodeTable(db);

  // 如果是管理员找回密码，先确认该邮箱为管理员账号
  if (purpose === "admin-forgot") {
    const { results } = await db
      .prepare("SELECT id FROM users WHERE email = ? AND is_admin = 1")
      .bind(email)
      .all();

    if (!results || results.length === 0) {
      return new Response("该管理员邮箱不存在或不是管理员账号", { status: 404 });
    }
  }

  const code = generateCode(6);

  // 简单的限制：同一邮箱 1 分钟内只允许发送一次
  const recent = await db
    .prepare(
      `SELECT id FROM email_verification_codes
       WHERE email = ? AND purpose = ? AND created_at > datetime('now', '-60 seconds')`
    )
    .bind(email, purpose)
    .all();

  if (recent.results && recent.results.length > 0) {
    return new Response("验证码发送太频繁，请稍后再试", { status: 429 });
  }

  await db
    .prepare(
      `INSERT INTO email_verification_codes (email, code, purpose, expires_at)
       VALUES (?, ?, ?, datetime('now', '+10 minutes'))`
    )
    .bind(email, code, purpose)
    .run();

  // 本地开发：允许直接返回验证码，便于手动测试（仍写入数据库）
  if (returnCodeInResponse) {
    console.log(
      `[DEV] email code generated: email=${email}, purpose=${purpose}, code=${code}`
    );
    return Response.json({ ok: true, devCode: code });
  }

  const APP_NAME = getRuntimeEnvVar(env, "APP_NAME");
  const SMTP_HOST = getRuntimeEnvVar(env, "SMTP_HOST");
  const SMTP_PORT = getRuntimeEnvVar(env, "SMTP_PORT");
  const SMTP_USER = getRuntimeEnvVar(env, "SMTP_USER");
  const SMTP_PASS = getRuntimeEnvVar(env, "SMTP_PASS");
  const SMTP_ENCRYPTION = getRuntimeEnvVar(env, "SMTP_ENCRYPTION");
  const SMTP_FROM = getRuntimeEnvVar(env, "SMTP_FROM");

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.error("SMTP 配置缺失");
    return new Response("邮件服务未配置", { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_ENCRYPTION === "ssl" || Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const appName = APP_NAME || "应用";

  try {
    await transporter.sendMail({
      from: `${appName} <${SMTP_FROM}>`,
      to: email,
      subject: `[${appName}] 邮箱验证码`,
      text: `您的验证码是：${code}，10 分钟内有效。若非本人操作，请忽略此邮件。`,
      html: `<p>您好，</p>
             <p>您的 <strong>${appName}</strong> 邮箱验证码为：</p>
             <p style="font-size: 20px; font-weight: bold;">${code}</p>
             <p>该验证码在 10 分钟内有效。若非本人操作，请忽略此邮件。</p>`,
    });
  } catch (e) {
    console.error("发送验证码邮件失败:", e);
    return new Response("发送邮件失败，请稍后再试", { status: 500 });
  }

  return Response.json({ ok: true });
}


