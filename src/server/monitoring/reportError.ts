/**
 * Minimal error reporting for Cloudflare Workers builds.
 * - Always logs to console (structured JSON)
 * - Optionally reports to Sentry (HTTP envelope) when DSN is provided
 *
 * SECURITY: never include request bodies/cookies/auth headers/codes/tokens.
 */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
  options?: { ctx?: ExecutionContext; sentryDsn?: string; runtime?: string }
): void {
  const err =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  const safeContext = context
    ? JSON.stringify(context, (_k, v) => (typeof v === "string" && v.length > 500 ? `${v.slice(0, 500)}…` : v))
    : undefined;
  const includeStackInConsole = process.env.NODE_ENV === "development";
  try {
    console.error(
      JSON.stringify({
        level: "error",
        message: "monitoring.error",
        // Security: avoid leaking internal paths/stack traces in production console logs.
        // Use Sentry (when configured) for stack traces.
        err: {
          name: err.name,
          message: err.message,
          stack: includeStackInConsole ? err.stack?.slice(0, 2000) : undefined,
        },
        context: safeContext ? JSON.parse(safeContext) : undefined,
      })
    );
  } catch {}

  const dsn = (options?.sentryDsn || "").trim();
  if (!dsn) return;

  const task = async () => {
    const u = new URL(dsn);
    const key = u.username;
    const projectId = u.pathname.replaceAll("/", "");
    const endpoint = `${u.protocol}//${u.host}/api/${projectId}/envelope/?sentry_key=${key}&sentry_version=7&sentry_client=mini-worker/1`;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const event_id = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const event = {
      event_id,
      timestamp: new Date().toISOString(),
      platform: "javascript",
      level: "error",
      message: err.message || err.name || "Error",
      tags: {
        requestId: typeof context?.requestId === "string" ? context.requestId : undefined,
        pathname: typeof context?.pathname === "string" ? context.pathname : undefined,
        runtime: options?.runtime || "cloudflare-workers",
      },
      extra: { name: err.name, stack: err.stack?.slice(0, 4000), ...(safeContext ? { context: JSON.parse(safeContext) } : {}) },
    };
    const envelope = `${JSON.stringify({ event_id, sent_at: new Date().toISOString() })}\n${JSON.stringify({
      type: "event",
    })}\n${JSON.stringify(event)}\n`;
    await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-sentry-envelope" }, body: envelope });
  };

  try {
    if (options?.ctx?.waitUntil) options.ctx.waitUntil(task());
    else void task();
  } catch {}
}


