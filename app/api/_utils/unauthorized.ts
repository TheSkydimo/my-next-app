import { serializeCookie } from "./cookies";
import { getSessionCookieName } from "./session";
import { isSecureRequest } from "./request";
import { getSessionCookieDomain } from "./sessionCookieDomain";

export function unauthorizedWithClearedSession(request: Request): Response {
  const secure = isSecureRequest(request);
  // Note: request doesn't carry env, so we fall back to process.env in getRuntimeEnvVar.
  const domain = getSessionCookieDomain(undefined);
  // Same hardening as /api/logout: clear both Domain and host-only cookie variants.
  const cookiesToClear: string[] = [];
  if (domain) {
    cookiesToClear.push(
      serializeCookie(getSessionCookieName(), "", {
        path: "/",
        httpOnly: true,
        secure,
        sameSite: "Lax",
        domain,
        maxAge: 0,
      })
    );
  }
  cookiesToClear.push(
    serializeCookie(getSessionCookieName(), "", {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
      maxAge: 0,
    })
  );

  const headers = new Headers();
  for (const c of cookiesToClear) headers.append("Set-Cookie", c);
  headers.set("Cache-Control", "no-store");

  return new Response("Unauthorized", {
    status: 401,
    headers,
  });
}


