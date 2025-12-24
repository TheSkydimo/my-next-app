import { getRuntimeEnvVar } from "./runtimeEnv";

export type EmailSendOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  /**
   * Resend accepts either:
   * - "email@example.com"
   * - "Display Name <email@example.com>"
   */
  from?: string;
  replyTo?: string;
};

type ResendConfig = {
  provider: "resend";
  apiKey: string;
  defaultFrom: string;
};

function getResendConfig(env: unknown): ResendConfig | null {
  const apiKey = (getRuntimeEnvVar(env, "RESEND_API_KEY") || "").trim();
  if (!apiKey) return null;

  // Prefer explicit EMAIL_FROM, otherwise reuse existing SMTP_FROM (historical).
  const defaultFrom =
    (getRuntimeEnvVar(env, "EMAIL_FROM") || getRuntimeEnvVar(env, "SMTP_FROM") || "").trim();
  if (!defaultFrom) return null;

  return { provider: "resend", apiKey, defaultFrom };
}

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list
    .flatMap((x) => String(x).split(","))
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Workers-safe email sending (HTTP) — no Node SMTP libraries.
 *
 * Provider: Resend (https://resend.com)
 * - Configure `RESEND_API_KEY` (secret) and `EMAIL_FROM` (text var).
 */
export async function sendEmail(env: unknown, options: EmailSendOptions): Promise<void> {
  const cfg = getResendConfig(env);
  if (!cfg) {
    throw new Error("Email service is not configured (missing RESEND_API_KEY/EMAIL_FROM).");
  }

  const to = normalizeRecipients(options.to);
  if (to.length === 0) {
    throw new Error("Email recipients missing.");
  }

  const from = (options.from || cfg.defaultFrom).trim();
  if (!from) {
    throw new Error("Email sender missing.");
  }

  const payload: Record<string, unknown> = {
    from,
    to,
    subject: options.subject,
  };
  if (options.text) payload.text = options.text;
  if (options.html) payload.html = options.html;
  if (options.replyTo) payload.reply_to = options.replyTo;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    const snippet = raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
    throw new Error(`Resend API error (${res.status}): ${snippet || "unknown error"}`);
  }
}

export function formatFrom(options: { name?: string; email: string }): string {
  const name = (options.name || "").trim();
  const email = options.email.trim();
  if (!name) return email;
  return `"${name.replaceAll('"', "")}" <${email}>`;
}


