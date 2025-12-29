import { getRuntimeEnvVar } from "./runtimeEnv";

/**
 * Optional cookie domain for sharing session across subdomains.
 *
 * Example (prod): ".skydimo.com"
 * Example (dev/localhost): leave unset (host-only cookie)
 */
export function getSessionCookieDomain(env: unknown): string | undefined {
  const raw =
    String(getRuntimeEnvVar(env, "SESSION_COOKIE_DOMAIN") ?? "").trim() ||
    String(getRuntimeEnvVar(env, "COOKIE_DOMAIN") ?? "").trim();
  if (!raw) return undefined;
  // Basic hardening: allow only hostname-ish strings.
  if (/[;\s/\\]/.test(raw)) return undefined;
  return raw;
}


