import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isValidEmail, sha256 } from "../../_utils/auth";
import type { EmailCodePurpose } from "../../_utils/emailCode";
import { ensureEmailCodeTable } from "../../_utils/emailCode";
import { readJsonBody } from "../../_utils/body";
import {
  normalizeAppLanguage,
  type AppLanguage,
} from "../../_utils/appLanguage";
import { getTurnstileSecretFromEnv, verifyTurnstileToken } from "../../_utils/turnstile";
import { hasValidTurnstilePassCookie } from "../../_utils/turnstilePass";
import { ensureUsersIsAdminColumn } from "../../_utils/usersTable";
import { getEmailServiceStatus, sendEmail } from "../../_utils/mailer";
import {
  isDevBypassTurnstileEnabled,
  shouldReturnEmailCodeInResponse,
} from "../../_utils/runtimeEnv";
import { consumeRateLimit } from "../../_utils/rateLimit";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

function generateCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

function resolveRequestLanguage(options: {
  request: Request;
  bodyLanguage?: unknown;
}): AppLanguage {
  const { request, bodyLanguage } = options;
  // 1) 客户端显式传递（优先级最高）
  const normalized = normalizeAppLanguage(bodyLanguage);
  if (bodyLanguage === "en-US" || bodyLanguage === "zh-CN") {
    return normalized;
  }

  // 2) 回退：Accept-Language（仅做简单判断，避免引入复杂解析）
  const accept = String(request.headers.get("accept-language") ?? "")
    .trim()
    .toLowerCase();
  if (accept.startsWith("en") || accept.includes(",en") || accept.includes("-en")) {
    return "en-US";
  }

  return "zh-CN";
}

function getApiMessage(lang: AppLanguage) {
  const zh = {
    emailRequired: "邮箱不能为空",
    emailInvalid: "邮箱格式不正确",
    turnstileMissing: "请完成人机验证",
    turnstileFailed: "人机验证失败，请重试",
    turnstileNotConfigured: "Turnstile 未配置（缺少 TURNSTILE_SECRET_KEY）",
    codeTooFrequent: "验证码发送太频繁，请稍后再试",
    adminEmailNotFound: "该管理员邮箱不存在或不是管理员账号",
    smtpMissing: "邮件服务未配置",
    sendMailFailed: "发送邮件失败，请稍后再试",
  };
  const en = {
    emailRequired: "Email is required.",
    emailInvalid: "Invalid email format.",
    turnstileMissing: "Please complete the human verification.",
    turnstileFailed: "Human verification failed. Please try again.",
    turnstileNotConfigured: "Turnstile is not configured (missing TURNSTILE_SECRET_KEY).",
    codeTooFrequent: "Too many requests. Please try again later.",
    adminEmailNotFound: "Admin email not found or not an admin account.",
    smtpMissing: "Email service is not configured.",
    sendMailFailed: "Failed to send email. Please try again later.",
  };

  return lang === "en-US" ? en : zh;
}

function buildEmailTemplate(options: {
  lang: AppLanguage;
  purpose: EmailCodePurpose;
  code: string;
}) {
  const { lang, purpose, code } = options;

  // 注意：按需求，验证码邮件中暂时不要出现 APP_NAME/应用名（避免“订阅管理”出现在主题/正文/发件人显示名）
  const zhTitle: Record<EmailCodePurpose, string> = {
    register: "注册验证码",
    "user-login": "登录验证码",
    "admin-login": "管理员登录验证码",
    "change-email": "更换邮箱验证码",
  };

  const enTitle: Record<EmailCodePurpose, string> = {
    register: "Sign-up verification code",
    "user-login": "Sign-in verification code",
    "admin-login": "Admin sign-in verification code",
    "change-email": "Email change verification code",
  };

  const subject = lang === "en-US" ? enTitle[purpose] : zhTitle[purpose];

  // 特别按用户提供的固定文案：登录（user-login）中英文内容需要严格一致
  if (purpose === "user-login") {
    if (lang === "en-US") {
      const text =
        "Hello,\n" +
        `Your sign-in verification code is: ${code}\n` +
        "This code expires in 10 minutes. If you did not request this, please disregard this email.";
      const html = `<p>Hello,</p>
<p>Your sign-in verification code is:</p>
<p style="font-size: 20px; font-weight: bold; letter-spacing: 1px;">${code}</p>
<p>This code expires in 10 minutes. If you did not request this, please disregard this email.</p>`;
      return { subject, text, html };
    }

    const text =
      "您好：\n" +
      `您的登录验证码为：${code}\n` +
      "该验证码将于10分钟内失效。如非您本人发起，请忽略此邮件。";
    const html = `<p>您好：</p>
<p>您的登录验证码为：</p>
<p style="font-size: 20px; font-weight: bold; letter-spacing: 1px;">${code}</p>
<p>该验证码将于10分钟内失效。如非您本人发起，请忽略此邮件。</p>`;
    return { subject, text, html };
  }

  // 其他用途：保持“无应用名”的简洁模板
  if (lang === "en-US") {
    const text =
      "Hello,\n" +
      `Your verification code is: ${code}\n` +
      "This code expires in 10 minutes. If you did not request this, please disregard this email.";
    const html = `<p>Hello,</p>
<p>Your verification code is:</p>
<p style="font-size: 20px; font-weight: bold; letter-spacing: 1px;">${code}</p>
<p>This code expires in 10 minutes. If you did not request this, please disregard this email.</p>`;
    return { subject, text, html };
  }

  const text =
    "您好：\n" +
    `您的验证码为：${code}\n` +
    "该验证码将于10分钟内失效。如非您本人发起，请忽略此邮件。";
  const html = `<p>您好：</p>
<p>您的验证码为：</p>
<p style="font-size: 20px; font-weight: bold; letter-spacing: 1px;">${code}</p>
<p>该验证码将于10分钟内失效。如非您本人发起，请忽略此邮件。</p>`;
  return { subject, text, html };
}

