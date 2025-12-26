export function getRuntimeEnvVar(env: unknown, key: string): string | undefined {
  const envRecord = env as unknown as Record<string, string | undefined>;
  return envRecord?.[key] ?? process.env[key];
}

function isDevRuntime(env: unknown): boolean {
  /**
   * Security: DEV_* helpers must NEVER work in production, even if someone
   * accidentally sets the env vars on prod.
   *
   * We only allow these helpers when we have a strong signal that we're in
   * local dev:
   * - Next.js dev server: NODE_ENV === "development"
   * - Wrangler/OpenNext local dev: NEXTJS_ENV === "development"
   */
  if (process.env.NODE_ENV === "development") return true;
  return getRuntimeEnvVar(env, "NEXTJS_ENV") === "development";
}

export function isDevBypassTurnstileEnabled(env: unknown): boolean {
  // Safety: never bypass in production.
  if (!isDevRuntime(env)) return false;
  return getRuntimeEnvVar(env, "DEV_BYPASS_TURNSTILE") === "1";
}

export function shouldReturnEmailCodeInResponse(env: unknown): boolean {
  // Safety: never return codes in production responses.
  if (!isDevRuntime(env)) return false;
  return getRuntimeEnvVar(env, "DEV_RETURN_EMAIL_CODE") === "1";
}


