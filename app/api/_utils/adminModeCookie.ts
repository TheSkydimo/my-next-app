import { serializeCookie } from "./cookies";
import { getSessionCookieDomain } from "./sessionCookieDomain";
import { isSecureRequest } from "./request";

/**
 * Admin-mode marker cookie.
 *
 * Why it exists:
 * - Admin and user share the same session cookie (same account system).
 * - When an admin logs in, the user site can still treat it as a valid session.
 * - We need a lightweight, server-readable marker to prefer redirecting to /admin/*.
 *
 * Security:
 * - HttpOnly + Secure (when applicable) + SameSite=Lax
 * - Value is not an auth token, only a mode hint.
 */
export const ADMIN_MODE_COOKIE_NAME = "skydimo_admin_mode";

export function serializeAdminModeCookie(options: {
  request: Request;
  env: unknown;
  enabled: boolean;
  maxAgeSeconds?: number;
}): string {
  const { request, env, enabled, maxAgeSeconds } = options;
  const secure = isSecureRequest(request);
  const domain = getSessionCookieDomain(env);

  return serializeCookie(ADMIN_MODE_COOKIE_NAME, enabled ? "1" : "", {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    ...(domain ? { domain } : {}),
    path: "/",
    ...(enabled
      ? typeof maxAgeSeconds === "number"
        ? { maxAge: maxAgeSeconds }
        : {}
      : { maxAge: 0 }),
  });
}


