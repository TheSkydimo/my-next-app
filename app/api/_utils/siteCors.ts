import { getRuntimeEnvVar } from "./runtimeEnv";

function normalizeOrigin(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // Drop path/query/hash
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function getAllowedSiteOrigins(env: unknown): string[] {
  /**
   * Comma-separated list, e.g.:
   * SITE_ALLOWED_ORIGINS="https://skydimo.com,https://www.skydimo.com"
   */
  const raw = String(getRuntimeEnvVar(env, "SITE_ALLOWED_ORIGINS") ?? "").trim();
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const o = normalizeOrigin(part.trim());
    if (o) out.push(o);
  }
  return Array.from(new Set(out));
}

export function buildSiteCorsHeaders(env: unknown, request: Request): HeadersInit {
  const origin = request.headers.get("Origin");
  if (!origin) return {};

  const originNorm = normalizeOrigin(origin);
  if (!originNorm) return {};

  const allowed = getAllowedSiteOrigins(env);
  if (!allowed.includes(originNorm)) return {};

  return {
    "Access-Control-Allow-Origin": originNorm,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}


