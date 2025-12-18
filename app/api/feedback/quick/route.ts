import nodemailer from "nodemailer";

// 支持邮件服务器的配置 - 直接使用用户提供的配置
const FEEDBACK_EMAIL_CONFIG = {
  email_address: "support@skydimo.com",
  email_password: "4MpWEnZMf76AFfeh",
  smtp_server: "smtp.mxhichina.com",
  smtp_port: 587,
  smtp_ssl: false,
  smtp_tls: true,
};

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

    // 创建 SMTP 传输器
    const transporter = nodemailer.createTransport({
      host: FEEDBACK_EMAIL_CONFIG.smtp_server,
      port: FEEDBACK_EMAIL_CONFIG.smtp_port,
      secure: FEEDBACK_EMAIL_CONFIG.smtp_ssl, // false for TLS
      auth: {
        user: FEEDBACK_EMAIL_CONFIG.email_address,
        pass: FEEDBACK_EMAIL_CONFIG.email_password,
      },
      // 如果启用 TLS，需要 secure 为 false
      ...(FEEDBACK_EMAIL_CONFIG.smtp_tls && !FEEDBACK_EMAIL_CONFIG.smtp_ssl
        ? { requireTLS: true }
        : {}),
    });

    // 获取用户时区和时间
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

    // 构建邮件主题 - 只显示用户邮箱
    const emailSubject = email;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #3b82f6, #6366f1);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .content {
            background: #f8fafc;
            padding: 20px;
            border: 1px solid #e2e8f0;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .feedback-content {
            background: white;
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            margin: 16px 0;
            white-space: pre-wrap;
          }
          .meta {
            color: #64748b;
            font-size: 14px;
          }
          .user-email {
            background: #dbeafe;
            color: #1e40af;
            padding: 4px 8px;
            border-radius: 4px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">📬 用户反馈</h2>
        </div>
        <div class="content">
          <p class="meta">📅 接收时间: ${timestamp}</p>
          ${email ? `<p class="meta">📧 用户邮箱: <span class="user-email">${email}</span></p>` : '<p class="meta">📧 用户未留下邮箱</p>'}
          
          <h3>反馈内容:</h3>
          <div class="feedback-content">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          
          <p class="meta" style="margin-top: 20px;">
            此邮件由 Skydimo 用户中心自动发送，请勿直接回复此邮件。
            ${email ? `如需回复用户，请发送邮件至 ${email}` : ""}
          </p>
        </div>
      </body>
      </html>
    `;

    const emailText = `
Skydimo 用户反馈

接收时间: ${timestamp}
用户邮箱: ${email || "未提供"}

反馈内容:
${content}

---
此邮件由 Skydimo 用户中心自动发送。
${email ? `如需回复用户，请发送邮件至 ${email}` : ""}
    `.trim();

    // 发送邮件
    await transporter.sendMail({
      from: `"Skydimo 用户反馈" <${FEEDBACK_EMAIL_CONFIG.email_address}>`,
      to: FEEDBACK_EMAIL_CONFIG.email_address,
      replyTo: email || undefined,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("发送反馈邮件失败:", error);
    return new Response(
      error instanceof Error ? error.message : "发送反馈邮件失败",
      { status: 500 }
    );
  }
}

