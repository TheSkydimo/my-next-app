import { getRuntimeEnvVar } from "./runtimeEnv";

export type EmailSendOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  /**
   * Accepts:
   * - "email@example.com"
   * - "Display Name <email@example.com>"
   */
  from?: string;
  replyTo?: string;
};

export type SmtpConfig = {
  appName: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  encryption?: string;
};

type ResendConfig = {
  apiKey: string;
  from: string;
};

export function getSmtpConfig(env: unknown): SmtpConfig | null {
  return getSmtpConfigWithPrefix(env, "SMTP_");
}

/**
 * Read SMTP config from env with an optional prefix.
 * - Default SMTP: SMTP_HOST/SMTP_PORT/...
 * - Feedback override: FEEDBACK_SMTP_HOST/FEEDBACK_SMTP_PORT/...
 */
export function getSmtpConfigWithPrefix(
  env: unknown,
  prefix: "SMTP_" | "FEEDBACK_SMTP_"
): SmtpConfig | null {
  const APP_NAME = getRuntimeEnvVar(env, "APP_NAME") || "应用";
  const SMTP_HOST = getRuntimeEnvVar(env, `${prefix}HOST`);
  const SMTP_PORT = getRuntimeEnvVar(env, `${prefix}PORT`);
  const SMTP_USER = getRuntimeEnvVar(env, `${prefix}USER`);
  const SMTP_PASS = getRuntimeEnvVar(env, `${prefix}PASS`);
  const SMTP_ENCRYPTION = getRuntimeEnvVar(env, `${prefix}ENCRYPTION`);
  const SMTP_FROM = getRuntimeEnvVar(env, `${prefix}FROM`);

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return null;
  }

  return {
    appName: APP_NAME,
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    user: SMTP_USER,
    pass: SMTP_PASS,
    from: SMTP_FROM,
    encryption: SMTP_ENCRYPTION,
  };
}

function getResendConfig(env: unknown): ResendConfig | null {
  const apiKey = String(getRuntimeEnvVar(env, "RESEND_API_KEY") ?? "").trim();
  if (!apiKey) return null;

  // Prefer RESEND_FROM; fall back to SMTP_FROM to keep config minimal.
  const from = String(
    getRuntimeEnvVar(env, "RESEND_FROM") ?? getRuntimeEnvVar(env, "SMTP_FROM") ?? ""
  ).trim();
  if (!from) return null;

  return { apiKey, from };
}

export async function createSmtpTransport(config: SmtpConfig) {
  // Lazy-load nodemailer so route modules can still load in runtimes that don't support SMTP sockets.
  const nodemailer = (await import("nodemailer")).default;
  const secure = config.encryption === "ssl" || config.port === 465;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list
    .flatMap((x) => String(x).split(","))
    .map((x) => x.trim())
    .filter(Boolean);
}

export function getEmailServiceStatus(env: unknown, prefix: "SMTP_" | "FEEDBACK_SMTP_" = "SMTP_"): {
  ok: boolean;
  provider?: "resend" | "smtp";
  reason?: "missing";
} {
  const resend = getResendConfig(env);
  if (resend) return { ok: true, provider: "resend" };

  const cfg = getSmtpConfigWithPrefix(env, prefix);
  if (!cfg) return { ok: false, reason: "missing" };

  return { ok: true, provider: "smtp" };
}

async function sendWithResend(cfg: ResendConfig, options: EmailSendOptions) {
  const to = normalizeRecipients(options.to);
  if (to.length === 0) throw new Error("Email recipients missing.");

  const from = (options.from || cfg.from).trim();
  if (!from) throw new Error("Email sender missing.");

  const payload = {
    from,
    to,
    subject: options.subject,
    ...(options.html ? { html: options.html } : {}),
    ...(options.text ? { text: options.text } : {}),
    ...(options.replyTo ? { reply_to: options.replyTo } : {}),
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // Avoid leaking provider details; callers should map to a friendly error.
    throw new Error("Resend send failed.");
  }
}

export async function sendEmail(
  env: unknown,
  options: EmailSendOptions,
  prefix: "SMTP_" | "FEEDBACK_SMTP_" = "SMTP_"
): Promise<void> {
  const resendCfg = getResendConfig(env);
  if (resendCfg) {
    await sendWithResend(resendCfg, options);
    return;
  }

  const cfg = getSmtpConfigWithPrefix(env, prefix);
  if (!cfg) {
    throw new Error(
      "Email service is not configured (missing SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM)."
    );
  }

  const to = normalizeRecipients(options.to);
  if (to.length === 0) {
    throw new Error("Email recipients missing.");
  }

  const from = (options.from || cfg.from).trim();
  if (!from) {
    throw new Error("Email sender missing.");
  }

  const transport = await createSmtpTransport(cfg);
  try {
    await transport.sendMail({
    from,
    to,
    subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo,
    });
  } finally {
    // Best-effort; not all transports expose close().
    (transport as unknown as { close?: () => void }).close?.();
  }
}

export function formatFrom(options: { name?: string; email: string }): string {
  const name = (options.name || "").trim();
  const email = options.email.trim();
  if (!name) return email;
  return `"${name.replaceAll('"', "")}" <${email}>`;
}
