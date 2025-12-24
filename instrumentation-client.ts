import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_NEXTJS_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0, // enable later if needed
  });
}

// This export instruments router navigations (only relevant if you enable tracing).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;


