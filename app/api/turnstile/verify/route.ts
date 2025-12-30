import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readJsonBody } from "../../_utils/body";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { getTurnstileSecretFromEnv, verifyTurnstileToken } from "../../_utils/turnstile";
import { isDevBypassTurnstileEnabled } from "../../_utils/runtimeEnv";
import { issueTurnstilePassCookie } from "../../_utils/turnstilePass";
import { assertSameOriginOrNoOrigin } from "../../_utils/requestOrigin";

export const POST = withApiMonitoring(async function POST(request: Request) {
  const originGuard = assertSameOriginOrNoOrigin(request);
  if (originGuard) return originGuard;

  const parsed = await readJsonBody<{ token?: string }>(request);
  if (!parsed.ok) {
    return new Response("Invalid JSON", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { token } = parsed.value;

  const { env } = await getCloudflareContext();

  const bypass = isDevBypassTurnstileEnabled(env);
  if (!bypass) {
    const secret = getTurnstileSecretFromEnv(env);
    if (!secret) {
      // Do not leak config details beyond what's necessary.
      return new Response("验证服务暂不可用，请稍后再试", {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!token) {
      return new Response("请完成人机验证", {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const remoteip = request.headers.get("CF-Connecting-IP");
    const ok = await verifyTurnstileToken({ secret, token, remoteip });
    if (!ok) {
      return new Response("人机验证失败，请重试", {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }
  }

  const setCookie = await issueTurnstilePassCookie({ request, env, maxAgeSeconds: 60 * 10 });
  if (!setCookie) {
    return new Response("服务器内部错误", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": setCookie,
        "Cache-Control": "no-store",
      },
    }
  );
}, { name: "POST /api/turnstile/verify" });


