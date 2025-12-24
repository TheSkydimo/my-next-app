import * as Sentry from "@sentry/nextjs";

export function reportError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  try {
    Sentry.captureException(error, {
      extra: context,
    });
  } catch {
    // Never fail app flow due to monitoring
  }
}


