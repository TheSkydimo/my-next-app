import { getCloudflareContext } from "@opennextjs/cloudflare";
import { serializeCookie } from "../_utils/cookies";
import { ADMIN_MODE_COOKIE_NAME } from "../_utils/adminModeCookie";
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

  // IMPORTANT:
  // Some browsers can keep multiple cookies with the same name if historical versions used different
  // Domain attributes (host-only vs ".example.com"). To make logout robust, clear BOTH variants.
  const cookiesToClear: string[] = [];
  // 1) Clear cookie with configured Domain (subdomain-wide), if any.
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
    cookiesToClear.push(
      serializeCookie(ADMIN_MODE_COOKIE_NAME, "", {
        path: "/",
        httpOnly: true,
        secure,
        sameSite: "Lax",
        domain,
        maxAge: 0,
      })
    );
  }
  // 2) Clear host-only cookie (no Domain attribute).
  cookiesToClear.push(
    serializeCookie(getSessionCookieName(), "", {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
      maxAge: 0,
    })
  );
  cookiesToClear.push(
    serializeCookie(ADMIN_MODE_COOKIE_NAME, "", {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
      maxAge: 0,
    })
  );

  // 如果没有配置 SESSION_SECRET 也没关系：清空 cookie 仍然有效
  void env;

  const headers = new Headers();
  for (const c of cookiesToClear) headers.append("Set-Cookie", c);
  headers.set("Cache-Control", "no-store");
  return Response.json({ ok: true }, { headers });
}, { name: "POST /api/logout" });


