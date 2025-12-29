import { getRuntimeEnvVar } from "./runtimeEnv";

declare global {
  // eslint-disable-next-line no-var
  var __DEV_EPHEMERAL_SESSION_SECRET: string | undefined;
}

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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof btoa === "function") {
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      return btoa(bin);
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

  if (!globalThis.__DEV_EPHEMERAL_SESSION_SECRET) {
    globalThis.__DEV_EPHEMERAL_SESSION_SECRET = generateSecret();
  }
  return globalThis.__DEV_EPHEMERAL_SESSION_SECRET;
}


