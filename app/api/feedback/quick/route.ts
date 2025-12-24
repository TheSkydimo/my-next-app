import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureUserFeedbackTables } from "../../_utils/userFeedbackTable";
import { ensureUsersTable } from "../../_utils/usersTable";
import { formatFrom, getSmtpConfigWithPrefix, sendEmail } from "../../_utils/mailer";
import { getRuntimeEnvVar } from "../../_utils/runtimeEnv";
import { readJsonBody } from "../../_utils/body";
import { consumeRateLimit } from "../../_utils/rateLimit";
import { requireUserFromRequest } from "../../user/_utils/userSession";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

export const POST = withApiMonitoring(async function POST(request: Request) {
  try {
    const parsed = await readJsonBody<{ content: string }>(request);
    if (!parsed.ok) {
      return new Response("Invalid JSON", { status: 400 });
    }
    const { content } = parsed.value;

    if (!content || !content.trim()) {
      return new Response("反馈内容不能为空", { status: 400 });
    }

    const { env } = await getCloudflareContext();
    const db = env.my_user_db as D1Database;

    await ensureUsersTable(db);
    await ensureUserFeedbackTables(db);

    const authed = await requireUserFromRequest({ request, env, db });
    if (authed instanceof Response) return authed;
    const { user } = authed;

    // Abuse protection: per-user rate limit (avoid spamming support mailbox & DB).
    const limit = await consumeRateLimit({
      db,
      key: `feedback_quick:user:${user.id}`,
      windowSeconds: 60,
      limit: 5,
    });
    if (!limit.allowed) {
      return new Response("发送太频繁，请稍后再试", { status: 429 });
    }

    await db
      .prepare(
        `INSERT INTO user_feedback (user_id, type, content, status)
         VALUES (?, 'quick', ?, 'unread')`
      )
      .bind(user.id, content.trim())
      .run();

    // Email notification (best-effort): notify support mailbox (required via FEEDBACK_NOTIFY_TO).
    const notifyTo = (getRuntimeEnvVar(env, "FEEDBACK_NOTIFY_TO") || "").trim();

    const userEmailSent = false;
    let adminEmailSent = false;
    let emailError: string | undefined;

    if (!notifyTo) {
      emailError = "未配置反馈收件箱（FEEDBACK_NOTIFY_TO）";
    } else {
      const appName = getRuntimeEnvVar(env, "APP_NAME") || "应用";
      const cleanContent = content.trim();

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

      const emailSubject = user.email;

      const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
    .feedback-content { background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0; white-space: pre-wrap; }
    .meta { color: #64748b; font-size: 14px; }
    .user-email { background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin: 0;">📬 用户反馈</h2>
  </div>
  <div class="content">
    <p class="meta">📅 接收时间: ${escapeHtml(timestamp)}</p>
    <p class="meta">📧 用户邮箱: <span class="user-email">${escapeHtml(
      user.email
    )}</span></p>

    <h3>反馈内容:</h3>
    <div class="feedback-content">${escapeHtml(cleanContent)}</div>

    <p class="meta" style="margin-top: 20px;">
      此邮件由 ${escapeHtml(appName)} 自动发送，请勿直接回复此邮件。
      如需回复用户，请发送邮件至 ${escapeHtml(user.email)}。
    </p>
  </div>
</body>
</html>`;

      const emailText = `用户反馈

接收时间: ${timestamp}
用户邮箱: ${user.email}

反馈内容:
${cleanContent}

---
此邮件由 ${appName} 自动发送。`.trim();

      try {
        const feedbackCfg = getSmtpConfigWithPrefix(env, "FEEDBACK_SMTP_");
        const fallbackCfg = getSmtpConfigWithPrefix(env, "SMTP_");
        const smtpCfg = feedbackCfg || fallbackCfg;
        if (!smtpCfg) {
          throw new Error("邮件服务未配置（缺少 SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM）");
        }

        const prefix = feedbackCfg ? "FEEDBACK_SMTP_" : "SMTP_";

        await sendEmail(env, {
          from: formatFrom({ name: `${appName} 用户反馈`, email: smtpCfg.from }),
          to: notifyTo,
          replyTo: user.email,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
        }, prefix);
        adminEmailSent = true;
      } catch (e) {
        // Avoid leaking SMTP/provider details into logs.
        console.error("发送反馈通知邮件失败");
        emailError = "反馈已提交";
      }
    }

    return Response.json({
      ok: true,
      stored: true,
      userEmailSent,
      adminEmailSent,
      // Avoid returning internal config details; keep response minimal.
      emailError: emailError ? "反馈已提交" : undefined,
    });
  } catch (error) {
    console.error("提交反馈失败");
    return new Response("发送失败，请稍后再试", { status: 500 });
  }
}, { name: "POST /api/feedback/quick" });

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