export const POST = withApiMonitoring(async function POST(request: Request) {
  const parsed = await readJsonBody<{
    email: string;
    purpose: EmailCodePurpose;
    turnstileToken?: string;
    language?: AppLanguage;
  }>(request);
  if (!parsed.ok) {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { email, purpose, turnstileToken, language } = parsed.value;

  const lang = resolveRequestLanguage({ request, bodyLanguage: language });
  const msg = getApiMessage(lang);

  if (!email) {
    return new Response(msg.emailRequired, { status: 400 });
  }

  // Basic length hardening (RFC-ish upper bound is 254, but allow a bit extra).
  if (email.length > 320) {
    return new Response(msg.emailInvalid, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return new Response(msg.emailInvalid, { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const bypassTurnstile = isDevBypassTurnstileEnabled(env);
  const returnCodeInResponse = shouldReturnEmailCodeInResponse(env);

  // 发送验证码：部分用途强制 Turnstile（防刷）
  if (
    purpose === "user-login" ||
    purpose === "admin-login"
  ) {
    if (!bypassTurnstile) {
      // Allow passing a short-lived server-verified cookie so the user can retry
      // without being forced back to the Turnstile page.
      const hasPass = await hasValidTurnstilePassCookie({ request, env });
      if (hasPass) {
        // ok
      } else {
      const secret = getTurnstileSecretFromEnv(env);
      if (!secret) {
        return new Response(msg.turnstileNotConfigured, { status: 500 });
      }
      if (!turnstileToken) {
        return new Response(msg.turnstileMissing, { status: 400 });
      }
      const remoteip = request.headers.get("CF-Connecting-IP");
      const okTurnstile = await verifyTurnstileToken({
        secret,
        token: turnstileToken,
        remoteip,
      });
      if (!okTurnstile) {
        return new Response(msg.turnstileFailed, { status: 400 });
      }
      }
    }
  }

  // 创建验证码表（如果不存在）
  await ensureEmailCodeTable(db);

  // Rate limit (abuse protection):
  // - Per IP: limit the number of requests regardless of target email.
  // - Per email hash: stricter limit for a single recipient.
  const ip = (request.headers.get("CF-Connecting-IP") || "").trim() || "unknown";
  const emailHash = await sha256(email.toLowerCase());
  const ipKey = `email_send:${purpose}:ip:${ip}`;
  const emailKey = `email_send:${purpose}:email:${emailHash}`;

  // Local dev ergonomics: if we return the code in the API response, disable rate limits so
  // manual testing doesn't get blocked by 429s. Production behavior is unchanged because
  // `shouldReturnEmailCodeInResponse` is hard-disabled outside dev runtime.
  if (!returnCodeInResponse) {
    const ipLimit = await consumeRateLimit({
      db,
      key: ipKey,
      windowSeconds: 60,
      limit: 10,
    });
    if (!ipLimit.allowed) {
      return new Response(msg.codeTooFrequent, { status: 429 });
    }

    const emailLimit = await consumeRateLimit({
      db,
      key: emailKey,
      windowSeconds: 60,
      limit: 1,
    });
    if (!emailLimit.allowed) {
      return new Response(msg.codeTooFrequent, { status: 429 });
    }
  }

  // 如果是管理员相关用途，先确认该邮箱为管理员账号
  if (purpose === "admin-login") {
    await ensureUsersIsAdminColumn(db);
    const { results } = await db
      .prepare("SELECT id FROM users WHERE email = ? AND is_admin = 1")
      .bind(email)
      .all();

    if (!results || results.length === 0) {
      return new Response(msg.adminEmailNotFound, { status: 404 });
    }
  }

  const code = generateCode(6);
  const challengeId = crypto.randomUUID();

  // 生成新验证码时：立即作废同邮箱+同用途下所有未使用旧验证码（与插入同一事务，避免并发竞态）
  await db.batch([
    db
      .prepare(
        `UPDATE email_verification_codes
         SET invalidated_at = datetime('now')
         WHERE email = ? AND purpose = ?
           AND used_at IS NULL
           AND (invalidated_at IS NULL)`
      )
      .bind(email, purpose),
    db
      .prepare(
        `INSERT INTO email_verification_codes (email, challenge_id, code, purpose, expires_at)
         VALUES (?, ?, ?, ?, datetime('now', '+10 minutes'))`
      )
      .bind(email, challengeId, code, purpose),
  ]);

  // 本地开发：允许直接返回验证码，便于手动测试（仍写入数据库）
  if (returnCodeInResponse) {
    return Response.json({ ok: true, challengeId, devCode: code }, { headers: { "Cache-Control": "no-store" } });
  }

  // Email service config must exist in production.
  const emailStatus = getEmailServiceStatus(env, "SMTP_");
  if (!emailStatus.ok) {
    return new Response(msg.smtpMissing, { status: 500 });
  }

  try {
    const tpl = buildEmailTemplate({ lang, purpose, code });
    await sendEmail(env, { to: email, subject: tpl.subject, text: tpl.text, html: tpl.html });
  } catch {
    // Avoid leaking SMTP/provider details into logs (may include recipient / internal ids).
    console.error("发送验证码邮件失败");
    return new Response(msg.sendMailFailed, { status: 500 });
  }

  return Response.json({ ok: true, challengeId }, { headers: { "Cache-Control": "no-store" } });
}, { name: "POST /api/email/send-code" });


