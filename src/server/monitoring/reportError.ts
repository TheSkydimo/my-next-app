/**
 * Minimal error reporting for Cloudflare Workers builds.
 *
 * IMPORTANT (security):
 * - Do NOT log request bodies, cookies, auth headers, verification codes, or tokens.
 * - Keep logs small to avoid Workers per-request log limits.
 */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  try {
    const err =
      error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");

    const safeContext = context
      ? JSON.stringify(context, (_k, v) => {
          // prevent huge blobs in logs
          if (typeof v === "string" && v.length > 500) return `${v.slice(0, 500)}…`;
          return v;
        })
      : undefined;

    // Keep this as a single line JSON-ish log for Cloudflare log drains / parsing.
    console.error(
      JSON.stringify({
        level: "error",
        message: "monitoring.error",
        err: {
          name: err.name,
          message: err.message,
          stack: err.stack?.slice(0, 2000),
        },
        context: safeContext ? JSON.parse(safeContext) : undefined,
      })
    );
  } catch {
    // Never fail app flow due to monitoring
  }
}


