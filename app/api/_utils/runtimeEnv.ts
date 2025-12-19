export function getRuntimeEnvVar(env: unknown, key: string): string | undefined {
  const envRecord = env as unknown as Record<string, string | undefined>;
  return envRecord?.[key] ?? process.env[key];
}

export function isNonProduction(): boolean {
  // Next.js / OpenNext local dev: NODE_ENV is usually "development"
  // Production builds: "production"
  return process.env.NODE_ENV !== "production";
}

export function isDevBypassTurnstileEnabled(env: unknown): boolean {
  // Safety: never bypass in production.
  if (!isNonProduction()) return false;
  return getRuntimeEnvVar(env, "DEV_BYPASS_TURNSTILE") === "1";
}

export function shouldReturnEmailCodeInResponse(env: unknown): boolean {
  // Safety: never return codes in production responses.
  if (!isNonProduction()) return false;
  return getRuntimeEnvVar(env, "DEV_RETURN_EMAIL_CODE") === "1";
}


