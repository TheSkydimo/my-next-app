import { getCloudflareContext } from "@opennextjs/cloudflare";
import { consumeRateLimit } from "../../_utils/rateLimit";
import { readJsonBody } from "../../_utils/body";
import { getRuntimeEnvVar } from "../../_utils/runtimeEnv";
import { formatFrom, getSmtpConfigWithPrefix, sendEmail } from "../../_utils/mailer";
import { isValidEmail, sha256 } from "../../_utils/auth";
import { maskIp } from "@/server/logging/redact";
import { assertSameOriginOrNoOrigin } from "../../_utils/requestOrigin";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

type AuthErrorStage =
  | "user-login:send-code"
  | "admin-login:send-code"
  | "register:send-code";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isAllowedStage(stage: string): stage is AuthErrorStage {
  return (
    stage === "user-login:send-code" ||
    stage === "admin-login:send-code" ||
    stage === "register:send-code"
  );
}

function safeTrimAndLimit(input: unknown, limit: number) {
  const s = String(input ?? "").trim();
  if (!s) return "";
  return s.length > limit ? `${s.slice(0, limit)}…` : s;
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain) return "***";
  if (local.length <= 2) return `${local[0] ?? "*"}*@${domain}`;
  const head = local.slice(0, 2);
  const tail = local.slice(-1);
  return `${head}***${tail}@${domain}`;
}

export const POST = withApiMonitoring(async function POST(request: Request) {
  const originGuard = assertSameOriginOrNoOrigin(request);
  if (originGuard) return originGuard;

  // NOTE: This endpoint is intentionally unauthenticated (for login-stage failures).
  // Abuse protection is enforced via rate limits (IP + email hash).
  try {
    const parsed = await readJsonBody<{
      email: string;
      stage: string;
      message?: string;
      requestId?: string;
      pagePath?: string;
    }>(request);
    if (!parsed.ok) {
      return new Response("Invalid JSON", { status: 400 });
    }

    const email = String(parsed.value.email ?? "").trim();
    const stage = String(parsed.value.stage ?? "").trim();
    const message = safeTrimAndLimit(parsed.value.message, 2000);
    const requestId = safeTrimAndLimit(parsed.value.requestId, 128);
    const pagePath = safeTrimAndLimit(parsed.value.pagePath, 256);

    if (!email) return new Response("邮箱不能为空", { status: 400 });
    if (email.length > 320) return new Response("邮箱格式不正确", { status: 400 });
    if (!isValidEmail(email)) return new Response("邮箱格式不正确", { status: 400 });
    if (!isAllowedStage(stage)) return new Response("stage 不合法", { status: 400 });

    const { env } = await getCloudflareContext();
    const db = env.my_user_db as D1Database;

    const ip = (request.headers.get("CF-Connecting-IP") || "").trim() || "unknown";
    const ipMasked = maskIp(ip) ?? "unknown";
    const emailHash = await sha256(email.toLowerCase());
    const emailMasked = maskEmail(email);

    const ipLimit = await consumeRateLimit({
      db,
      key: `feedback_auth_error:stage:${stage}:ip:${ip}`,
      windowSeconds: 60,
      limit: 5,
    });
    if (!ipLimit.allowed) {
      return new Response("发送太频繁，请稍后再试", { status: 429 });
    }

    const emailLimit = await consumeRateLimit({
      db,
      key: `feedback_auth_error:stage:${stage}:email:${emailHash}`,
      windowSeconds: 60,
      limit: 2,
    });
    if (!emailLimit.allowed) {
      return new Response("发送太频繁，请稍后再试", { status: 429 });
    }

    const notifyTo = (getRuntimeEnvVar(env, "FEEDBACK_NOTIFY_TO") || "").trim();
    if (!notifyTo) {
      // Do not leak config details; still return success to user.
      return Response.json({ ok: true, delivered: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const appName = getRuntimeEnvVar(env, "APP_NAME") || "应用";
    const now = new Date();
    const timestamp = now.toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const ua = safeTrimAndLimit(request.headers.get("user-agent"), 512);

    const subject = `[AuthError] ${stage} - ${emailMasked}`;
    const cleanMessage = message || "(no message)";

    const emailText = `登录阶段错误反馈

接收时间: ${timestamp}
阶段: ${stage}
用户邮箱: ${emailMasked}
邮箱Hash: ${emailHash.slice(0, 16)}
页面: ${pagePath || "(unknown)"}
IP: ${ipMasked}
User-Agent: ${ua || "(unknown)"}
X-Request-Id: ${requestId || "(none)"}

错误信息:
${cleanMessage}
`.trim();

    const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #111827; max-width: 680px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 16px 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 18px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .meta { color: #6b7280; font-size: 13px; }
    .box { background: white; padding: 12px 14px; border-radius: 8px; border: 1px solid #e5e7eb; white-space: pre-wrap; }
    .pill { display: inline-block; background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-weight: 700; font-size: 16px;">🚨 登录阶段错误反馈</div>
  </div>
  <div class="content">
    <div class="meta">📅 接收时间: ${escapeHtml(timestamp)}</div>
    <div class="meta">🧭 阶段: <span class="pill">${escapeHtml(stage)}</span></div>
    <div class="meta">📧 用户邮箱: ${escapeHtml(emailMasked)}</div>
    <div class="meta">🔎 邮箱Hash: ${escapeHtml(emailHash.slice(0, 16))}</div>
    <div class="meta">📄 页面: ${escapeHtml(pagePath || "(unknown)")}</div>
    <div class="meta">🌐 IP: ${escapeHtml(ipMasked)}</div>
    <div class="meta">🧩 User-Agent: ${escapeHtml(ua || "(unknown)")}</div>
    <div class="meta">🆔 X-Request-Id: ${escapeHtml(requestId || "(none)")}</div>
    <h3 style="margin: 14px 0 8px;">错误信息</h3>
    <div class="box">${escapeHtml(cleanMessage)}</div>
    <div class="meta" style="margin-top: 16px;">此邮件由 ${escapeHtml(appName)} 自动发送。</div>
  </div>
</body>
</html>`;

    try {
      const feedbackCfg = getSmtpConfigWithPrefix(env, "FEEDBACK_SMTP_");
      const fallbackCfg = getSmtpConfigWithPrefix(env, "SMTP_");
      const smtpCfg = feedbackCfg || fallbackCfg;
      if (!smtpCfg) {
        return Response.json({ ok: true, delivered: false }, { headers: { "Cache-Control": "no-store" } });
      }

      const prefix = feedbackCfg ? "FEEDBACK_SMTP_" : "SMTP_";
      await sendEmail(
        env,
        {
          from: formatFrom({ name: `${appName} AuthError`, email: smtpCfg.from }),
          to: notifyTo,
          replyTo: email,
          subject,
          text: emailText,
          html: emailHtml,
        },
        prefix
      );
    } catch {
      // Avoid leaking SMTP/provider details into logs.
      console.error("发送登录阶段错误反馈邮件失败");
      return Response.json({ ok: true, delivered: false }, { headers: { "Cache-Control": "no-store" } });
    }

    return Response.json({ ok: true, delivered: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("提交登录阶段错误反馈失败");
    return new Response("发送失败，请稍后再试", { status: 500 });
  }
}, { name: "POST /api/feedback/auth-error" });


