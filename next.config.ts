import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

/**
 * Enable calling `getCloudflareContext()` only in `next dev`.
 * This avoids Wrangler remote dev being started during `next build` / deploy.
 * See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
 */
export default async () => {
  if (process.env.NODE_ENV === "development") {
    await initOpenNextCloudflareForDev({
      environment: "development",
      persist: { path: ".wrangler/state" },
    });
  }

  return nextConfig;
};
