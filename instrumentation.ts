import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Cloudflare Workers (OpenNext) uses a Workers runtime. Next.js will set NEXT_RUNTIME accordingly.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture errors from Server Components, middleware, and proxies
export const onRequestError = Sentry.captureRequestError;


