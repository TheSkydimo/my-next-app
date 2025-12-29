import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import path from "node:path";
import fs from "node:fs/promises";

function parseCsvEnvHosts(value: string | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const devExtraAllowedOrigins = parseCsvEnvHosts(
  process.env.DEV_ALLOWED_DEV_ORIGINS
);

const nextConfig: NextConfig = {
  // Required by OpenNext adapters (Cloudflare/AWS) to locate server output under `.next/standalone`.
  output: "standalone",
  /**
   * OpenNext + Cloudflare (Workers) does not reliably support Next.js' built-in image optimizer
   * route (`/_next/image`) in all environments. When it fails, local images like `/logo.png`
   * will render as broken images.
   *
   * Setting this to true makes `next/image` serve assets as-is (i.e. a plain <img src="...">),
   * which is the most compatible option for our deployment target.
   */
  images: {
    unoptimized: true,
  },
  /**
   * Allow loading `/_next/*` assets from additional origins in dev.
   *
   * This prevents warnings like:
   *   "Cross origin request detected ... In a future major version ... configure allowedDevOrigins"
   *
   * Note: This is dev-only behavior; production is not affected.
   */
  allowedDevOrigins:
    process.env.NODE_ENV === "development"
      ? [
          "localhost",
          "127.0.0.1",
          // Allow LAN access (e.g. mobile testing).
          // - Add your LAN IP here, or
          // - set `DEV_ALLOWED_DEV_ORIGINS="192.168.1.102,192.168.1.50"` before `npm run dev`
          "192.168.1.102",
          ...devExtraAllowedOrigins,
          // Example wildcard: "*.local-origin.dev",
        ]
      : undefined,

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

  async headers() {
    // Security headers (global). Keep conservative to avoid breaking embedded/third-party flows.
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
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
  /**
   * In this repo, most `/api/*` routes depend on Cloudflare bindings via
   * `getCloudflareContext()` (D1/R2/etc). So for `next dev`, we must initialize
   * the Cloudflare dev bridge, otherwise API routes will 500.
   *
   * If you *really* want to disable this for some reason, set:
   *   DISABLE_CLOUDFLARE_DEV_BRIDGE=1
   */
  if (
    process.env.NODE_ENV === "development" &&
    process.env.DISABLE_CLOUDFLARE_DEV_BRIDGE !== "1"
  ) {
    await initOpenNextCloudflareForDev({
      environment: "development",
      persist: { path: ".wrangler/state" },
    });
  }

  return nextConfig;
};
