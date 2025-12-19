import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isDevBypassTurnstileEnabled } from "../_utils/runtimeEnv";

export async function GET() {
  const { env } = await getCloudflareContext();
  const siteKey = String(
    (env as unknown as { NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string })
      .NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""
  );

  const bypassTurnstile = isDevBypassTurnstileEnabled(env);
  const turnstileRequired = !bypassTurnstile && !!siteKey;

  return Response.json(
    {
      turnstileSiteKey: siteKey,
      turnstileRequired,
    },
    {
      headers: {
        // runtime config: keep short cache; allow CDNs to cache a bit
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}


