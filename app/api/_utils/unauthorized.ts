import { serializeCookie } from "./cookies";
import { getSessionCookieName } from "./session";
import { isSecureRequest } from "./request";

export function unauthorizedWithClearedSession(request: Request): Response {
  const secure = isSecureRequest(request);
  const cookie = serializeCookie(getSessionCookieName(), "", {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "Lax",
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


