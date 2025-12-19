import { getCloudflareContext } from "@opennextjs/cloudflare";
import { serializeCookie } from "../_utils/cookies";
import { getSessionCookieName } from "../_utils/session";

export async function POST(request: Request) {
  // 仅清理 cookie；不依赖 DB
  const { env } = await getCloudflareContext();
  const url = new URL(request.url);
  const secure =
    url.protocol === "https:" || request.headers.get("X-Forwarded-Proto") === "https";

  const cookie = serializeCookie(getSessionCookieName(), "", {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "Lax",
    maxAge: 0,
  });

  // 如果没有配置 SESSION_SECRET 也没关系：清空 cookie 仍然有效
  void env;

  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}


