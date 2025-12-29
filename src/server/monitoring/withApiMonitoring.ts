import { getCloudflareContext } from "@opennextjs/cloudflare";
import { archiveRequestLogsToR2, type LogEntry } from "@/server/logging/r2Archive";
import { maskIp, safeUrlInfo } from "@/server/logging/redact";
import { reportError } from "@/server/monitoring/reportError";

function applySecurityAndCacheHeaders(request: Request, headers: Headers) {
  // Security headers (safe defaults for APIs and most pages).
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );

  // Cache policy:
  // - Default: API responses are private/sensitive; do not store.
  // - Allow specific handlers to explicitly override by setting Cache-Control themselves.
  const pathname = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      return "";
    }
  })();

  if (pathname.startsWith("/api/") && !headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-store");
  }
}

function emitStructuredLog(entry: LogEntry) {
  // Keep console logs JSON so Cloudflare Observability / log drains can parse it.
  // Never include request bodies, cookies, auth headers, or verification codes here.
  try {
    const line = JSON.stringify(entry);
    if (entry.level === "error") console.error(line);
    else if (entry.level === "warn") console.warn(line);
    else console.log(line);
  } catch {
    // ignore
  }
}

function getRequestId(request: Request): string {
  const fromHeader =
    request.headers.get("x-request-id") ||
    request.headers.get("cf-ray") ||
    request.headers.get("x-correlation-id");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  return crypto.randomUUID();
}

function getRequestIp(request: Request): string | null {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return null;
}

export function withApiMonitoring<TArgs extends readonly unknown[]>(
  handler: (...args: TArgs) => Promise<Response> | Response,
  options?: { name?: string }
) {
  return async function monitored(...args: TArgs): Promise<Response> {
    const request = args[0] as Request | undefined;
    if (!request) {
      throw new Error("withApiMonitoring: missing Request argument");
    }
    const startedAt = Date.now();
    const requestId = getRequestId(request);
    const { pathname, queryKeys } = safeUrlInfo(request.url);

    const entries: LogEntry[] = [
      {
        ts: new Date().toISOString(),
        level: "info",
        message: "request.start",
        event: "request.start",
        requestId,
        method: request.method,
        pathname,
        queryKeys,
        ip: maskIp(getRequestIp(request)),
        userAgent: request.headers.get("user-agent"),
        meta: options?.name ? { name: options.name } : undefined,
      },
    ];
    emitStructuredLog(entries[0]);

    // Best effort: Cloudflare context may not be available in some local workflows.
    let env: CloudflareEnv | undefined;
    let ctx: ExecutionContext | undefined;
    try {
      const cf = getCloudflareContext();
      env = cf.env;
      ctx = cf.ctx;
    } catch {
      // ignore
    }

    const envRecord = env as unknown as Record<string, unknown> | undefined;
    const logPrefixFromEnv =
      typeof envRecord?.LOG_ARCHIVE_R2_PREFIX === "string"
        ? (envRecord.LOG_ARCHIVE_R2_PREFIX as string)
        : undefined;
    const sentryDsn = typeof envRecord?.SENTRY_DSN === "string" ? (envRecord.SENTRY_DSN as string) : undefined;

    try {
      const res = await handler(...args);
      entries.push({
        ts: new Date().toISOString(),
        level: "info",
        message: "request.end",
        event: "request.end",
        requestId,
        method: request.method,
        pathname,
        queryKeys,
        status: res.status,
        durationMs: Date.now() - startedAt,
      });
      emitStructuredLog(entries[entries.length - 1]);

      // Report only 5xx to Sentry (4xx are expected / user errors)
      if (res.status >= 500) {
        reportError(
          new Error(`HTTP ${res.status}`),
          { requestId, pathname, method: request.method, status: res.status },
          { ctx, sentryDsn, runtime: "cloudflare-workers" }
        );
      }

      // Archive request logs to R2 (if bound)
      await archiveRequestLogsToR2({
        bucket: env?.APP_LOGS,
        ctx,
        requestId,
        entries,
        prefix: logPrefixFromEnv ?? process.env.LOG_ARCHIVE_R2_PREFIX,
      });

      // Surface request id for debugging (no sensitive content)
      const headers = new Headers(res.headers);
      headers.set("x-request-id", requestId);
      applySecurityAndCacheHeaders(request, headers);
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));

      const isInvalidJson =
        err.name === "SyntaxError" &&
        (err.message.toLowerCase().includes("json") ||
          err.message.toLowerCase().includes("unexpected token"));

      // Treat invalid JSON bodies as a client error (do not report to Sentry).
      if (isInvalidJson) {
        entries.push({
          ts: new Date().toISOString(),
          level: "warn",
          message: "request.invalid_json",
          event: "request.invalid_json",
          requestId,
          method: request.method,
          pathname,
          queryKeys,
          durationMs: Date.now() - startedAt,
        });
        emitStructuredLog(entries[entries.length - 1]);

        await archiveRequestLogsToR2({
          bucket: env?.APP_LOGS,
          ctx,
          requestId,
          entries,
          prefix: logPrefixFromEnv ?? process.env.LOG_ARCHIVE_R2_PREFIX,
        });

        const headers = new Headers({
          "Cache-Control": "no-store",
          "x-request-id": requestId,
        });
        applySecurityAndCacheHeaders(request, headers);
        return new Response("Invalid JSON", { status: 400, headers });
      }

      reportError(err, { requestId, pathname, method: request.method }, { ctx, sentryDsn, runtime: "cloudflare-workers" });

      entries.push({
        ts: new Date().toISOString(),
        level: "error",
        message: "request.error",
        event: "request.error",
        requestId,
        method: request.method,
        pathname,
        queryKeys,
        durationMs: Date.now() - startedAt,
        err: {
          name: err.name,
          message: err.message,
          // Security: avoid leaking internal paths/stack traces in production logs.
          // Use Sentry (reportError) for stack traces instead.
          stack:
            process.env.NODE_ENV === "development"
              ? err.stack?.slice(0, 2000)
              : undefined,
        },
      });
      emitStructuredLog(entries[entries.length - 1]);

      await archiveRequestLogsToR2({
        bucket: env?.APP_LOGS,
        ctx,
        requestId,
        entries,
        prefix: logPrefixFromEnv ?? process.env.LOG_ARCHIVE_R2_PREFIX,
      });

      return new Response("服务器内部错误", {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "x-request-id": requestId,
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "X-Frame-Options": "DENY",
          "Permissions-Policy":
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        },
      });
    }
  };
}


