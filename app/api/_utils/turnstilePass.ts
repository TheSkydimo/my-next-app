import { getRuntimeEnvVar } from "./runtimeEnv";
import { getSessionSecret } from "./sessionSecret";
import { serializeCookie, getRequestCookie } from "./cookies";
import { isSecureRequest } from "./request";
import { createSessionToken, verifySessionToken } from "./session";

/**
 * Short-lived "Turnstile passed" cookie.
 *
 * Purpose:
 * - Turnstile tokens are single-use and expire quickly.
 * - We exchange the token for a short TTL, httpOnly cookie so the user can retry login/send-code
 *   without being forced back to Turnstile page.
 *
 * Security:
 * - Cookie value is HMAC-signed (same format as session token).
 * - Expiration is enforced server-side.
 */

const TURNSTILE_PASS_COOKIE_NAME = "turnstile_pass";

export function getTurnstilePassCookieName(): string {
  return TURNSTILE_PASS_COOKIE_NAME;
}

function getTurnstilePassSecret(env: unknown): string {
  // Prefer SESSION_SECRET if present (already required for remember-login in prod),
  // fall back to TURNSTILE_SECRET_KEY (also server-only).
  return (
    getSessionSecret(env).trim() ||
    String(getRuntimeEnvVar(env, "TURNSTILE_SECRET_KEY") ?? "").trim()
  );
}

export async function issueTurnstilePassCookie(opts: {
  request: Request;
  env: unknown;
  maxAgeSeconds?: number; // default: 10 minutes
}): Promise<string | null> {
  const maxAgeSeconds = Math.max(30, Math.floor(opts.maxAgeSeconds ?? 60 * 10));
  const secret = getTurnstilePassSecret(opts.env);
  if (!secret) return null;

  // uid is not used here; we just need a signed, expiring token.
  const { token } = await createSessionToken({
    secret,
    userId: 0,
    maxAgeSeconds,
  });

  const secure = isSecureRequest(opts.request);
  return serializeCookie(getTurnstilePassCookieName(), token, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function hasValidTurnstilePassCookie(opts: {
  request: Request;
  env: unknown;
}): Promise<boolean> {
  const secret = getTurnstilePassSecret(opts.env);
  if (!secret) return false;

  const token = getRequestCookie(opts.request, getTurnstilePassCookieName());
  if (!token) return false;

  const payload = await verifySessionToken({ secret, token });
  return !!payload;
}


