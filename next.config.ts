import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

/**
 * Enable calling `getCloudflareContext()` only in `next dev` when explicitly opted in.
 *
 * By default we skip starting Wrangler remote dev to avoid:
 * - Requiring Cloudflare auth/token for local development.
 * - Failing `next dev` when `wrangler` cannot reach Cloudflare (e.g. network / region issues).
 *
 * To enable Cloudflare bindings in local dev, set:
 *   CLOUDFLARE_DEV=1
 * before running `npm run dev`.
 */
export default async () => {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.CLOUDFLARE_DEV === "1"
  ) {
    await initOpenNextCloudflareForDev({
      environment: "development",
      persist: { path: ".wrangler/state" },
    });
  }

  return nextConfig;
};
