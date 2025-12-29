import { getRuntimeEnvVar } from "./runtimeEnv";

function isDevRuntime(env: unknown): boolean {
  // Keep consistent with runtimeEnv.ts rules:
  // - Next.js dev server: NODE_ENV === "development"
  // - Wrangler/OpenNext local dev: NEXTJS_ENV === "development"
  if (process.env.NODE_ENV === "development") return true;
  return getRuntimeEnvVar(env, "NEXTJS_ENV") === "development";
}

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url (no padding)
  const b64 = (() => {
    // Cloudflare Workers: btoa; Node: Buffer.
    const btoaFn = (globalThis as unknown as { btoa?: (s: string) => string }).btoa;
    if (typeof btoaFn === "function") {
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      return btoaFn(bin);
    }
    // Node fallback:
    return Buffer.from(bytes).toString("base64");
  })();

  const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `dev-${b64url}`;
}

/**
 * Returns the session signing secret.
 *
 * - Production: MUST be configured via `SESSION_SECRET`, otherwise returns empty string.
 * - Dev: if missing, we generate an ephemeral secret for this server process so login works
 *   without extra setup (users will be logged out after a server restart).
 */
export function getSessionSecret(env: unknown): string {
  const fromEnv = String(getRuntimeEnvVar(env, "SESSION_SECRET") ?? "").trim();
  if (fromEnv) return fromEnv;

  // Safety: never auto-generate in production.
  if (!isDevRuntime(env)) return "";

  const g = globalThis as unknown as { __DEV_EPHEMERAL_SESSION_SECRET?: string };
  if (!g.__DEV_EPHEMERAL_SESSION_SECRET) {
    g.__DEV_EPHEMERAL_SESSION_SECRET = generateSecret();
  }
  return g.__DEV_EPHEMERAL_SESSION_SECRET;
}


