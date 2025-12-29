import { getCloudflareContext } from "@opennextjs/cloudflare";
import { serializeCookie } from "../_utils/cookies";
import { getSessionCookieName } from "../_utils/session";
import { isSecureRequest } from "../_utils/request";
import { assertSameOriginOrNoOrigin } from "../_utils/requestOrigin";
import { getSessionCookieDomain } from "../_utils/sessionCookieDomain";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

export const POST = withApiMonitoring(async function POST(request: Request) {
  const originGuard = assertSameOriginOrNoOrigin(request);
  if (originGuard) return originGuard;

  // 仅清理 cookie；不依赖 DB
  const { env } = await getCloudflareContext();
  const secure = isSecureRequest(request);
  const domain = getSessionCookieDomain(env);

  const cookie = serializeCookie(getSessionCookieName(), "", {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "Lax",
    ...(domain ? { domain } : {}),
    maxAge: 0,
  });

  // 如果没有配置 SESSION_SECRET 也没关系：清空 cookie 仍然有效
  void env;

  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}, { name: "POST /api/logout" });


