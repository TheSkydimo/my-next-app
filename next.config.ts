import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import path from "node:path";
import fs from "node:fs/promises";

const nextConfig: NextConfig = {
  // Required by OpenNext adapters (Cloudflare/AWS) to locate server output under `.next/standalone`.
  output: "standalone",

  /**
   * Workaround (Next.js 15.5.x + OpenNext bundling on Windows):
   * Next generates `server/pages/_app.js` wrappers that require:
   *   `../chunks/ssr/[turbopack]_runtime.js`
   * but the runtime is emitted to:
   *   `server/chunks/[turbopack]_runtime.js`
   *
   * Copy the runtime into `chunks/ssr` right after emit so `next build` and OpenNext can resolve it.
   */
  webpack: (config, ctx) => {
    if (ctx.isServer) {
      config.plugins = config.plugins ?? [];
      config.plugins.push({
        apply(compiler: any) {
          compiler.hooks.afterEmit.tapPromise(
            "CopyTurbopackRuntimeToSsr",
            async () => {
              const outPath = compiler.options?.output?.path as string | undefined;
              if (!outPath) return;

              const src = path.join(outPath, "chunks", "[turbopack]_runtime.js");
              const srcMap = path.join(outPath, "chunks", "[turbopack]_runtime.js.map");
              const destDir = path.join(outPath, "chunks", "ssr");
              const dest = path.join(destDir, "[turbopack]_runtime.js");
              const destMap = path.join(destDir, "[turbopack]_runtime.js.map");

              try {
                await fs.mkdir(destDir, { recursive: true });
                await fs.copyFile(src, dest);
                // Optional sourcemap copy (ignore if missing)
                await fs.copyFile(srcMap, destMap).catch(() => undefined);
              } catch {
                // If the runtime isn't emitted (or paths differ), ignore.
              }
            }
          );
        },
      });
    }

    return config;
  },
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
