import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureUserFeedbackTables } from "../../_utils/userFeedbackTable";
import { ensureUsersTable } from "../../_utils/usersTable";
import {
  createSmtpTransport,
  getSmtpConfig,
  getSmtpConfigWithPrefix,
} from "../../_utils/mailer";
import { getRuntimeEnvVar } from "../../_utils/runtimeEnv";

export async function POST(request: Request) {
  try {
    const { content, email } = (await request.json()) as {
      content: string;
      email?: string;
    };

    if (!content || !content.trim()) {
      return new Response("反馈内容不能为空", { status: 400 });
    }

    if (!email) {
      return new Response("请先登录后再提交反馈", { status: 401 });
    }

    const { env } = await getCloudflareContext();
    const db = env.my_user_db as D1Database;

    await ensureUsersTable(db);
    await ensureUserFeedbackTables(db);

    const { results } = await db
      .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
      .bind(email)
      .all<{ id: number }>();
    const userId = results?.[0]?.id;
    if (!userId) {
      return new Response("请先登录后再提交反馈", { status: 401 });
    }

    await db
      .prepare(
        `INSERT INTO user_feedback (user_id, type, content, status)
         VALUES (?, 'quick', ?, 'unread')`
      )
      .bind(userId, content.trim())
      .run();

    // Email notification (best-effort): notify support mailbox (required via FEEDBACK_NOTIFY_TO).
    // Optional: use a dedicated feedback SMTP account via FEEDBACK_SMTP_* (falls back to default SMTP_*).
    const smtp =
      getSmtpConfigWithPrefix(env, "FEEDBACK_SMTP_") ?? getSmtpConfig(env);
    const notifyTo = (getRuntimeEnvVar(env, "FEEDBACK_NOTIFY_TO") || "").trim();

    const userEmailSent = false;
    let adminEmailSent = false;
    let emailError: string | undefined;

    if (!notifyTo) {
      emailError = "未配置反馈收件箱（FEEDBACK_NOTIFY_TO）";
    } else if (!smtp) {
      emailError = "邮件服务未配置";
    } else {
      const transporter = createSmtpTransport(smtp);
      const appName = smtp.appName || "应用";
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

      const emailSubject = email;

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
      email
    )}</span></p>

    <h3>反馈内容:</h3>
    <div class="feedback-content">${escapeHtml(cleanContent)}</div>

    <p class="meta" style="margin-top: 20px;">
      此邮件由 ${escapeHtml(appName)} 自动发送，请勿直接回复此邮件。
      如需回复用户，请发送邮件至 ${escapeHtml(email)}。
    </p>
  </div>
</body>
</html>`;

      const emailText = `用户反馈

接收时间: ${timestamp}
用户邮箱: ${email}

反馈内容:
${cleanContent}

---
此邮件由 ${appName} 自动发送。`.trim();

      try {
        await transporter.sendMail({
          from: `"${appName} 用户反馈" <${smtp.from}>`,
          to: notifyTo,
          replyTo: email,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
        });
        adminEmailSent = true;
      } catch (e) {
        console.error("发送反馈通知邮件失败:", e);
        emailError = "反馈已提交，但通知邮件发送失败";
      }
    }

    return Response.json({
      ok: true,
      stored: true,
      userEmailSent,
      adminEmailSent,
      emailError,
    });
  } catch (error) {
    console.error("提交反馈失败:", error);
    return new Response("发送失败，请稍后再试", { status: 500 });
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

