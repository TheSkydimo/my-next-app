import { serializeCookie } from "./cookies";
import { getSessionCookieName } from "./session";
import { isSecureRequest } from "./request";
import { getSessionCookieDomain } from "./sessionCookieDomain";

export function unauthorizedWithClearedSession(request: Request): Response {
  const secure = isSecureRequest(request);
  // Note: request doesn't carry env, so we fall back to process.env in getRuntimeEnvVar.
  const domain = getSessionCookieDomain(undefined);
  const cookie = serializeCookie(getSessionCookieName(), "", {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "Lax",
    ...(domain ? { domain } : {}),
    maxAge: 0,
  });

  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "Set-Cookie": cookie,
      "Cache-Control": "no-store",
    },
  });
}


