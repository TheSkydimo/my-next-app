import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET() {
  const { env } = await getCloudflareContext();
  const siteKey = String(
    (env as unknown as { NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string })
      .NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""
  );

  return Response.json(
    {
      turnstileSiteKey: siteKey,
    },
    {
      headers: {
        // runtime config: keep short cache; allow CDNs to cache a bit
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}


