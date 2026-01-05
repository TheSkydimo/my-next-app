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

function getRequestCorsOrigin(request: Request): string | null {
  // Primary: standard CORS Origin header.
  const origin = String(request.headers.get("Origin") ?? "").trim();
  // Some contexts use an "opaque origin" and send Origin: null (literal string).
  // In that case, fall back to parsing the Referer to recover the actual page origin.
  const originNorm = origin && origin.toLowerCase() !== "null" ? normalizeOrigin(origin) : null;
  if (originNorm) return originNorm;

  const referer = String(request.headers.get("Referer") ?? "").trim();
  if (!referer) return null;
  return normalizeOrigin(referer);
}

export function buildSiteCorsHeaders(env: unknown, request: Request): HeadersInit {
  const originNorm = getRequestCorsOrigin(request);
  if (!originNorm) return {};

  const allowed = getAllowedSiteOrigins(env);
  if (!allowed.includes(originNorm)) return {};

  return {
    "Access-Control-Allow-Origin": originNorm,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // When Origin is "null", we may fall back to Referer, so vary on both.
    "Vary": "Origin, Referer",
  };
}


